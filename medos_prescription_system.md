# MedOS — Prescription System Build Plan

> This covers the pharmacy and lab workflow for admitted patients (IPD + TeleICU).
> OPD patients are NOT affected — they get a prescription and go home, no daily management needed.
> This plan solves two problems: scale (100+ patients, flat list unmanageable) and
> the forgot-a-medication problem (no silent edits after submission).

---

## Why This Is Needed

### Right now — broken at scale

```
Encounter → Medication 1   ← loose record
            Medication 2   ← loose record
            Medication 3   ← loose record
            Lab Order 1    ← loose record
            Lab Order 2    ← loose record
```

100 patients × 7 medications = 700 individual items in the pharmacy queue.
Flat list. Pharmacist cannot tell which medications belong together,
which patient is urgent, which ward they are in. Unmanageable.

### After this plan — manageable at scale

```
Encounter → Prescription → Medication 1
                           Medication 2
                           Medication 3
                           Lab Order 1
                           Lab Order 2
```

100 patients = 100 prescriptions in the pharmacy queue.
Grouped by priority and ward. One prescription = one patient = one submission.
Pharmacist works through one at a time, clicks Dispense All, moves to the next.

---

## The Prescription Lifecycle

A prescription moves through states like a document in a workflow.
**No silent deletions. Ever.** Every change must be visible with a reason.

```
                              ┌── CANCELLED (with reason)
                              │   pharmacy sees it crossed out
DRAFT ──► ORDERED ──► IN_PROGRESS ──► DISPENSED
  │           │
  │           └── AMENDED → creates Prescription v2
  │               pharmacy sees v1 crossed out, v2 highlighted
  │
  └── (only doctor sees DRAFT — not visible to pharmacy or lab)
```

### What each state means

| State | Who sees it | What it means |
|---|---|---|
| DRAFT | Doctor only | Still writing. Pharmacy and lab cannot see it. |
| ORDERED | Everyone | Doctor submitted. Pharmacy and lab queue updated immediately. |
| IN_PROGRESS | Everyone | Pharmacist has started working on it. |
| DISPENSED | Everyone | All medications given out. Done. |
| CANCELLED | Everyone | Stopped before dispensing. Reason required. Shows crossed out. |
| AMENDED | Everyone | Doctor changed something after submitting. v1 crossed out, v2 active. |

---

## The Forgot-a-Medication Problem — Solved

### Doctor forgot to add a medication after submitting

```
Doctor opens the prescription
Clicks "Amend"
System creates Prescription v2 (copy of v1 + the new medication)
Prescription v1 → status = AMENDED, shows as crossed out in pharmacy
Prescription v2 → active, shows highlighted in pharmacy
Pharmacy sees both — knows v2 is the one to fulfil
```

### Doctor added an extra medication by mistake

```
Doctor opens the prescription
Clicks "Cancel" on that specific medication only
Types reason: "Added in error"
That one medication shows as cancelled with strikethrough
All other medications in the prescription are unaffected
Pharmacy sees the cancellation in real time via WebSocket
```

### Doctor wants to cancel the entire prescription

```
Doctor opens the prescription
Clicks "Cancel Prescription"
Types reason
All medications and lab orders in it → cancelled
Pharmacy queue removes them from active view
Shown as a cancelled block with reason — not deleted
```

---

## The Pharmacy Queue at Scale

### Before (flat list — breaks at 100+ patients)

```
700 individual medication records
No grouping, no priority, no ward context
Pharmacist mentally groups them — error-prone and slow
```

### After (grouped by prescription)

```
┌─────────────────────────────────────────────────────┐
│  Pharmacy Queue               [Search] [Filter ▼]   │
├─────────────────────────────────────────────────────┤
│ ⚡ STAT — Priority first                            │
│  Prescription #P-202 │ Dr. Mehta │ Room 3 │ 10:32  │
│  ├── Amoxicillin 500mg TID x5d          [Dispense] │
│  └── Azithromycin 250mg OD x3d          [Dispense] │
│  [Dispense All]  [Print Label]                      │
├─────────────────────────────────────────────────────┤
│ OPD Queue (12 pending)                              │
│  Prescription #P-201 │ Dr. Rao │ 10:15             │
│  ├── Paracetamol 500mg SOS                          │
│  ├── Cetirizine 10mg HS                             │
│  └── Salbutamol Inhaler PRN                         │
│  [Dispense All]                                     │
├─────────────────────────────────────────────────────┤
│ IPD Ward 3A (8 pending)                             │
│  Prescription #P-200 │ Bed 12 │ Dr. Khan │ 09:30   │
│  ├── Paracetamol 500mg TDS                          │
│  └── Ceftriaxone 1g IV BD                           │
│  [Dispense All]                                     │
└─────────────────────────────────────────────────────┘
```

