# MedOS — Ward / IPD Module Gap

> The sidebar has TeleICU but no Ward/IPD module.
> Patients admitted to general wards, surgical wards, and maternity wards
> have no home in the current navigation.
> This must be planned and built before the billing plan is finalised
> because IPD billing depends on ward management.

---

## What Is Missing

TeleICU handles ICU patients with real-time vitals monitoring.
But most admitted patients are NOT in ICU. They are in:

- General ward
- Surgical ward
- Maternity ward
- Paediatric ward
- Orthopaedic ward
- Private / semi-private rooms

These patients have no dedicated module right now. A nurse managing a
general ward patient would have to dig through EMR — which is doctor-facing,
not nurse-facing. That is the gap.

---

## Who Uses This Module

| Role | What they need |
|---|---|
| Doctor | Morning rounds, submit daily orders, view patient progress |
| Nurse | Medication administration, vitals entry, nursing notes, patient status |
| Admin | Ward occupancy, bed management, transfer between wards |
| Billing | Bed charge accrual, length of stay, discharge clearance |

---

## What the Ward / IPD Module Contains

### 1. Ward Overview (Bed Map)

The first screen a nurse or doctor sees when they open the Ward tab.

```
┌─────────────────────────────────────────────────────────┐
│  General Ward — 3A                    [+ Admit Patient] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Bed 1   🟢 Ramesh K.     Day 3   [View] [Round]       │
│  Bed 2   🟢 Priya S.      Day 1   [View] [Round]       │
│  Bed 3   ⬜ Available                [Assign]           │
│  Bed 4   🟡 Rajan M.      Day 5   [View] [Round]       │
│           (Pending discharge)                           │
│  Bed 5   🔴 Sunita P.     Day 2   [View] [Round]       │
│           (Critical — needs attention)                  │
│  Bed 6   ⬜ Available                [Assign]           │
│                                                         │
│  Occupied: 4 / 6    Available: 2                        │
└─────────────────────────────────────────────────────────┘
```

Bed status colours:
- 🟢 Green — stable, normal
- 🟡 Yellow — pending discharge or needs review
- 🔴 Red — critical, flagged by nurse or doctor
- ⬜ White — available

---

### 2. Patient Ward View (Per Patient)

When a nurse or doctor clicks View on a bed:

```
┌─────────────────────────────────────────────────────────┐
│  Ramesh Kumar — Bed 3A-01 — Admitted Day 3              │
│  Diagnosis: Community Acquired Pneumonia                │
├─────────────────────────────────────────────────────────┤
│  VITALS (last recorded 2 hours ago)                     │
│  BP: 120/80   Temp: 98.6°F   SpO2: 97%   HR: 82        │
│  [Record Vitals]                                        │
├─────────────────────────────────────────────────────────┤
│  TODAY'S ORDERS (Dr. Mehta — 08:30am)                  │
│  Medications:                                           │
│  ✓ Paracetamol 500mg TDS       DISPENSED               │
│  ⏳ Amoxicillin 250mg BD        PENDING                 │
│                                                         │
│  Lab Tests:                                             │
│  ✓ CBC                          COMPLETED — View result │
│  ⏳ Blood Culture                IN PROGRESS            │
├─────────────────────────────────────────────────────────┤
│  NURSING NOTES                                          │
│  08:00 — Patient had breakfast, tolerated well          │
│  06:30 — Vitals recorded, stable                        │
│  [Add Nursing Note]                                     │
├─────────────────────────────────────────────────────────┤
│  ACCRUED BILLING (3 days)                               │
│  Day 1: ₹1,840   Day 2: ₹1,340   Day 3: ₹340 so far   │
│  Running Total: ₹3,520                                  │
├─────────────────────────────────────────────────────────┤
│  [Start Morning Round]  [Request Transfer]  [Discharge] │
└─────────────────────────────────────────────────────────┘
```

---

### 3. Morning Round Screen

When a doctor clicks Round on a bed — this is the hybrid copy/paste daily order screen.

```
┌─────────────────────────────────────────────────────────┐
│  Morning Round — Ramesh Kumar — Day 3 — 20 Jun 2026    │
├─────────────────────────────────────────────────────────┤
│  Yesterday's Orders (pre-loaded):                       │
│                                                         │
│  MEDICATIONS                                            │
│  ✓ Paracetamol 500mg TDS     [keep] [modify] [remove]  │
│  ✓ Amoxicillin 250mg BD      [keep] [modify] [remove]  │
│  + Add Medication                                       │
│                                                         │
│  LAB TESTS                                              │
│  ✓ CBC                        [keep] [remove]           │
│  + Add Lab Test                                         │
│                                                         │
│  DOCTOR'S NOTES                                         │
│  Patient improving. Continue current management.        │
│  ___________________________________                    │
│                                                         │
│  [Copy All from Yesterday]   [Submit Round]             │
└─────────────────────────────────────────────────────────┘
```

