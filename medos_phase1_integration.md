# MedOS — Phase 1: Full Integration Sprint

> Wire every widget, every button, every "View all" to a real backend.
> Attack module by module in the order below. Do not jump ahead.
> The frontend exists. The backend structure is clean. This phase connects them.

---

> ## ⚠️ The One Rule That Protects Everything
>
> The architecture review spent four rounds getting the codebase to a place where
> views are thin adapters and logic lives in service modules. Every new feature
> written during this sprint must follow the same pattern:
>
> ```
> View (3-10 lines) → Service function → Database
> ```
>
> **Never write query logic in a view.**
>
> If you are writing more than 10 lines in a view, stop.
> Extract a service function. That single rule keeps the codebase
> clean through the entire integration sprint regardless of how fast
> you are moving or how much Antigravity is generating code.
>
> Every existing domain already has a service module:
> `billing/metrics.py`, `teleicu/helpers.py`, `reports/helpers.py`
> New endpoints follow the same pattern. No exceptions.

---

## Order of Integration

Do not skip ahead. Each module depends on data from the one before it.
Patients must exist before encounters. Encounters must exist before billing.
Billing must exist before reports show real numbers.

```
1. Patient Registration   ← everything depends on this
2. EMR / Encounters       ← core clinical workflow
3. Dashboard Widgets      ← now has real data to show
4. Appointments           ← feeds dashboard upcoming list
5. Billing                ← invoice from encounter
6. Laboratory             ← orders from encounters
7. Pharmacy               ← prescriptions from EMR
8. TeleICU                ← ICU ward → bed → vitals stream
9. Reports & Analytics    ← depends on all modules above
10. Admin Panel           ← roles, users, departments
11. AI Scribe             ← isolated, needs encounter context
```

---

## Module 1 — Patient Registration

**Why first:** No patients means no data anywhere. Every other module is blocked until this works end to end.

### What needs to be wired

| UI Element | Endpoint | Method |
|---|---|---|
| Register Patient button | `/api/patients/` | POST |
| Patient search bar | `/api/patients/?search=` | GET |
| Patient list page | `/api/patients/` | GET |
| Patient detail view | `/api/patients/:id/` | GET |
| Edit patient | `/api/patients/:id/` | PATCH |
| Patient medical history | `/api/patients/:id/history/` | GET |
| Allergy list | `/api/patients/:id/allergies/` | GET |
| Add allergy | `/api/patients/:id/allergies/` | POST |

### Service pattern to follow

```python
# medos/services/patient_service.py  (create if not exists)

def get_patient_list(hospital, search=None, page=1):
    qs = Patient.objects.filter(hospital=hospital).order_by('-created_at')
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(patient_id__icontains=search)
        )
    return qs

def create_patient(hospital, validated_data):
    with transaction.atomic():
        patient = Patient.objects.create(
            hospital=hospital,
            **validated_data
        )
        return patient
```

```python
# views/patients.py — thin adapter only

class PatientViewSet(HospitalScopedViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer

    def get_queryset(self):
        search = self.request.query_params.get('search')
        return patient_service.get_patient_list(
            self.get_hospital(), search=search
        )
```

### Done when

- [ ] Can register a new patient through the UI
- [ ] Patient appears in the list immediately after registration
- [ ] Search returns correct results
- [ ] Patient detail page loads all fields correctly
- [ ] Allergies can be added and displayed

---

## Module 2 — EMR / Encounters

**Why second:** Encounter is the core clinical event. Live Activity Feed, Patient Flow, and almost every downstream module depends on encounters existing.

### What needs to be wired

