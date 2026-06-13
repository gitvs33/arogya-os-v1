# Clinical Pipeline: Unified Plan (All Tiers, All Visit Types, Walk-ins)

## Problem Statement

**You said it clearly:** The core clinical flow is the same across all subscription tiers:

```
Doctor writes medicines (from pharmacy stock) + tests (if needed)
  → Orders appear at Pharmacy & Lab
    → Billing collects everything
```

This flow must work for **all visit types** (OPD, IPD, TeleICU) and handle **walk-in edge cases** (patient comes only for lab or only for pharmacy, with referral from another doctor).

---

## One Pipeline — Three Input Methods

```
┌─────────────────────────────────────────────────────────────────────┐
│                        THE PIPELINE (same for all)                 │
└─────────────────────────────────────────────────────────────────────┘

INPUT ──▶ DOCTOR ORDERS ──▶ PHARMACY/LAB ──▶ BILLING ──▶ PAYMENT
             │
             ├── Medication records (selected from DrugInventory stock)
             ├── LabOrder records (selected from TestPanel catalog)
             └── Consultation/Procedure fees (by department rate)
```

| Tier | How Orders Enter the Pipeline | Available Modules |
|---|---|---|
| **Basic** | Doctor manually creates Medications via Prescriptions UI | Pharmacy + Billing only |
| **Professional** | Doctor manually creates Medications + LabOrders | Pharmacy + Lab + Billing |
| **Enterprise** | Doctor can use **AI Scribe** which auto-extracts orders from note text, OR enter manually | All modules + AI |

The pipeline **structure** is identical. Only the INPUT METHOD changes.

---

## Visit Type Support

| Visit Type | How Orders Are Created | When Billing Happens | Special Considerations |
|---|---|---|---|
| **OPD** | During consultation, doctor prescribes drugs + tests | At checkout (end of visit) | Single session, one invoice |
| **IPD** | During daily rounds, doctor prescribes daily meds/tests | At discharge (items accrue) | Multi-day, items accrue → single discharge invoice |
| **TeleICU** | Remote specialist prescribes for remote hospital | Periodic (daily/weekly cycles) | Orders created at remote hospital's pharmacy/lab |
| **Walk-in Lab** | Reception/Lab creates LabOrder directly (no doctor) | At time of service | Uses external referral — no Encounter needed |
| **Walk-in Pharmacy** | Pharmacy creates Dispensation directly (no doctor) | At time of sale | Uses external prescription — no Encounter needed |

---

## Data Model: What's Needed

### Current State

| Model | encounter FK | Walk-in Possible? |
|---|---|---|
| `Medication` | **REQUIRED** (no null) | ❌ Must change to nullable |
| `LabOrder` | Nullable ✅ | ✅ Already works |
| `Dispensation` | Nullable ✅ | ✅ Already works |
| `Invoice` | Nullable ✅ | ✅ Already works |

### Required Changes

1. **Medication.encounter → nullable** — needed for walk-in pharmacy (patient has external prescription, no encounter at this hospital)
2. **Add `WALKIN` and `TELEICU` to `Invoice.INVOICE_TYPES`** — currently only `OPD`, `PHARMACY`, `LAB`, `IPD`. Need `WALKIN` for standalone services and `TELEICU` for TeleICU billing cycles.

### Walk-in Flow (no encounter)

```
Walk-in Pharmacy (has external prescription)
  → Patient looked up (or created)
  → Dispensation created directly (patient + drug + qty)
    → Pharmacy decrements DrugInventory
      → Invoice created with invoice_type='PHARMACY' (encounter=null)

Walk-in Lab (has external referral)
  → Patient looked up (or created)
  → LabOrder created directly (patient + test panel)
    → Lab processes → reports results
      → Invoice created with invoice_type='LAB' (encounter=null)
```

Both flows bypass the Encounter entirely. The existing nullable FKs on `Dispensation`, `LabOrder`, and `Invoice` already support this. Only `Medication.encounter` needs to be made nullable.

---

## Tier Feature Gates

