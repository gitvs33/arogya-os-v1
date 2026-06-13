# Tiered Clinical Pipeline — Plan

## The Three Subscription Tiers

| Feature | Basic | Professional | Enterprise |
|---|---|---|---|
| Patients | ✅ | ✅ | ✅ |
| Encounters | ✅ | ✅ | ✅ |
| Billing | ✅ | ✅ | ✅ |
| Pharmacy | ✅ | ✅ | ✅ |
| Laboratory | ❌ | ✅ | ✅ |
| Reports | ❌ | ✅ | ✅ |
| TeleICU | ❌ | ✅ | ✅ |
| **AI Scribe** | ❌ | ❌ | ✅ |
| Teleconsult | ❌ | ❌ | ✅ |
| AI Insights | ❌ | ❌ | ✅ |
| Integrations | ❌ | ❌ | ✅ |

## Critical Finding: No Feature Enforcement Exists

`HasFeatureAccess` permission is defined in `medos/subscriptions.py` but **never imported or used in any view**. Currently every hospital on any plan can access every feature. This must be fixed before any pipeline work.

---

## The Pipeline Per Tier

### Basic Tier — Manual Only

```
Doctor opens Prescriptions page
  → manually creates Medication records (drug, dosage, qty)
  → Pharmacy dispenses via Pharmacy UI (Dispensation created)
  
Doctor opens Lab → NOT AVAILABLE at this tier

Billing → manually creates Invoice
  → manually adds line items (consultation fee, each drug)
```

**What exists:** ✅ Medication CRUD, Dispensation CRUD, Invoice CRUD
**What's missing:** Nothing for the pipeline — it's all manual by design.

---

### Professional Tier — Manual + Lab

```
Doctor opens Prescriptions page
  → manually creates Medication records
  → Pharmacy dispenses

Doctor opens Lab page
  → creates LabOrder (test selection)
  → Lab processes sample → reports result

Billing → manually creates Invoice
  → manually adds line items (consultation + drugs + lab tests)
```

**What exists:** ✅ Medication, Dispensation, LabOrder pipeline, Invoice
**What's missing:** Nothing for the pipeline — manual by design. (No AI Scribe at this tier.)

---

### Enterprise Tier — AI-Powered Pipeline

This is the only tier where the auto-extraction pipeline applies:

```
Doctor uses AI Scribe
  → speaks, note generated
  → NOTE TEXT contains drugs and tests mentioned by doctor
  ↓
  **GAP 1: Auto-extract drugs from note → Medication records**
  **GAP 2: Auto-extract tests from note → LabOrder records**
  ↓
  Pharmacy sees pending Medication orders → dispenses
  Lab sees pending LabOrders → processes → reports
  ↓
  **GAP 3: Auto-populate Invoice from encounter's items**
  → one-click "Generate Bill" from encounter
```

---

## Plan: Build in 4 Phases

### Phase 0 — Enforce Subscription Tiers (prerequisite)

Apply `HasFeatureAccess` to feature-gated views. Without this, a Basic hospital gets Scribe (Enterprise-only feature) for free.

| View/ViewSet | Feature Gate | Action |
|---|---|---|
| `views/scribe.py` (`care_scribe_*`) | `'scribe'` | Add `@permission_classes([HasFeatureAccess])` with `required_feature='scribe'` |
| `views/lab/` (all 9 files) | `'laboratory'` | Add `HasFeatureAccess` to each ViewSet |
| `views/teleicu.py` | `'teleicu'` | Add `HasFeatureAccess` |
| `views/reports.py` | `'reports'` | Add `HasFeatureAccess` |
| `views/dashboard.py` (dashboard_service) | Respects whatever the tier allows | Tier-awareness on widget-level |
| `views/pharmacy.py` | `'pharmacy'` | Already in Basic, but add gate for safety |
| `views/encounters.py` | `'encounters'` | Base feature, but add gate |

**Implementation pattern:**
```python
from medos.subscriptions import HasFeatureAccess

class LabOrderViewSet(HospitalScopedViewSet):
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'laboratory'
```

But wait — `HasFeatureAccess` checks the hospital's plan via `hospital_profile`. All `HospitalScopedViewSet` views already have a hospital context. We can fold feature gating into `HospitalScopedViewSet` itself:

```python
class HospitalScopedViewSet(viewsets.ModelViewSet):
    required_feature = None  # Subclasses set this

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.required_feature:
            hospital = self.get_hospital()
            if not hospital_has_feature(hospital, self.required_feature):
                raise PermissionDenied(
                    f"Your plan ({hospital.plan}) does not include '{self.required_feature}'."
                )
```

---

### Phase 1 — Enterprise: Auto-extract Drugs from AI Scribe Note (Gap 1)

**What:** When an AI Scribe note is confirmed, parse it for medication mentions and create `Medication` records.

**Backend:**
- Add `POST /care-scribe/{note_id}/extract-prescriptions/` endpoint
- Or integrate extraction into the confirm flow (`care_scribe_confirm`)
- Use NLP/heuristics to extract drug names, dosages, quantities from note text
- Create `Medication` records linked to the encounter