Queue features:
- Grouped by prescription — not flat individual medications
- Priority sorting: STAT → URGENT → ROUTINE
- Grouped by location: OPD / IPD Ward / TeleICU
- Batch dispense — one click for all medications in a prescription
- Real-time updates via WebSocket — new/amended/cancelled prescriptions appear instantly
- Status badges — PENDING (grey), IN_PROGRESS (blue), DISPENSED (green),
  CANCELLED (red strikethrough), AMENDED (amber, shows v1 crossed out + v2)

---

## How AI Scribe Connects in V1

In V1, AI Scribe fills only the clinical fields — not medications or lab tests.
There is no direct connection between AI Scribe and the prescription system in V1.

```
Doctor dictates
        ↓
AI fills ONLY:
  - Chief complaints
  - Clinical notes / summary
  - Everything else → blank / None
        ↓
Doctor manually adds medications using the + button
Doctor manually adds lab tests using the + button
Each + click attaches to the draft prescription automatically
        ↓
Doctor reviews the full form
        ↓
Doctor clicks Submit
Prescription → status = ORDERED
        ↓
Pharmacy and lab queues update immediately
```

The + button is the only way medications and lab tests enter the prescription in V1.
AI Scribe does not touch the prescription system at all.

### V2 (Future — not in this build)

AI extracts medication and lab test suggestions from the transcript
and pre-populates the form as suggestions. Doctor approves each one individually.
Nothing is added without doctor confirmation. This is a V2 feature.

---

> ## ⚠️ The One Rule That Protects the Codebase
>
> Every function written during this build must follow the same pattern
> the architecture review enforced across the entire codebase:
>
> ```
> View (3-10 lines) → Service function → Database
> ```
>
> **Never write query logic in a view.**
>
> The prescription service functions belong in `pharmacy/services.py`.
> The views in `views/pharmacy.py` call the service and return the response.
> If you are writing more than 10 lines in a view, stop and extract a service function.

---

## Build Phases — P1 to P8

---

### P1 — Prescription Model + Migration

**What:** Create the Prescription model that groups all medications and lab orders.

**File:** `backend/medos/models.py`

```python
class Prescription(models.Model):

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        ORDERED = 'ORDERED', 'Ordered'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        DISPENSED = 'DISPENSED', 'Dispensed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        AMENDED = 'AMENDED', 'Amended'

    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE)
    encounter = models.ForeignKey(Encounter, on_delete=models.CASCADE,
                                  related_name='prescriptions')
    status = models.CharField(max_length=20, choices=Status.choices,
                               default=Status.DRAFT)
    version = models.PositiveIntegerField(default=1)
    superseded_by = models.ForeignKey('self', null=True, blank=True,
                                       on_delete=models.SET_NULL,
                                       related_name='supersedes')
    ordered_by = models.ForeignKey(User, on_delete=models.CASCADE)
    ordered_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    pharmacy_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'medos_prescription'
        ordering = ['-created_at']
```

Run migration:
```bash
python manage.py makemigrations
python manage.py migrate
```

**Done when:** Prescription table exists in the database with all fields.

---

### P2 — Add Prescription FK to Medication and LabOrder

**What:** Link existing models to the new Prescription.
Make the FK nullable for backward compatibility — existing records are not broken.

**File:** `backend/medos/models.py`