Clicking Submit Round triggers `finalise_round()` service:
- Creates dispensation queue entries for pharmacy
- Creates lab order queue entries for lab
- Adds billing accrual entries for the day

---

### 4. Nursing Station View

A dedicated view for nurses — not the same as the doctor's EMR.

```
┌─────────────────────────────────────────────────────────┐
│  Nursing Station — Ward 3A        20 Jun 2026 — 09:00  │
├─────────────────────────────────────────────────────────┤
│  PENDING MEDICATION ADMINISTRATION                      │
│  Bed 1 — Ramesh — Paracetamol 500mg (Morning dose)     │
│    [Mark Administered]                                  │
│  Bed 4 — Rajan — Metoprolol 50mg (Morning dose)        │
│    [Mark Administered]                                  │
├─────────────────────────────────────────────────────────┤
│  VITALS DUE (not recorded in last 4 hours)              │
│  Bed 2 — Priya — last recorded 5 hours ago  [Record]   │
│  Bed 5 — Sunita — last recorded 6 hours ago [Record]   │
├─────────────────────────────────────────────────────────┤
│  PENDING NURSING TASKS                                  │
│  Bed 1 — Wound dressing due (09:00)         [Done]     │
│  Bed 4 — IV line check due (10:00)          [Done]     │
├─────────────────────────────────────────────────────────┤
│  ALERTS                                                 │
│  🔴 Bed 5 — Sunita — SpO2 dropped to 92% at 07:30     │
│     [View Patient]  [Notify Doctor]                     │
└─────────────────────────────────────────────────────────┘
```

This is different from the doctor's view. Nurse sees tasks, vitals due, medication administration — not clinical notes or diagnoses.

---

### 5. Bed Management (Admin)

Admin manages the physical bed setup. Done once during hospital configuration.

```
Ward Setup:
  General Ward 3A — 6 beds
  General Ward 3B — 8 beds
  Surgical Ward   — 10 beds
  Maternity Ward  — 6 beds
  Private Rooms   — 4 rooms

Each ward/room has:
  - Bed charge per day (feeds billing automatically)
  - Ward type (general / surgical / private / ICU)
  - Assigned doctors (who has access to this ward)
  - Assigned nurses (who manages this ward)
```

---

### 6. Transfer Between Wards

Patient moves from General Ward to ICU or vice versa:

```
Current ward doctor clicks [Request Transfer]
Selects: destination ward + reason
        ↓
Destination ward doctor/admin approves
        ↓
Patient encounter continues (same encounter ID)
Ward changes from General → ICU
Bed charge changes automatically (ICU rate vs ward rate)
Transfer logged in SystemActivityLog
```

Key: The encounter does not restart. Same encounter, different location.
Billing accrual automatically picks up the new bed charge rate.

---

### 7. Discharge Workflow

```
Doctor clicks [Discharge] on patient
        ↓
Fills discharge summary:
  - Discharge diagnosis
  - Condition at discharge
  - Follow-up instructions
  - Medications to continue at home (discharge prescription)
        ↓
System checks:
  - All pending lab results received?
  - Any pending pharmacy items?
  - Billing cleared?
        ↓
If all clear:
  Encounter status → DISCHARGED
  Bed status → Available
  Billing staff notified to generate final invoice
  Discharge summary PDF generated
        ↓
Patient collects discharge summary + final invoice
Pays at billing counter
Leaves
```

If billing is not cleared — system blocks discharge.
Doctor cannot discharge until billing gives clearance.
This prevents patients leaving with unpaid bills.

---

## Data Models Needed

### Ward and Bed

```python
class Ward(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)       # "General Ward 3A"
    ward_type = models.CharField(max_length=50,
        choices=[
            ('general', 'General'),
            ('surgical', 'Surgical'),
            ('maternity', 'Maternity'),
            ('paediatric', 'Paediatric'),
            ('private', 'Private'),
            ('icu', 'ICU'),            # non-tele ICU
        ]
    )
    bed_charge_per_day = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'medos_ward'


class Bed(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    ward = models.ForeignKey(Ward, on_delete=models.CASCADE,
                              related_name='beds')
    bed_number = models.CharField(max_length=20)   # "3A-01"

    class Status(models.TextChoices):
        AVAILABLE = 'available', 'Available'
        OCCUPIED = 'occupied', 'Occupied'
        RESERVED = 'reserved', 'Reserved'
        MAINTENANCE = 'maintenance', 'Maintenance'

    status = models.CharField(max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE
    )
    current_encounter = models.OneToOneField(
        'Encounter',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_bed'
    )

    class Meta:
        db_table = 'medos_bed'
        unique_together = ['ward', 'bed_number']
```

### Daily Round (connects Ward to Prescription System)