**Implementation sketch:**
```python
# views/scribe.py or a new care_scribe_extract view
@api_view(['POST'])
@permission_classes([IsAuthenticated & HasFeatureAccess])
# required_feature = 'scribe'
def care_scribe_extract_prescriptions(request, note_id):
    note = get_object_or_404(ClinicalNote, id=note_id)
    encounter = note.encounter
    # Parse note.note_text for drugs
    medications = parse_medications_from_text(note.note_text)
    created = []
    for med in medications:
        m = Medication.objects.create(
            encounter=encounter,
            drug_name=med['name'],
            dosage=med.get('dosage', ''),
            quantity=med.get('quantity', 1),
            prescribed_by=encounter.doctor,
            hospital=encounter.hospital,
        )
        created.append(m)
    return Response(MedicationSerializer(created, many=True).data)
```

**Frontend:**
- Add "Extract Prescriptions" button on AI Scribe after note is confirmed
- Shows extracted drugs in a table before committing
- Doctor can edit/remove before confirming

---

### Phase 2 — Enterprise: Auto-extract Lab Orders from AI Scribe Note (Gap 2)

**What:** Same pattern — parse confirmed note for test mentions and create `LabOrder` records.

**Backend:**
- `POST /care-scribe/{note_id}/extract-lab-orders/` endpoint
- Match test names against the hospital's lab panel catalog
- Create `LabOrder` records

**Frontend:**
- "Extract Lab Orders" button alongside prescription extraction
- Doctor reviews extracted tests before confirming

---

### Phase 3 — Enterprise: Auto-populate Invoice (Gap 3)

**What:** After Medications + LabOrders exist for an encounter, one-click "Generate Invoice" collects all items and creates an Invoice with line items.

**Backend:**
- `POST /encounters/{encounter_id}/generate-invoice/` endpoint
- Collects all `Medication` records (prices from `Drug` catalog)
- Collects all `LabOrder` records (prices from lab panel catalog)
- Adds consultation fee (based on department rate / hospital config)
- Creates `Invoice` with `InvoiceLineItem` for each

**Implementation sketch:**
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated, HasFeatureAccess])
# required_feature = 'billing'
def generate_encounter_invoice(request, encounter_id):
    encounter = get_object_or_404(Encounter, id=encounter_id)
    
    # Already invoiced?
    if Invoice.objects.filter(encounter=encounter).exists():
        return Response({'error': 'Invoice already exists'}, status=400)
    
    line_items = []
    
    # 1. Consultation fee
    consultation_fee = get_consultation_fee(encounter.department)
    line_items.append({'description': 'Consultation Fee', 'amount': consultation_fee})
    
    # 2. Medications
    for med in encounter.medications.all():
        drug = med.drug  # FK to Drug model
        line_items.append({
            'description': f'{drug.name} {med.dosage} x {med.quantity}',
            'amount': drug.price * med.quantity,
        })
    
    # 3. Lab orders
    for order in encounter.lab_orders.all():
        panel = order.panel
        line_items.append({
            'description': panel.name,
            'amount': panel.price,
        })
    
    # Create Invoice
    invoice = Invoice.objects.create(
        patient=encounter.patient,
        encounter=encounter,
        invoice_type=encounter.encounter_type,
        total_amount=sum(li['amount'] for li in line_items),
        hospital=encounter.hospital,
    )
    for li in line_items:
        InvoiceLineItem.objects.create(invoice=invoice, **li)
    
    return Response(InvoiceSerializer(invoice).data)
```

**Frontend:**
- "Generate Invoice" button on EncounterDetail page
- Shows preview of line items before creating
- Redirect to Billing page after creation

---

## Visual Pipeline by Tier

```
BASIC:
  Doctor ──▶ Prescriptions Page ──▶ Medication ──▶ Pharmacy ──▶ Dispensation
              ↘                                                      ↙
                ──▶ Billing Page ──▶ Manual Invoice ──▶ Payment

PROFESSIONAL:
  Doctor ──▶ Prescriptions Page ──▶ Medication ──▶ Pharmacy ──▶ Dispensation
              Lab Orders Page ────▶ LabOrder ────▶ Lab ──────▶ Results
              ↘                                                      ↙
                ──▶ Billing Page ──▶ Manual Invoice ──▶ Payment

ENTERPRISE:
  Doctor ──▶ AI Scribe ──▶ Note ──▶ Extract Drugs ──▶ Medication ──▶ Pharmacy
                           │          Extract Tests ──▶ LabOrder ────▶ Lab
                           │                                             │
                           └──▶ One-Click "Generate Invoice" ◀──────────┘
                                          │
                                          ▼
                                     Payment
```

---

## Implementation Order

| Phase | What | Depends On | Estimated Effort |
|---|---|---|---|
| **P0** | Enforce subscription tiers on all feature-gated views | Nothing | 1 day |
| **P1** | Auto-extract drugs from AI Scribe note → Medication records | P0 + AI Scribe working | 2-3 days |
| **P2** | Auto-extract lab orders from AI Scribe note → LabOrder records | P0 + P1 | 1-2 days |
| **P3** | One-click "Generate Invoice" from encounter items | P1 + P2 + Pricing data populated | 2-3 days |

---

## Key Design Decisions

1. **Extraction is always doctor-reviewed** — AI suggests, doctor confirms. No auto-creation without human approval.
2. **Already-invoiced check** — encounters can only be invoiced once. Prevents double billing.
3. **Feature enforcement at view level** — `HasFeatureAccess` on each ViewSet, not in middleware. Keeps it explicit.
4. **Tier doesn't affect data model** — all models exist for all hospitals. Only the API access is gated. This avoids schema complexity.
5. **Enterprise features remain optional within Enterprise** — even if a hospital is on Enterprise, the doctor can still use manual prescription entry. AI extraction is a convenience, not a replacement.
