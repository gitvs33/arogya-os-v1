# MedOS — Key Things to Keep in Mind Before Building the Backend (Port 8000)

> Read this before writing a single line of new backend code.
> The codebase went through 4 rounds of architecture review to get to this state.
> These rules protect that work.

---

## 1. The One Rule That Protects Everything

```
View (3-10 lines) → Service function → Database
```

**Never write query logic in a view.**

Every domain already has a service module. New features extend the existing ones:

| Domain | Service file | What lives there |
|---|---|---|
| Billing | `billing/metrics.py` | Revenue calculations, accrual logic |
| TeleICU | `teleicu/helpers.py` | Dashboard stats, vitals trends |
| Reports | `reports/helpers.py` | KPI calculations, chart data |
| Alerts | `alerts/` (4 files) | Alert engine, thresholds, broadcaster |
| Auth | `auth/` (3 files) | Authentication, token handling |

New domains (Ward/IPD, Prescription system, billing accrual) get their own service file:

```
pharmacy/services.py      ← prescription + dispensing logic
ward/services.py          ← round management, bed assignment, discharge
billing/accrual.py        ← accrual logic (extend billing/)
```

If a view exceeds 10 lines of logic — stop. Extract a service function.

---

## 2. Every New Model Needs a Hospital FK

The SaaS migration is not complete yet. Every new model you create must have:

```python
hospital = models.ForeignKey(
    'Hospital',
    on_delete=models.CASCADE,
    related_name='%(class)ss'
)
```

**No exceptions.** Models without a hospital FK will leak data across hospitals.

New models that need it:
- `Prescription`
- `DailyRound`
- `Ward`
- `Bed`
- `NursingNote`
- `MedicationAdministration`
- `ServicePrice`
- `BillingAccrual`
- `DailyMedication`
- `DailyLabOrder`

If you create a model and forget the hospital FK, every ViewSet querying it
becomes a data breach waiting to happen.

---

## 3. Every New ViewSet Must Extend HospitalScopedViewSet

`views/base.py` already has `HospitalScopedViewSet`. Every new ViewSet extends it:

```python
# WRONG — never do this
class PrescriptionViewSet(viewsets.ModelViewSet):
    queryset = Prescription.objects.all()  # returns ALL hospitals' data

# CORRECT — always do this
class PrescriptionViewSet(HospitalScopedViewSet):
    queryset = Prescription.objects.all()  # auto-filtered by hospital
```

`HospitalScopedViewSet` does three things automatically:
- Filters `get_queryset()` by the logged-in user's hospital
- Returns `404` (not `403`) when a user tries to access another hospital's record
- Attaches `hospital` FK automatically on `perform_create()`

You never need to write `filter(hospital=...)` in a ViewSet that extends this.

---

## 4. Follow the Existing File Structure — Do Not Create New Locations

The codebase has a defined structure after 4 rounds of cleanup. Add to it, don't invent new locations.

```
medos/
  models/              ← domain-aligned model files (10 files already)
    patient.py
    clinical.py
    billing.py
    lab.py
    icu.py
    ...
    ward.py            ← ADD new models here (one file per domain)
    pharmacy.py        ← ADD prescription models here

  views/               ← views organized by domain
    admin/             ← 11 files for admin panel views
    lab/               ← 9 files for lab views
    patients.py
    encounters.py
    billing.py
    ...
    ward.py            ← ADD new view files here
    pharmacy.py        ← ADD prescription views here

  serializers/         ← mirrors views/ structure exactly
    admin/
    lab/
    ...
    ward.py            ← ADD serializers matching views/ward.py
    pharmacy.py        ← ADD serializers matching views/pharmacy.py
```

**The rule:** Every new domain gets exactly three files — one in `models/`,
one in `views/`, one in `serializers/`. If the domain is complex (like lab),
it becomes a sub-package (`views/lab/`, `serializers/lab/`).

---

## 5. Register New URLs in the Existing urls.py

The main `urls.py` already has 17 routers and 40+ custom paths. Add new
endpoints to the existing file, not a new one:

```python
# medos/urls.py — ADD new routers here, not in a separate file

router.register(r'prescriptions', PrescriptionViewSet, basename='prescription')
router.register(r'wards', WardViewSet, basename='ward')
router.register(r'beds', BedViewSet, basename='bed')
router.register(r'daily-rounds', DailyRoundViewSet, basename='dailyround')
```

Custom action endpoints (non-CRUD) go in the urlpatterns list:

```python
urlpatterns = [
    # existing paths...
    path('prescriptions/<uuid:pk>/submit/', submit_prescription, name='prescription-submit'),
    path('prescriptions/<uuid:pk>/amend/', amend_prescription, name='prescription-amend'),
    path('prescriptions/<uuid:pk>/cancel/', cancel_prescription, name='prescription-cancel'),
    path('wards/<uuid:pk>/bed-map/', ward_bed_map, name='ward-bed-map'),
    path('encounters/<uuid:pk>/discharge/', discharge_patient, name='encounter-discharge'),
]
```