```python
class Medication(models.Model):
    prescription = models.ForeignKey(
        Prescription,
        null=True,       # nullable — backward compatible with existing records
        blank=True,
        on_delete=models.SET_NULL,
        related_name='medications'
    )
    is_active = models.BooleanField(default=True)      # ADD THIS
    cancellation_reason = models.TextField(blank=True)  # ADD THIS
    # ... rest of existing fields unchanged

class LabOrder(models.Model):
    prescription = models.ForeignKey(
        Prescription,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='lab_orders'
    )
    # ... rest of existing fields unchanged
```

Run migration again after adding the FKs.

**Done when:** Existing medications and lab orders still work. New ones can be linked to a prescription.

---

### P3 — Update Endpoints to Group Under a Prescription

**What:** When a doctor adds a medication or lab order, it auto-creates or attaches
to a prescription for that encounter. The prescription starts as DRAFT.

**File:** `backend/medos/pharmacy/services.py` (create this file)

```python
def get_or_create_draft_prescription(encounter, ordered_by):
    """
    Gets the current DRAFT prescription for this encounter,
    or creates one if none exists.
    One draft at a time per encounter.
    """
    prescription, created = Prescription.objects.get_or_create(
        encounter=encounter,
        hospital=encounter.hospital,
        status=Prescription.Status.DRAFT,
        defaults={
            'ordered_by': ordered_by,
            'version': get_next_version(encounter)
        }
    )
    return prescription


def add_medication_to_prescription(encounter, medication_data, ordered_by):
    prescription = get_or_create_draft_prescription(encounter, ordered_by)
    medication = Medication.objects.create(
        prescription=prescription,
        hospital=encounter.hospital,
        encounter=encounter,
        **medication_data
    )
    return medication


def submit_prescription(prescription_id, hospital):
    """
    Doctor clicks Submit. Prescription becomes ORDERED.
    Pharmacy and lab queues update immediately.
    """
    with transaction.atomic():
        prescription = Prescription.objects.get(
            id=prescription_id,
            hospital=hospital,
            status=Prescription.Status.DRAFT
        )
        prescription.status = Prescription.Status.ORDERED
        prescription.ordered_at = timezone.now()
        prescription.save()

        # Notify pharmacy and lab via WebSocket
        notify_queues(prescription)

        SystemActivityLog.objects.create(
            hospital=hospital,
            action='prescription_submitted',
            user=prescription.ordered_by,
            entity_id=str(prescription.id)
        )
        return prescription
```

**Done when:** Adding a medication through the EMR automatically creates or attaches to a draft prescription. Submitting moves it to ORDERED.

---

### P4 — Amend and Cancel Actions

**What:** Doctor can amend or cancel after submission. No silent deletions.

**File:** `backend/medos/pharmacy/services.py` (extend the same file)

```python
def amend_prescription(prescription_id, changes, hospital, amended_by):
    """
    Creates a new version of the prescription with the doctor's changes.
    Old version is marked AMENDED and linked to the new one.
    """
    with transaction.atomic():
        original = Prescription.objects.get(
            id=prescription_id,
            hospital=hospital
        )

        # Create new version
        new_prescription = Prescription.objects.create(
            hospital=hospital,
            encounter=original.encounter,
            status=Prescription.Status.ORDERED,
            version=original.version + 1,
            ordered_by=amended_by,
            ordered_at=timezone.now()
        )

        # Copy medications from original + apply changes
        for med in original.medications.filter(is_active=True):
            Medication.objects.create(
                prescription=new_prescription,
                hospital=hospital,
                encounter=original.encounter,
                drug_name=med.drug_name,
                dose=changes.get(str(med.id), {}).get('dose', med.dose),
                frequency=med.frequency,
                route=med.route,
            )

        # Mark original as amended
        original.status = Prescription.Status.AMENDED
        original.superseded_by = new_prescription
        original.save()

        notify_queues(new_prescription)
        return new_prescription


def cancel_single_medication(medication_id, reason, hospital):
    """
    Cancels one medication inside a prescription.
    Other medications in the same prescription are unaffected.
    """
    medication = Medication.objects.get(
        id=medication_id,
        hospital=hospital
    )
    medication.is_active = False
    medication.cancellation_reason = reason
    medication.save()

    # Notify pharmacy in real time
    notify_medication_cancelled(medication)


def cancel_prescription(prescription_id, reason, hospital):
    """
    Cancels the entire prescription.
    All medications and lab orders inside it are cancelled.
    """
    with transaction.atomic():
        prescription = Prescription.objects.get(
            id=prescription_id,
            hospital=hospital
        )
        prescription.status = Prescription.Status.CANCELLED
        prescription.cancellation_reason = reason
        prescription.save()

        prescription.medications.update(
            is_active=False,
            cancellation_reason=reason
        )
        prescription.lab_orders.update(status='CANCELLED')

        notify_prescription_cancelled(prescription)
```