| UI Element | Endpoint | Method |
|---|---|---|
| Open EMR button | `/api/encounters/` | POST (create) |
| Encounter list for patient | `/api/patients/:id/encounters/` | GET |
| Encounter detail | `/api/encounters/:id/` | GET |
| Add vitals | `/api/encounters/:id/vitals/` | POST |
| Add diagnosis | `/api/encounters/:id/diagnoses/` | POST |
| Add medication | `/api/encounters/:id/medications/` | POST |
| Clinical notes | `/api/encounters/:id/notes/` | POST |
| Discharge patient | `/api/encounters/:id/discharge/` | POST |
| Care plan | `/api/encounters/:id/care-plan/` | GET / POST |

### Service pattern to follow

```python
# medos/services/encounter_service.py

def create_encounter(hospital, patient_id, encounter_type, created_by):
    with transaction.atomic():
        patient = Patient.objects.get(id=patient_id, hospital=hospital)
        encounter = Encounter.objects.create(
            hospital=hospital,
            patient=patient,
            encounter_type=encounter_type,
            created_by=created_by,
            status='active'
        )
        SystemActivityLog.objects.create(
            hospital=hospital,
            action='encounter_created',
            user=created_by,
            entity_id=str(encounter.id)
        )
        return encounter

def discharge_patient(encounter_id, hospital, discharged_by):
    with transaction.atomic():
        encounter = Encounter.objects.get(id=encounter_id, hospital=hospital)
        encounter.status = 'discharged'
        encounter.discharged_at = timezone.now()
        encounter.discharged_by = discharged_by
        encounter.save()
        return encounter
```

### Done when

- [ ] Can open EMR for a registered patient
- [ ] Vitals can be recorded and display on the encounter
- [ ] Diagnosis can be added
- [ ] Medications can be prescribed from the encounter
- [ ] Clinical notes save correctly
- [ ] Patient can be discharged
- [ ] Encounter appears in patient history

---

## Module 3 — Dashboard Widgets

**Why third:** Now that patients and encounters exist, the dashboard has real data to display. Wire all 6 dashboard widgets now.

### What needs to be wired

| Widget | Endpoint | Method | Notes |
|---|---|---|---|
| Live Activity Feed | `/api/dashboard/activity/` | GET | Recent encounters, registrations, discharges |
| Patient Flow (Today) | `/api/dashboard/patient-flow/` | GET | Admissions, OPD, discharges count |
| Department Overview | `/api/dashboard/department-overview/` | GET | Per-department patient count |
| Upcoming Appointments | `/api/appointments/upcoming/` | GET | Next 24 hours |
| AI Insights | `/api/dashboard/insights/` | GET | Wire last — needs data volume |
| Quick Actions | Already wired via navigation | — | Just route correctly |

### Service pattern to follow

```python
# medos/services/dashboard_service.py  (create or extend)

def get_patient_flow_today(hospital):
    today = timezone.now().date()
    return {
        "admissions": Encounter.objects.filter(
            hospital=hospital,
            created_at__date=today,
            encounter_type='inpatient'
        ).count(),
        "opd_visits": Encounter.objects.filter(
            hospital=hospital,
            created_at__date=today,
            encounter_type='outpatient'
        ).count(),
        "discharges": Encounter.objects.filter(
            hospital=hospital,
            discharged_at__date=today
        ).count(),
    }

def get_live_activity(hospital, limit=20):
    return SystemActivityLog.objects.filter(
        hospital=hospital
    ).order_by('-created_at')[:limit]
```

### Done when

- [ ] Live Activity Feed shows real recent events, updates on refresh
- [ ] Patient Flow shows today's real numbers
- [ ] Department Overview shows per-department counts
- [ ] Upcoming Appointments shows real scheduled appointments
- [ ] All widgets show loading skeletons while fetching
- [ ] All widgets show error state if fetch fails — no mock data fallback

---

## Module 4 — Appointments

**Why fourth:** Appointments feed the dashboard upcoming list. Also needed before billing (appointment → encounter → invoice flow).

### What needs to be wired