Applied to the actual views (not defined but unused as today):

| View | Gate | Available In |
|---|---|---|
| `views/pharmacy.py` — DrugViewSet, DrugInventoryViewSet, DispensationViewSet | `'pharmacy'` | All tiers |
| `views/lab/` — all 9 viewsets | `'laboratory'` | Professional + Enterprise |
| `views/teleicu.py` — TeleICU views | `'teleicu'` | Professional + Enterprise |
| `views/scribe.py` — care_scribe endpoints | `'scribe'` | Enterprise only |
| `extract-prescriptions` (Phase 1 new endpoint) | `'scribe'` | Enterprise only |
| `extract-lab-orders` (Phase 2 new endpoint) | `'scribe'` | Enterprise only |
| `generate-invoice` (Phase 3 new endpoint) | `'billing'` | All tiers |

The **Billing** feature is in all tiers. The **prescription writing** UI is a core clinical tool — it's available in all tiers (it's part of `'pharmacy'`, which is in all tiers). The only thing exclusive to Enterprise is AI Scribe auto-extraction.

---

## Detailed Flow Per Visit Type

### OPD — Outpatient

```
Patient arrives
  → Registration (Patient created if new)
    → Encounter created (type=OPD, status=IN_PROGRESS)
      → Triage: vitals recorded
        → DOCTOR VISIT:
            a) Doctor uses Prescriptions UI → selects drugs from DrugInventory → Creates Medication records
            b) Doctor uses Lab Order UI → selects tests from TestPanel → Creates LabOrder records
            c) Doctor uses AI Scribe (Enterprise only) → speaks → note generated
               → Optional: auto-extract drugs/tests from note → Medication/LabOrder created
          ↓
        Orders appear in Pharmacy dashboard (pending Medications)
        Orders appear in Lab dashboard (pending LabOrders)
          ↓
        Pharmacy dispenses → Dispensation created → DrugInventory decremented
        Lab processes → results reported
          ↓
        CHECKOUT:
          → "Generate Invoice" (one-click or manual)
            → Collects: consultation fee + all Medications + all LabOrders
            → Creates Invoice (invoice_type='OPD')
              → Payment collected → Encounter status = COMPLETED
```

### IPD — Inpatient

```
Patient admitted
  → Encounter created (type=IPD, status=IN_PROGRESS, bed assigned)
    → Day 1: Doctor rounds
        → Prescriptions + Lab Orders created (same UI as OPD)
        → Pharmacy dispenses
        → Lab processes
    → Day 2: Doctor rounds
        → More prescriptions + lab orders
        → More dispensations
    → ... (repeat per day)
      ↓
    DISCHARGE:
      → "Generate Invoice"
        → Collects: admission fee + all Medications (all days) + all LabOrders (all days) + bed charges (days × rate)
        → Creates Invoice (invoice_type='IPD')
          → Payment collected → Encounter status = COMPLETED
```

**Key difference from OPD:** Items accumulate over multiple days. The "Generate Invoice" action at discharge sums everything.

### TeleICU — Remote ICU Monitoring

```
Remote hospital refers patient
  → Encounter created (type=TELEICU, status=IN_PROGRESS)
  → TeleICUSession created (is_active=True)
    → Remote specialist reviews vitals stream
      → Remote rounds (via video/phone):
          → Specialist prescribes: Medications + LabOrders
            → Orders appear at REMOTE HOSPITAL's Pharmacy & Lab
              → Remote pharmacy dispenses
              → Remote lab processes
                ↓
    BILLING CYCLE (every N days — configurable per hospital):
      → "Generate Invoice" (periodic)
        → Collects: TeleICU monitoring fee (N days × daily rate)
          + any Medications + LabOrders from that period
        → Creates Invoice (invoice_type='TELEICU')
          → Payment collected (from remote hospital or insurer)
            → Session remains ACTIVE — billing repeats next cycle
      ↓
    DISCHARGE (when remote monitoring ends):
      → TeleICUSession.is_active = False
      → Encounter status = COMPLETED
      → Final invoice for any remaining items
```