**Done when:** Doctor can amend (creates v2) and cancel (single med or full prescription) with a reason. Pharmacy sees changes in real time.

---

### P5 — Rewrite Pharmacy Queue — Grouped by Prescription

**What:** Replace the flat medication list with prescriptions grouped by
priority and location.

**File:** `backend/medos/pharmacy/services.py`

```python
def get_pharmacy_queue(hospital):
    """
    Returns active prescriptions grouped by priority and location.
    Only ORDERED and IN_PROGRESS prescriptions are shown.
    """
    active = Prescription.objects.filter(
        hospital=hospital,
        status__in=[
            Prescription.Status.ORDERED,
            Prescription.Status.IN_PROGRESS
        ]
    ).prefetch_related(
        'medications',
        'lab_orders',
        'encounter__patient',
        'ordered_by'
    ).order_by('encounter__priority', 'ordered_at')

    return {
        'stat': active.filter(encounter__priority='STAT'),
        'urgent': active.filter(encounter__priority='URGENT'),
        'opd': active.filter(encounter__encounter_type='outpatient'),
        'ipd': active.filter(encounter__encounter_type='inpatient'),
        'teleicu': active.filter(encounter__encounter_type='teleicu'),
    }
```

**Frontend:** Rewrite the pharmacy queue page to render prescriptions
grouped by the sections above. Each prescription shows:
- Patient name + bed/room
- Doctor name + time submitted
- List of medications with individual Dispense buttons
- Dispense All button for the whole prescription
- Status badge (colour-coded)
- Amended prescriptions show v1 crossed out + v2 highlighted

**Done when:** Pharmacy queue shows prescriptions grouped by priority and ward. Flat list is gone.

---

### P6 — Rewrite Lab Queue — Mirror of Pharmacy

**What:** Lab queue groups lab orders by prescription, same pattern as pharmacy.

```
Lab Queue grouped by prescription:
  ├── STAT orders first
  ├── Per prescription: patient name, bed, doctor, time
  ├── List of lab tests with [Collect Sample] per test
  ├── [Collect All Samples] for the whole prescription
  └── Status: ORDERED → SAMPLE_COLLECTED → IN_PROGRESS → COMPLETED
```

**Done when:** Lab queue works the same way as pharmacy queue — grouped, prioritised, real-time.

---

### P7 — WebSocket Push for Real-Time Queue Updates

**What:** When a prescription is submitted, amended, or cancelled,
pharmacy and lab see the update immediately — no page refresh needed.

**File:** `backend/medos/consumers.py` (extend existing consumers)

```python
async def notify_queues(prescription):
    channel_layer = get_channel_layer()

    # Notify pharmacy
    await channel_layer.group_send(
        f"pharmacy_{prescription.hospital_id}",
        {
            "type": "prescription.update",
            "prescription_id": str(prescription.id),
            "status": prescription.status,
            "action": "new"  # or "amended" or "cancelled"
        }
    )

    # Notify lab
    await channel_layer.group_send(
        f"lab_{prescription.hospital_id}",
        {
            "type": "prescription.update",
            "prescription_id": str(prescription.id),
            "status": prescription.status,
            "action": "new"
        }
    )
```

Frontend pharmacy and lab queue pages connect to their WebSocket channel
and update the queue in real time when a message arrives — add new prescription,
cross out cancelled, highlight amended v2.

**Done when:** Pharmacist sees a new prescription appear in the queue the moment the doctor clicks Submit, without refreshing the page.

---

### P8 — AI Scribe (V1 — No Change to Prescription Flow)

**What:** No integration work needed between AI Scribe and the prescription
system in V1.

