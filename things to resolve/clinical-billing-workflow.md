# Clinical Billing Workflow — by Visit Type

## High-Level Flow

```
Patient arrives
      │
      ▼
┌──────────────┐    ┌──────────────────┐
│ Registration │───▶│ Encounter Created │
└──────────────┘    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
           OPD Flow      IPD Flow      TeleICU Flow
              │              │              │
              ▼              ▼              ▼
        Doctor examines   Admission +     Remote monitoring
        + AI Scribe       daily rounds    + AI Scribe rounds
              │              │              │
              ▼              ▼              ▼
        Prescriptions ─┐    Prescriptions ─┐   Prescriptions ─┐
        Lab orders ────┤    Lab orders ────┤   Lab orders ────┤
        Imaging ───────┤    Imaging ───────┤   Imaging ───────┤
                       ▼                   ▼                  ▼
              ┌──────────────────────────────────────────┐
              │         Pharmacy dispenses /              │
              │         Lab processes samples             │
              └────────────────┬─────────────────────────┘
                               │
                               ▼
              ┌──────────────────────────────────────────┐
              │         Billing (Invoice Created)        │
              │  - OPD: at checkout (after consultation) │
              │  - IPD: at discharge (daily accrual)     │
              │  - TeleICU: periodic billing cycle       │
              └────────────────┬─────────────────────────┘
                               │
                               ▼
              ┌──────────────────────────────────────────┐
              │         Payment (Cash/UPI/Card/Ins)      │
              └──────────────────────────────────────────┘
```

---

## By Visit Type

### OPD (Outpatient)

| Step | What Happens | System Action |
|---|---|---|
| 1. Arrival | Patient checks in | Encounter created with `encounter_type=OPD`, `status=ACTIVE` |
| 2. Triage | Nurse records vitals | Vitals saved against encounter |
| 3. Consultation | Doctor examines patient, uses **AI Scribe** to dictate notes | AI Scribe creates clinical note linked to encounter |
| 4. Prescriptions | Doctor prescribes medicines | `Medication` records created |
| 5. Lab/Imaging | Doctor orders tests | `LabOrder` created (status `ORDERED`) |
| 6. Pharmacy | Patient picks up meds | `Dispensation` created, stock deducted from `DrugInventory` |
| 7. Lab Processing | Lab receives sample, runs tests, reports results | `LabOrder` → `SAMPLE_COLLECTED` → `IN_PROGRESS` → `COMPLETED` |
| 8. **Checkout & Billing** | All items consolidated into an invoice | `Invoice` created with `invoice_type=OPD`, line items from pharmacy + lab + consultation fee |
| 9. Payment | Patient pays | `Payment` record, invoice status → `PAID` |
| 10. Follow-up | If needed, follow-up date set | `encounter.follow_up_date` set |

**Billing timing:** At checkout (after consultation). The invoice aggregates:
- Consultation fee (department-rate)
- Pharmacy items (from `Dispensation`)
- Lab tests (from `LabOrder`)
- Imaging/other procedures

---

### IPD (Inpatient)

| Step | What Happens | System Action |
|---|---|---|
| 1. Admission | Patient admitted to ward/bed | Encounter `encounter_type=IPD`, bed assigned |
| 2. Daily rounds | Doctor reviews patient, updates notes | AI Scribe notes attached to the IPD encounter |
| 3. Daily orders | Prescriptions, lab orders, procedures | Medications + LabOrders created throughout stay |
| 4. Pharmacy | Daily dispensation of medicines | `Dispensation` created each day |
| 5. Lab | Daily/periodic lab work | `LabOrder` → results reported |
| 6. **Daily accrual** | System accrues bed charges + daily items | No invoice yet — items tracked against encounter |
| 7. Discharge | Doctor writes discharge summary | Encounter `status` → `COMPLETED` |
| 8. **Billing at discharge** | All accrued items consolidated | `Invoice` created with `invoice_type=IPD`, includes: bed charges × days, all pharmacy, all lab, procedures |
| 9. Payment | Patient/insurer pays | `Payment`, invoice → `PAID` |

**Billing timing:** At discharge. The invoice aggregates everything from the entire stay.

**Key difference from OPD:** Items are accrued over days — no billing happens until discharge. The system tracks running totals via `InvoiceLineItem` records that can be added incrementally during the stay, but the invoice itself is only finalized at discharge.

---

### TeleICU

| Step | What Happens | System Action |
|---|---|---|
| 1. Referral | Patient in remote hospital ICU referred for TeleICU | Encounter `encounter_type=TELEICU`, `TeleICUSession` created |
| 2. Monitoring | Remote ICU team monitors vitals stream | Vitals streamed every 5s (mock) or from device (prod) |
| 3. Remote rounds | Specialist reviews patient via video/notes | AI Scribe notes created for each remote round |
| 4. Remote orders | Specialist prescribes/changes treatment | Medications + LabOrders created at the remote hospital |
| 5. Local pharmacy | Remote hospital pharmacy dispenses | `Dispensation` at the remote hospital |
| 6. Local lab | Remote hospital lab processes orders | `LabOrder` at the remote hospital |
| 7. **Periodic billing** | TeleICU billed in cycles (daily/weekly/monthly) | `Invoice` created with `invoice_type=OPD` (or a future `TELEICU` type) for each billing cycle |
| 8. Payment | Remote hospital or insurer pays | `Payment`, invoice → `PAID` |