| UI Element | Endpoint | Method |
|---|---|---|
| Appointments list | `/api/appointments/` | GET |
| Book appointment | `/api/appointments/` | POST |
| Appointment detail | `/api/appointments/:id/` | GET |
| Cancel appointment | `/api/appointments/:id/cancel/` | POST |
| Reschedule | `/api/appointments/:id/` | PATCH |
| Doctor availability | `/api/doctors/:id/availability/` | GET |
| Convert to encounter | `/api/appointments/:id/start/` | POST |

### Done when

- [ ] Appointment can be booked for a patient with a doctor
- [ ] Appears in the dashboard Upcoming Appointments widget
- [ ] Can be cancelled or rescheduled
- [ ] Starting an appointment creates an encounter automatically

---

## Module 5 — Billing

**Why fifth:** Invoice flows from encounter. Needs encounters to exist first.

### What needs to be wired

| UI Element | Endpoint | Method |
|---|---|---|
| Create invoice | `/api/invoices/` | POST |
| Invoice from encounter | `/api/encounters/:id/invoice/` | POST |
| Invoice list | `/api/invoices/` | GET |
| Invoice detail | `/api/invoices/:id/` | GET |
| Record payment | `/api/invoices/:id/payments/` | POST |
| Refund request | `/api/invoices/:id/refund/` | POST |
| Insurance claim | `/api/invoices/:id/insurance/` | POST |
| Billing summary | `/api/billing/summary/` | GET |

### Service pattern to follow

```python
# medos/billing/metrics.py  (extend existing file)

def create_invoice_from_encounter(hospital, encounter_id, line_items):
    with transaction.atomic():
        encounter = Encounter.objects.get(id=encounter_id, hospital=hospital)
        invoice = Invoice.objects.create(
            hospital=hospital,
            patient=encounter.patient,
            encounter=encounter,
            status='draft'
        )
        for item in line_items:
            InvoiceLineItem.objects.create(invoice=invoice, **item)
        invoice.total = sum(i['amount'] for i in line_items)
        invoice.save()
        return invoice
```

### Done when

- [ ] Invoice can be created from an encounter
- [ ] Line items can be added (consultation, procedures, medications)
- [ ] Payment can be recorded against an invoice
- [ ] Invoice PDF can be generated or viewed
- [ ] Billing summary shows real revenue numbers

---

## Module 6 — Laboratory

**Why sixth:** Lab orders come from encounters. Results flow back to EMR.

### What needs to be wired

| UI Element | Endpoint | Method |
|---|---|---|
| Order lab test | `/api/lab/orders/` | POST |
| Lab order list | `/api/lab/orders/` | GET |
| Lab order detail | `/api/lab/orders/:id/` | GET |
| Enter results | `/api/lab/orders/:id/results/` | POST |
| Lab panels list | `/api/lab/panels/` | GET |
| QC entries | `/api/lab/qc/` | GET / POST |
| Lab inventory | `/api/lab/inventory/` | GET |
| Lab alerts | `/api/lab/alerts/` | GET |

### Done when

- [ ] Lab test can be ordered from an encounter
- [ ] Order appears in lab queue
- [ ] Results can be entered against an order
- [ ] Results are visible back in the patient's EMR
- [ ] Critical values trigger an alert
- [ ] QC entries can be recorded

---

## Module 7 — Pharmacy

**Why seventh:** Prescriptions come from EMR. Dispensing closes the medication loop.

### What needs to be wired

| UI Element | Endpoint | Method |
|---|---|---|
| Prescription list | `/api/pharmacy/prescriptions/` | GET |
| Dispense medication | `/api/pharmacy/prescriptions/:id/dispense/` | POST |
| Drug inventory | `/api/pharmacy/inventory/` | GET |
| DDI check | `/api/pharmacy/ddi-check/` | POST |
| Refill request | `/api/pharmacy/prescriptions/:id/refill/` | POST |

### Done when

- [ ] Prescriptions from EMR appear in pharmacy queue
- [ ] Pharmacist can mark as dispensed
- [ ] DDI check runs when a new drug is added to a prescription
- [ ] DDI warning displays clearly in both EMR and pharmacy views
- [ ] Inventory updates on dispensing