```python
class DailyRound(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    encounter = models.ForeignKey('Encounter', on_delete=models.CASCADE,
                                   related_name='daily_rounds')
    round_date = models.DateField()
    conducted_by = models.ForeignKey(User, on_delete=models.CASCADE)
    prescription = models.OneToOneField(
        'Prescription',
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20,
        choices=[
            ('draft', 'Draft'),
            ('finalised', 'Finalised'),
        ],
        default='draft'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'medos_dailyround'
        # One round per patient per day for non-ICU
        # ICU allows multiple (handled in service layer)
```

### Nursing Record

```python
class NursingNote(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    encounter = models.ForeignKey('Encounter', on_delete=models.CASCADE,
                                   related_name='nursing_notes')
    recorded_by = models.ForeignKey(User, on_delete=models.CASCADE)
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'medos_nursingnote'


class MedicationAdministration(models.Model):
    """
    Records when a nurse actually gives a medication to the patient.
    Different from Dispensation (pharmacy gave it to the ward).
    """
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    encounter = models.ForeignKey('Encounter', on_delete=models.CASCADE)
    medication = models.ForeignKey('Medication', on_delete=models.CASCADE)
    administered_by = models.ForeignKey(User, on_delete=models.CASCADE)
    administered_at = models.DateTimeField()
    dose_given = models.CharField(max_length=100)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'medos_medicationadministration'
```

---

## How Ward/IPD Connects to Everything Else

```
Ward Module
    │
    ├── Connects to Prescription System
    │   Morning round → submit orders → prescription ORDERED
    │   Pharmacy queue updates immediately
    │   Lab queue updates immediately
    │
    ├── Connects to Billing
    │   Bed charge accrues daily (midnight Celery task)
    │   Medications accrued when dispensed
    │   Lab tests accrued when completed
    │   Discharge blocked until billing cleared
    │
    ├── Connects to TeleICU
    │   Transfer from Ward → ICU changes bed charge rate
    │   Same encounter continues, new location
    │   TeleICU vitals monitoring starts on transfer
    │
    ├── Connects to EMR
    │   Doctor's clinical notes live in EMR
    │   Ward module shows a read-only summary
    │   Nurse cannot edit EMR — only nursing notes
    │
    └── Connects to Dashboard
        Bed occupancy widget
        Pending vitals alerts
        Today's discharges
        Ward capacity overview
```

---

## Build Order for Ward / IPD

| Step | What | Why |
|---|---|---|
| 1 | Ward + Bed models + migration | Foundation |
| 2 | Bed assignment on admission | Patient gets a bed when admitted |
| 3 | Bed map UI (ward overview) | Nurse and doctor see ward at a glance |
| 4 | Patient ward view | Per-patient status, vitals, orders |
| 5 | Morning round screen + `finalise_round()` service | Daily orders → pharmacy + lab queues |
| 6 | Nursing station view | Nurse-specific tasks and medication administration |
| 7 | `MedicationAdministration` model | Track when nurse gives medication to patient |
| 8 | Transfer workflow | Patient moves between wards |
| 9 | Discharge workflow | Billing clearance check + discharge summary |
| 10 | Bed charge Celery task | Auto-accrues bed charge at midnight every day |

---

## Sidebar Update

Add Ward / IPD between Appointments and TeleICU:

```
Dashboard
EMR
Patient Registration
Appointments
Ward / IPD           ← ADD THIS
TeleICU
Pharmacy
Billing
Laboratory
AI Scribe
Reports & Analytics
Admin Panel
System Settings
```

---

## Role Access for Ward / IPD

| Role | Access | What they can do |
|---|---|---|
| Doctor | Full | Morning rounds, submit orders, discharge, transfer |
| Nurse | Full | Vitals, nursing notes, medication administration, bed map |
| Admin | Full | Bed setup, ward configuration, occupancy overview |
| Receptionist | Read | Bed availability for admission |
| Billing | Read | Accrual view, discharge clearance |
| Pharmacist | None | — |
| Lab Tech | None | — |

---

## Definition of Done — Ward / IPD Complete

- [ ] Ward and Bed models exist with hospital FK
- [ ] Patient is assigned a bed on IPD admission
- [ ] Bed map shows real-time occupancy with colour-coded status
- [ ] Doctor can conduct morning rounds with copy-from-yesterday
- [ ] Submitting a round creates pharmacy and lab queue entries
- [ ] Nurse sees pending medication administration tasks
- [ ] Nurse can record vitals and nursing notes
- [ ] Nurse can mark medications as administered
- [ ] Bed charge accrues automatically at midnight via Celery
- [ ] Transfer between wards works without restarting the encounter
- [ ] Discharge is blocked until billing staff gives clearance
- [ ] Discharge summary PDF is generated on discharge
- [ ] Ward / IPD tab added to sidebar, gated by role permissions