**Billing timing:** Periodic (daily or weekly cycles), not at the end of the encounter. A TeleICU session can last weeks, so you bill in increments.

**Key difference:** The encounter remains `ACTIVE` throughout. Billing happens on a schedule (e.g., every 24h a new invoice line item for "TeleICU monitoring Day N" is added).

---

## Where AI Scribe Fits

The **AI Scribe** is the clinical documentation engine. It's used during the consultation/rounds phase:

```
Doctor speaks → AI Scribe records audio → Transcribes → Generates structured note
                                                              │
                    ┌─────────────────────────────────────────┤
                    ▼                                         ▼
            Structured fields                         Prescriptions / Orders
            (HPI, Assessment,                     (extracted from note text and
             Plan, Diagnosis)                       sent to Pharmacy / Lab)
                                                            │
                                                            ▼
                                                    Medications created
                                                    LabOrders created
                                                    ─────────────────
                                                    THEN: Billing picks
                                                    these up as line items
```

**Current gap:** The AI Scribe generates a note, but the extraction of prescriptions and lab orders from the note text into actual `Medication` / `LabOrder` records is not yet automated. This is what connects the AI Scribe output to the billing pipeline.

---

## Billing Data Flow

```
                    ┌─────────────────────┐
                    │   Encounter         │
                    │   (OPD/IPD/TELEICU) │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
    ┌────────────┐     ┌──────────────┐     ┌──────────────┐
    │ Medications│     │  LabOrders   │     │  Procedures  │
    │ (Drug +    │     │  (tests      │     │  (IPD bed    │
    │  quantity) │     │   ordered)   │     │   charges)   │
    └──────┬─────┘     └──────┬───────┘     └──────┬───────┘
           │                  │                    │
           ▼                  ▼                    ▼
    ┌─────────────────────────────────────────────────────┐
    │              Invoice (per encounter)                │
    │  ┌───────────────────────────────────────────────┐  │
    │  │ Line Item 1: Consultation Fee         ₹500    │  │
    │  │ Line Item 2: Paracetamol 500mg x 10   ₹80    │  │
    │  │ Line Item 3: CBC Lab Test             ₹300    │  │
    │  │ Line Item 4: Bed Charge (3 days)     ₹3000   │  │  ← IPD only
    │  │                              Subtotal ₹3880   │  │
    │  │                              GST 18%  ₹698    │  │
    │  │                              Total   ₹4578    │  │
    │  └───────────────────────────────────────────────┘  │
    └──────────────────────┬──────────────────────────────┘
                           ▼
                    ┌──────────────┐
                    │   Payment    │
                    │  (CASH/UPI/  │
                    │   CARD/INS)  │
                    └──────────────┘
```

---

## What's Built vs What's Missing

| Component | Status | Notes |
|---|---|---|
| Encounter creation | ✅ Working | OPD, IPD, EMERGENCY, TELEICU, HOME |
| AI Scribe note generation | ✅ Working | Records audio → transcribes → generates structured note |
| **Auto-extract prescriptions from AI Scribe** | ❌ Missing | Note text has meds listed, but no code extracts them into `Medication` records |
| **Auto-extract lab orders from AI Scribe** | ❌ Missing | Note text has test names, but no code creates `LabOrder` records |
| Pharmacy - Drug master | ✅ Working | CRUD for drugs, inventory, dispensations |
| Lab - Order processing | ✅ Working | Orders → samples → results pipeline |
| Invoice creation | ✅ Working | Manual creation per patient |
| **Auto-populate invoice from encounter items** | ❌ Missing | No code collects Medications + LabOrders into Invoice line items automatically |
| **Auto-generate invoice at checkout/discharge** | ❌ Missing | No trigger that creates an invoice when OPD checkout happens or IPD discharge happens |
| Payment processing | ✅ Working | Record payments against invoices |
| Insurance claims | ✅ Working | Submit/manage insurance claims |

## Current Manual Workaround

```
Doctor sees patient → writes prescription on paper (or AI Scribe note)
Doctor manually goes to Pharmacy tab → creates dispensation
Doctor manually goes to Lab tab → creates lab order
Doctor/Admin goes to Billing tab → creates invoice manually
    → adds line items one by one (consultation fee, each drug, each test)
    → issues invoice
    → marks as paid
```

## What Should Happen (Ideal Flow)

```
Doctor sees patient → AI Scribe records → Note generated
    │
    ├── Auto-extract drugs → Medication records created
    ├── Auto-extract tests → LabOrder records created  
    │
    ▼
Pharmacy sees pending orders → dispenses meds
Lab sees pending orders → processes samples → reports results
    │
    ▼
Auto-invoice generated (or one-click from encounter)
    → collects all Medications + LabOrders + bed charges
    → creates Invoice with line items
    → clinician/admin reviews → issues → payment collected
```