---

## Module 8 — TeleICU

**Why eighth:** ICU ward and bed setup must exist before vitals can be streamed. This is the most technically complex module — WebSocket, real-time, concurrent connections.

### What needs to be wired

| UI Element | Endpoint / Consumer | Method |
|---|---|---|
| ICU ward list | `/api/teleicu/wards/` | GET |
| ICU bed status | `/api/teleicu/wards/:id/beds/` | GET |
| Assign patient to bed | `/api/teleicu/beds/:id/assign/` | POST |
| Vitals WebSocket | `ws://localhost:8000/ws/teleicu/:ward_id/` | WebSocket |
| Vitals history | `/api/teleicu/patients/:id/vitals/` | GET |
| TeleICU session | `/api/teleicu/sessions/` | GET / POST |
| Monitored patients | `/api/teleicu/monitored/` | GET |
| Dashboard stats | `/api/teleicu/dashboard/` | GET |

### Done when

- [ ] ICU wards and beds display correctly
- [ ] Patient can be assigned to a bed
- [ ] Vitals stream over WebSocket and update in real time
- [ ] Vitals history loads for a patient
- [ ] TeleICU consult count shows in the Reports KPI card
- [ ] WebSocket reconnects automatically on disconnect

---

## Module 9 — Reports & Analytics

**Why ninth:** Every report depends on real data from all modules above. Do not wire reports against mock data — wire them last when real data exists.

### What needs to be wired

| Report | Endpoint | Data source |
|---|---|---|
| Total Revenue KPI | `/api/reports/kpis/` | Billing module |
| Patients Seen KPI | `/api/reports/kpis/` | Encounters |
| Admissions KPI | `/api/reports/kpis/` | Encounters (inpatient) |
| Lab Tests KPI | `/api/reports/kpis/` | Lab orders |
| Prescriptions KPI | `/api/reports/kpis/` | Pharmacy |
| TeleICU Consults KPI | `/api/reports/kpis/` | TeleICU sessions |
| Revenue by Department | `/api/reports/revenue/department/` | Billing |
| Revenue by Specialty | `/api/reports/revenue/specialty/` | Billing |
| Billing Reports | `/api/reports/billing/` | Billing module |
| Pharmacy Reports | `/api/reports/pharmacy/` | Pharmacy |
| Laboratory Reports | `/api/reports/lab/` | Lab module |
| EMR Reports | `/api/reports/emr/` | Encounters |
| TeleICU Reports | `/api/reports/teleicu/` | TeleICU |
| Appointments Reports | `/api/reports/appointments/` | Appointments |
| Doctors Reports | `/api/reports/doctors/` | Encounters + billing |
| Operations Reports | `/api/reports/operations/` | All modules |
| Export button | `/api/reports/export/` | POST with filter params |
| Schedule Report | `/api/reports/schedule/` | POST |

### Service pattern to follow

All report logic must go through `reports/helpers.py`. The existing pattern already exists — extend it:

```python
# medos/reports/helpers.py  (extend existing file)

def get_kpi_summary(hospital, date_from, date_to):
    return {
        "total_revenue": get_revenue_total(hospital, date_from, date_to),
        "patients_seen": get_patients_seen(hospital, date_from, date_to),
        "admissions": get_admissions(hospital, date_from, date_to),
        "lab_tests": get_lab_tests_count(hospital, date_from, date_to),
        "prescriptions": get_prescription_count(hospital, date_from, date_to),
        "teleicu_consults": get_teleicu_consult_count(hospital, date_from, date_to),
    }
```

### Done when

- [ ] All 6 KPI cards show real numbers
- [ ] Date range filter changes the numbers correctly
- [ ] Department and location filters work
- [ ] Revenue by Department chart renders with real data
- [ ] At least 3 individual report categories (Billing, Lab, EMR) fully load
- [ ] Export downloads a real file (CSV or PDF)