---

## 6. Add API Version Prefix to All New Endpoints

The final report lists missing API versioning as technical debt. All new
endpoints must use the version prefix from the start:

```python
# All new endpoints go under /api/v1/
path('api/v1/', include('medos.urls')),
```

When you add this prefix, update the frontend API clients base URL from
`/api/` to `/api/v1/` at the same time. Do not mix versioned and
unversioned endpoints — all or nothing.

---

## 7. Use transaction.atomic() for Every Multi-Step Write

Any operation that writes to more than one table must be wrapped in a transaction.
If one step fails, everything rolls back. No partial state.

```python
# Every service function that touches multiple tables

def admit_patient_to_ward(encounter_id, ward_id, bed_id, hospital):
    with transaction.atomic():
        encounter = Encounter.objects.get(id=encounter_id, hospital=hospital)
        bed = Bed.objects.select_for_update().get(
            id=bed_id,
            ward__hospital=hospital,
            status=Bed.Status.AVAILABLE
        )

        # Assign bed
        bed.status = Bed.Status.OCCUPIED
        bed.current_encounter = encounter
        bed.save()

        # Update encounter
        encounter.admission_type = 'ipd'
        encounter.save()

        # Log the activity
        SystemActivityLog.objects.create(
            hospital=hospital,
            action='patient_admitted',
            entity_id=str(encounter.id)
        )

        return bed
```

`select_for_update()` on bed assignment prevents two nurses assigning
the same bed simultaneously. Use it on any resource that can be
claimed by concurrent users.

---

## 8. Write Tests for Every Service Function

The codebase has 12 test files with 182+ tests. Every new service function
needs a test. Follow the existing pattern:

```python
# tests/test_ward_service.py

class WardServiceTest(TestCase):
    def setUp(self):
        self.hospital = Hospital.objects.create(name="Test", slug="test")
        self.ward = Ward.objects.create(
            hospital=self.hospital,
            name="General Ward 3A",
            ward_type='general',
            bed_charge_per_day=Decimal('1000.00')
        )
        self.bed = Bed.objects.create(
            hospital=self.hospital,
            ward=self.ward,
            bed_number='3A-01',
            status=Bed.Status.AVAILABLE
        )

    def test_admit_patient_assigns_bed(self):
        # test the service function directly — no HTTP, no auth
        result = ward_service.admit_patient_to_ward(
            encounter_id=self.encounter.id,
            bed_id=self.bed.id,
            hospital=self.hospital
        )
        self.bed.refresh_from_db()
        self.assertEqual(self.bed.status, Bed.Status.OCCUPIED)

    def test_admit_patient_fails_if_bed_occupied(self):
        self.bed.status = Bed.Status.OCCUPIED
        self.bed.save()
        with self.assertRaises(ValidationError):
            ward_service.admit_patient_to_ward(
                encounter_id=self.encounter.id,
                bed_id=self.bed.id,
                hospital=self.hospital
            )
```

**Pattern:** Test service functions directly — not through HTTP.
Tests should not require a running server, auth headers, or a test client.
Fast, isolated, reliable.

---

## 9. Log Every Significant Action to SystemActivityLog

The Live Activity Feed on the dashboard reads from `SystemActivityLog`.
Every significant action must write an entry. Insignificant = reads.
Significant = anything that changes state:

```python
# Actions that MUST write a log entry:
patient_registered
encounter_created
prescription_submitted
prescription_amended
prescription_cancelled
medication_dispensed
lab_order_completed
patient_admitted_to_ward
patient_transferred
patient_discharged
invoice_generated
payment_recorded
user_created
role_changed
```

```python
# Standard log call — add to every service function that changes state
SystemActivityLog.objects.create(
    hospital=hospital,
    action='prescription_submitted',
    user=request.user,
    entity_id=str(prescription.id),
    entity_type='prescription',
    notes=f"Prescription v{prescription.version} submitted by Dr. {request.user.get_full_name()}"
)
```

Without this, the Live Activity Feed shows nothing and the audit trail
is incomplete — a medico-legal problem.

---

## 10. New Migrations — Always Run on Main Backend Only

The main backend (`medos/backend/`) owns all migrations. The internal ops
backend (`medos_internal_frontend/backend/`) uses `managed=False` on shared tables.

**When you create a new model:**

```bash
# Always run makemigrations in the MAIN backend
cd medos/backend
python manage.py makemigrations
python manage.py migrate
```

**Never run `makemigrations` in the internal ops backend for shared tables.**
If you do, two projects will fight over the same table and corrupt the database.

After adding new models to the main backend, update the internal ops backend's
unmanaged mirror models if they need to read the new table:

```python
# medos_internal_frontend/backend/models.py
class Prescription(models.Model):
    # Mirror fields only — no management
    class Meta:
        managed = False
        db_table = 'medos_prescription'
```

---

## 11. Never Return Unbounded Querysets

Every list endpoint must be paginated. `objects.all()` returning 10,000
records to the frontend is a performance problem at 2,000 patients and
a crash at 4M patients/day.