In V1 AI Scribe fills only chief complaints and clinical notes.
Medications and lab tests are added manually by the doctor using the + button.
Each + click attaches to the draft prescription automatically via P3.
The prescription system works identically whether the doctor used AI Scribe or not.

**V1 flow:**
```
Doctor dictates → AI fills complaints + notes only
Doctor clicks + Medication → attaches to draft prescription (P3 handles this)
Doctor clicks + Lab Test   → attaches to draft prescription (P3 handles this)
Doctor clicks Submit       → prescription becomes ORDERED (P3 handles this)
```

**No additional backend or frontend work needed for V1.**

**V2 (Future — do not build now):**
AI extracts medication and lab suggestions from the transcript.
Doctor approves each suggestion individually before it enters the prescription.
This is a separate feature planned for after the pilot clinic.

**Done when:** Nothing to build. P1–P7 cover the full prescription system.
AI Scribe works alongside it without any changes.

---

## Design Decision — Prescription FK Required or Optional?

| Option | Pro | Con |
|---|---|---|
| Required (not null) | Every medication belongs to a prescription — clean queues | Must backfill all existing records immediately |
| Optional (null allowed) | Backward compatible — existing records untouched | Some old medications are "orphaned" outside a prescription |

**Recommendation: Make it nullable now.**

Build all new medications through the prescription flow from today.
After P1-P8 are complete, run a one-time backfill script:

```python
# One-time script — run after all 8 phases are complete
# Wraps all old loose medications into auto-generated prescriptions

for encounter in Encounter.objects.filter(prescriptions__isnull=True):
    old_meds = Medication.objects.filter(encounter=encounter, prescription__isnull=True)
    if old_meds.exists():
        prescription = Prescription.objects.create(
            hospital=encounter.hospital,
            encounter=encounter,
            status=Prescription.Status.DISPENSED,  # already done
            ordered_by=encounter.created_by,
            version=1
        )
        old_meds.update(prescription=prescription)
```

Zero downtime. Zero broken existing records.

---

## Session Plan for Your Team

| Session | Phases | What gets built |
|---|---|---|
| Session 1 | P1 + P2 + P3 | Prescription model, FK on Medication and LabOrder, endpoint updates to auto-group via + button |
| Session 2 | P4 | Amend and cancel service functions — the most important session |
| Session 3 | P5 + P6 | Pharmacy queue and lab queue rewritten — grouped, prioritised |
| Session 4 | P7 | WebSocket real-time updates for pharmacy and lab |

> P8 (AI Scribe integration) is removed from V1 scope.
> AI Scribe fills complaints and notes only. Medications and lab tests
> are added manually. No prescription system changes needed for AI Scribe in V1.

---

## What to Tell Your Team

> We are adding a Prescription model that groups all medications and lab
> orders that a doctor orders at the same time using the + button in the EMR form.
> A prescription moves through states — Draft, Ordered, Dispensed — and can be
> Amended or Cancelled after submission, always with a reason and a full visible
> history. The pharmacy and lab queues will show prescriptions grouped by priority
> and ward instead of individual medications. Nothing reaches pharmacy without the
> doctor explicitly clicking Submit. No silent deletions. Ever.
>
> AI Scribe in V1 fills only chief complaints and clinical notes.
> Medications and lab tests are still added manually using the + button.
> AI Scribe has no connection to the prescription system in V1.

---

## Definition of Done — Prescription System Complete (V1)

- [ ] Prescription model exists with all lifecycle states
- [ ] Clicking + Medication in EMR automatically creates or attaches to a draft prescription
- [ ] Clicking + Lab Test in EMR automatically creates or attaches to a draft prescription
- [ ] Doctor can submit a prescription — pharmacy and lab queue update immediately
- [ ] Doctor can amend a submitted prescription — creates v2, v1 shows crossed out
- [ ] Doctor can cancel a single medication with a reason
- [ ] Doctor can cancel an entire prescription with a reason
- [ ] Pharmacy queue is grouped by prescription with priority and ward sorting
- [ ] Lab queue mirrors pharmacy queue
- [ ] Changes appear in pharmacy and lab in real time via WebSocket
- [ ] No medication can be silently deleted — all changes have a reason and audit trail
- [ ] AI Scribe works alongside the system without changes — fills complaints and notes only