---

## Module 10 — Admin Panel

**Why tenth:** Works on user and role management — important but not blocking clinical workflows.

### What needs to be wired

| UI Element | Endpoint | Method |
|---|---|---|
| User list | `/api/admin/users/` | GET |
| Create user | `/api/admin/users/` | POST |
| Edit user | `/api/admin/users/:id/` | PATCH |
| Deactivate user | `/api/admin/users/:id/deactivate/` | POST |
| Role list | `/api/admin/roles/` | GET |
| Create role | `/api/admin/roles/` | POST |
| Edit role permissions | `/api/admin/roles/:id/` | PATCH |
| Department list | `/api/admin/departments/` | GET |
| Create department | `/api/admin/departments/` | POST |
| System settings | `/api/admin/settings/` | GET / PATCH |
| Audit logs | `/api/admin/audit-logs/` | GET |
| Backup management | `/api/admin/backups/` | GET / POST |

### Also fix during this module

- `canAccess()` in `permissions.ts` — remove the `return true` bypass
- Backend permission class per endpoint — `HasRolePermission`
- Header hardcoded "Administrator" label — read from auth store
- Tab visibility gating — once `canAccess()` works, verify tabs hide correctly

### Done when

- [ ] Hospital admin can create a doctor account
- [ ] New doctor can log in and sees only doctor-appropriate tabs
- [ ] Roles can be created with custom permissions
- [ ] Audit log shows real activity
- [ ] `canAccess()` reads real permissions — `return true` removed

---

## Module 11 — AI Scribe

**Why last:** Isolated from all other modules. Needs encounter context but doesn't block anything else.

### What needs to be wired

| UI Element | Endpoint | Method |
|---|---|---|
| Start recording | `/api/scribe/sessions/` | POST |
| Upload audio | `/api/scribe/sessions/:id/audio/` | POST |
| Get transcription | `/api/scribe/sessions/:id/transcript/` | GET |
| Get structured note | `/api/scribe/sessions/:id/note/` | GET |
| Apply to encounter | `/api/scribe/sessions/:id/apply/` | POST |

### Done when

- [ ] Can record audio from an encounter
- [ ] Transcription returns from Whisper
- [ ] Structured clinical note is generated
- [ ] Note can be applied to the current encounter

---

## Cross-Module Rules — Apply Everywhere

These apply to every module above without exception:

**1. No mock data in production components**
If a widget or component has a `MOCK_DATA` fallback, remove it.
Replace with a proper error state. Mock data hides real failures.

**2. Every list endpoint must be paginated**
No `objects.all()` returning unbounded lists.
Use DRF pagination. Default page size 20-50 depending on the list.

**3. Every widget needs three states**
Loading skeleton → real data → error state.
Never leave a widget blank on error. Show a message.

**4. Hospital scope on every new endpoint**
Every new ViewSet extends `HospitalScopedViewSet`.
Every new function-based view starts with:
```python
hospital = request.user.hospitaluserprofile.hospital
```

**5. Log significant actions**
Any create, update, discharge, dispense, or delete should write
a `SystemActivityLog` entry. This feeds the Live Activity Feed
and the audit trail.

---

## Definition of Done — Phase 1 Complete

Phase 1 is complete when ALL of the following are true:

- [ ] A patient can be registered, seen by a doctor, have lab tests ordered, medication dispensed, and an invoice generated — end to end without touching the database directly
- [ ] The dashboard shows real numbers for a hospital with 10+ test patients
- [ ] Reports & Analytics KPI cards show real data
- [ ] The Admin Panel can create users with different roles and those roles restrict access correctly
- [ ] No component in the app returns mock data
- [ ] No view in the backend has more than 10 lines of query logic — all logic lives in service modules
- [ ] All new endpoints follow the `View → Service → Database` pattern