```python
# WRONG
class PatientViewSet(HospitalScopedViewSet):
    queryset = Patient.objects.all()
    # no pagination — returns all records

# CORRECT
class PatientViewSet(HospitalScopedViewSet):
    queryset = Patient.objects.all()
    pagination_class = StandardResultsPagination  # already exists in codebase
```

Default page size 20-50 depending on the list. Search endpoints default to 10.
Heavy report endpoints default to 100 with a max cap of 500.

---

## 12. Permission Class on Every New Endpoint

Every new endpoint needs the correct permission class. The codebase already
has `HasRolePermission` and its subclasses in `permissions.py`. Use them:

```python
# New ViewSets
class PrescriptionViewSet(HospitalScopedViewSet):
    permission_classes = [IsAuthenticated, HasEMRAccess]

class WardViewSet(HospitalScopedViewSet):
    permission_classes = [IsAuthenticated, HasWardAccess]

class PharmacyQueueViewSet(HospitalScopedViewSet):
    permission_classes = [IsAuthenticated, HasPharmacyAccess]
```

Add corresponding permission classes to `permissions.py` for each new module:

```python
class HasWardAccess(HasRolePermission):
    required_module = 'ward'
    required_action = 'read'

class HasPharmacyAccess(HasRolePermission):
    required_module = 'pharmacy'
    required_action = 'read'
```

A ViewSet with only `IsAuthenticated` means every logged-in user — doctor,
nurse, pharmacist, lab tech — can call it. That is wrong for most endpoints.

---

## 13. The Bed Charge Midnight Task — Use Celery Beat

Bed charges accrue daily. They must be added automatically at midnight —
not manually by billing staff. This is a Celery beat task:

```python
# tasks.py — add to existing tasks file

@shared_task
def accrue_daily_bed_charges():
    """
    Runs at midnight every day.
    Adds bed charge line item to every active IPD encounter.
    """
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    active_encounters = Encounter.objects.filter(
        admission_type__in=['ipd', 'teleicu'],
        status='active',
        assigned_bed__isnull=False
    ).select_related('assigned_bed__ward', 'hospital')

    with transaction.atomic():
        for encounter in active_encounters:
            bed_charge = encounter.assigned_bed.ward.bed_charge_per_day
            BillingAccrual.objects.create(
                hospital=encounter.hospital,
                encounter=encounter,
                item_type='bed_charge',
                description=f"Bed Charge — {encounter.assigned_bed.bed_number}",
                date=yesterday,
                amount=bed_charge
            )
```

Register in Celery beat settings:

```python
CELERY_BEAT_SCHEDULE = {
    'accrue-daily-bed-charges': {
        'task': 'medos.tasks.accrue_daily_bed_charges',
        'schedule': crontab(hour=0, minute=5),  # 12:05am every day
    },
}
```

---

## 14. Do Not Touch These Files Without Understanding Them Fully

These files are load-bearing. Changing them carelessly breaks large parts of the system:

| File | Why dangerous |
|---|---|
| `views/base.py` | `HospitalScopedViewSet` — every ViewSet inherits from this. A bug here breaks all tenant isolation. |
| `permissions.py` | All role-based access control. A mistake here opens the wrong data to the wrong users. |
| `auth/` (3 files) | Authentication and Supabase integration. Break this and nobody can log in. |
| `consumers.py` | WebSocket consumers. Break this and TeleICU vitals stop streaming. |
| `models/__init__.py` | Exports all models. Missing an import causes `ImportError` across the entire app. |
| `urls.py` | 17 routers + 40+ paths. A syntax error here takes down all API endpoints. |
| `alerts/broadcaster.py` | ABC pattern. Break the interface and all alert subscribers stop receiving alerts. |

If you need to touch these — read the file completely first.
Make one change at a time. Run the full test suite after each change.

---

## 15. Run the Full Test Suite Before and After Every Session

Before starting any new feature:

```bash
cd medos/backend
python manage.py test
```

All 182+ tests must pass before you write a single line of new code.
If any test is already failing — fix it first before adding new features.

After finishing a feature:

```bash
python manage.py test
```

All tests must still pass. New features must add new tests.
The test count should only go up, never down.

---

## Summary Checklist — Before Pushing Any New Code

- [ ] Every new model has a `hospital` FK
- [ ] Every new ViewSet extends `HospitalScopedViewSet`
- [ ] No query logic in any view — all logic in service modules
- [ ] Every multi-step write is wrapped in `transaction.atomic()`
- [ ] `select_for_update()` used on any resource that can be claimed concurrently
- [ ] Every significant state change writes to `SystemActivityLog`
- [ ] Every new endpoint has a permission class beyond `IsAuthenticated`
- [ ] Every new list endpoint uses pagination
- [ ] New migrations only run from `medos/backend/`
- [ ] New service functions have tests that call them directly (no HTTP)
- [ ] Full test suite passes before and after
- [ ] New files placed in the correct existing package (`models/`, `views/`, `serializers/`)
- [ ] New URLs registered in the existing `urls.py`