**Key difference from OPD/IPD:** Billing happens periodically while encounter is still ACTIVE. Multiple invoices per encounter.

### Walk-in Lab

```
Patient arrives with referral from external doctor
  → Patient looked up (or registered)
    → NO ENCOUNTER CREATED
      → Lab creates LabOrder directly (patient + test panel)
        → Lab processes sample → reports result
          → Invoice created (invoice_type='LAB')
            → Payment collected → Result given to patient
```

### Walk-in Pharmacy

```
Patient arrives with external prescription
  → Patient looked up (or registered)
    → NO ENCOUNTER CREATED
      → Pharmacy looks up Drug from stock → creates Dispensation directly
        → DrugInventory decremented
          → Invoice created (invoice_type='PHARMACY')
            → Payment collected → Medicine given to patient
```

---

## What Order of Building

| Step | What | Changes Required | Tiers Affected |
|---|---|---|---|
| **S1** | Make `Medication.encounter` nullable (add `null=True, blank=True`) | Migration + view fix | All — enables walk-in pharmacy |
| **S2** | Add `WALKIN` and `TELEICU` to `Invoice.INVOICE_TYPES` | Migration only | All — enables proper invoice typing |
| **S3** | **Enforce subscription tiers** — apply `HasFeatureAccess` to all views | `views/pharmacy.py`, `views/lab/`, `views/teleicu.py`, `views/scribe.py` | All — prerequisite |
| **S4** | **Doctor Prescriptions UI** — a page where doctor selects drugs from stock + writes dosage for an encounter | Frontend: new/updated Prescriptions page. Backend: may need a batch-create Medications endpoint | All tiers |
| **S5** | **Doctor Lab Order UI** — a page where doctor selects tests from catalog for an encounter | Frontend: new Lab Order page within encounter. Backend: batch-create LabOrders | Professional + Enterprise |
| **S6** | **Pharmacy Notification Feed** — Pharmacy dashboard shows pending Medications to dispense | Frontend: Pharmacy page with pending queue. Backend: filter by status/hospital | All tiers |
| **S7** | **Lab Notification Feed** — Lab dashboard shows pending LabOrders to process | Frontend: Lab page with pending queue. Backend: filter by status/hospital | Professional + Enterprise |
| **S8** | **One-Click Generate Invoice** — from encounter, collect all items → Invoice with line items | Backend: `POST /encounters/{id}/generate-invoice/`. Frontend: button on EncounterDetail | All tiers |
| **S9** | **AI Scribe Auto-Extract** — from confirmed note → Medications + LabOrders | Backend: extract endpoints. Frontend: review UI on AI Scribe | Enterprise only |
| **S10** | **Walk-in Lab Flow** — Lab creates order directly, no encounter | Mostly works already (LabOrder.encounter is nullable). Just need UI | Professional + Enterprise |
| **S11** | **Walk-in Pharmacy Flow** — Pharmacy creates dispensation directly, no encounter | Need to allow Medication without encounter (S1). Need UI | All tiers |

---

## What Already Exists vs What's New

| Component | Status | Located In |
|---|---|---|
| Drug CRUD | ✅ Built | `models/pharmacy.py`, `views/pharmacy.py` |
| DrugInventory CRUD | ✅ Built | Same |
| Dispensation CRUD | ✅ Built | Same — `dispense()` method decrements stock |
| LabOrder CRUD + pipeline | ✅ Built | `models/lab.py`, `views/lab/orders.py` |
| Invoice CRUD | ✅ Built | `models/billing.py`, `views/billing.py` |
| AI Scribe audio→note | ✅ Built | `views/scribe.py` |
| Encounter CRUD | ✅ Built | `views/encounters.py` |
| Medication CRUD | ✅ Built | `views/clinical.py`? (need to check) |
| **Subscription enforcement on views** | ❌ Not done | `HasFeatureAccess` defined but unused |
| **Medication.encounter nullable** | ❌ Not done | Currently REQUIRED FK |
| **WALKIN/TELEICU invoice types** | ❌ Not done | Missing from INVOICE_TYPES |
| **Batch-create Medications for encounter** | ❌ Not built | Need endpoint |
| **Batch-create LabOrders for encounter** | ❌ Not built | Need endpoint |
| **One-click Generate Invoice** | ❌ Not built | Core Phase 3 feature |
| **Walk-in lab UI** | ❌ Not built | Lab creates order without encounter |
| **Walk-in pharmacy UI** | ❌ Not built | Pharmacy dispenses without encounter |
| **AI Scribe auto-extract** | ❌ Not built | Enterprise-only Phase 1+2 |

---

## Decision Points

### 1. How does the doctor "write medicines"?

**Option A — Select from DrugInventory dropdown**
- Doctor types in a drug name, autocomplete suggests from DrugInventory
- Doctor selects → dosage/frequency/quantity fields populate from template
- Pros: Ensures drug exists in stock, reduces errors
- Cons: More UI work

**Option B — Free text + auto-suggest**
- Doctor types drug name free-form, backend tries to match to DrugInventory
- If no match, stored as free-text (pharmacy handles it manually)
- Pros: Faster for doctor
- Cons: May create unpickable orders

**Recommendation:** Option A with a fallback free-text field. Select from stock first, but allow typing unknown drugs.

### 2. How does Pharmacy see pending orders?

- Pharmacy dashboard shows `Medication.objects.filter(encounter__hospital=hospital, is_active=True)` with no `Dispensation` yet
- Or a `Dispensation.objects.filter(status='PENDING')` list
- Currently Dispensation is created separately from Medication — the pharmacist creates it manually
- **Recommendation:** Auto-create a `Dispensation(status='PENDING')` when Medication is created. Pharmacist sees it in their queue and marks DISPENSED.

### 3. Walk-in: same patient model or separate "walk-in" patient type?

- Walk-in patients need to exist in the `Patient` table (for billing and records)
- They just won't have an `Encounter`
- **Recommendation:** Same Patient model. A patient without encounters is just a "walk-in". The UI can flag this.

### 4. IPD billing: single invoice or periodic?

- Standard: single invoice at discharge
- For long-stay patients (>30 days), hospitals may want periodic billing
- **Recommendation:** Start with single invoice at discharge. Add periodic billing later if needed. The "Generate Invoice" button can be called multiple times per encounter (currently blocked by "already invoiced" check — remove that restriction for IPD, or add partial invoicing).

### 5. TeleICU billing: how is the cycle defined?

- Daily, weekly, or monthly — varies by hospital agreement
- Need a hospital-level setting: `teleicu_billing_cycle_days`
- **Recommendation:** Add `teleicu_billing_cycle_days` (default 7) to the hospital model or settings system. The generate-invoice endpoint for TeleICU encounters uses this to determine period.

---

## Summary Architecture

```
                                  ┌─────────────────────┐
                                  │   Subscription Gate │
                                  │  (per ViewSet)      │
                                  └──────────┬──────────┘
                                             │
┌──────────┐     ┌──────────────┐     ┌──────▼───────┐     ┌───────────┐
│  Doctor  │────▶│ Create Orders │────▶│  Pharmacy/   │────▶│  Billing  │
│  Manual  │     │ Prescriptions │     │  Lab Process │     │  Invoice  │
│  UI      │     │ + Lab Orders  │     │  Dispense    │     │  Collect  │
└──────────┘     └──────────────┘     └──────────────┘     └───────────┘
      │
      │ (Enterprise only)
      ▼
┌──────────┐
│AI Scribe │──▶ Auto-extract ──▶ (same Orders)
│ Note     │    from note text
└──────────┘
```

**The plan document covers:** all 3 tiers, all 5 visit types (OPD/IPD/TeleICU/Walkin-Lab/Walkin-Pharmacy), the 11 build steps in dependency order, and 5 open design decisions.

Want me to proceed with **S1** (make Medication.encounter nullable + migration) and **S2** (add WALKIN/TELEICU to invoice types)? Those are quick schema fixes unblocking everything else.
