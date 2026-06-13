"""
Pharmacy service layer — prescription queue, dispensing, stock management.

All business logic lives here. Views are thin adapters (3–10 lines).
"""
from datetime import date, timedelta
from django.db import transaction
from django.utils import timezone
from django.db.models import F, Prefetch

from ..models import Prescription, Medication, Dispensation, DrugInventory


def get_pharmacy_queue(hospital):
    """Return active prescriptions grouped by encounter type and sorted by acuity.

    Only ORDERED and IN_PROGRESS prescriptions are shown in the queue.
    DRAFT is doctor-only. DISPENSED/CANCELLED/AMENDED are historical.
    """
    active_statuses = ['ORDERED', 'IN_PROGRESS']

    qs = Prescription.objects.filter(
        hospital=hospital,
        status__in=active_statuses,
    ).select_related(
        'encounter__patient',
        'ordered_by',
    ).prefetch_related(
        Prefetch(
            'medications',
            queryset=Medication.objects.filter(is_active=True),
        ),
    ).order_by('ordered_at')

    # Group by encounter type
    grouped = {
        'stat': [],
        'urgent': [],
        'opd': [],
        'ipd': [],
        'teleicu': [],
        'emergency': [],
    }

    for rx in qs:
        encounter = rx.encounter
        etype = encounter.encounter_type if encounter else 'OPD'

        # Map encounter type to queue section
        # clinical_acuity=Critical → stat/urgent
        acuity = (encounter.clinical_acuity or '').lower() if encounter else ''

        entry = {
            'id': str(rx.id),
            'version': rx.version,
            'status': rx.status,
            'encounter_id': str(encounter.id) if encounter else '',
            'patient_name': encounter.patient.full_name if encounter and encounter.patient else 'Unknown',
            'patient_id': str(encounter.patient.id) if encounter and encounter.patient else '',
            'encounter_type': etype,
            'bed_number': encounter.bed_number if encounter else '',
            'clinical_acuity': encounter.clinical_acuity if encounter else '',
            'doctor_name': rx.ordered_by.get_full_name() or rx.ordered_by.username if rx.ordered_by else '',
            'ordered_at': rx.ordered_at.isoformat() if rx.ordered_at else '',
            'medications': [
                {
                    'id': str(m.id),
                    'drug_name': m.drug_name,
                    'dosage': m.dosage,
                    'frequency': m.frequency,
                    'route': m.route,
                    'quantity': str(m.quantity),
                    'is_active': m.is_active,
                    'cancellation_reason': m.cancellation_reason,
                }
                for m in rx.medications.all()
            ],
            'medication_count': rx.medications.filter(is_active=True).count(),
            'pharmacy_notes': rx.pharmacy_notes,
        }

        if etype == 'OPD':
            grouped['opd'].append(entry)
        elif etype == 'IPD':
            grouped['ipd'].append(entry)
        elif etype == 'TELEICU':
            grouped['teleicu'].append(entry)
        elif etype == 'EMERGENCY':
            if acuity == 'critical':
                grouped['stat'].append(entry)
            else:
                grouped['urgent'].append(entry)
        else:
            grouped['opd'].append(entry)

    # Sort each group by acuity (Critical first) then time
    acuity_order = {'critical': 0, 'observation': 1, 'stable': 2, '': 3}
    for key in grouped:
        grouped[key].sort(key=lambda e: (
            acuity_order.get(e['clinical_acuity'].lower(), 3),
            e['ordered_at'],
        ))

    return {
        section: entries
        for section, entries in grouped.items()
        if entries  # only return non-empty sections
    }


@transaction.atomic
def dispense_medication(medication_id, hospital, user):
    """Dispense a single medication — creates Dispensation record, decrements stock."""
    med = Medication.objects.select_related('prescription', 'encounter__patient').get(
        id=medication_id,
        hospital=hospital,
        is_active=True,
    )

    # Check if already dispensed
    if Dispensation.objects.filter(medication=med, status='DISPENSED').exists():
        raise ValueError(f'Medication {med.drug_name} already dispensed.')

    # Decrement inventory
    _decrement_stock(med)

    # Create dispensation record
    disp = Dispensation.objects.create(
        medication=med,
        encounter=med.encounter,
        patient=med.encounter.patient if med.encounter else None,
        hospital=hospital,
        drug_name=med.drug_name,
        dosage=med.dosage,
        quantity_dispensed=med.quantity,
        status='DISPENSED',
        dispensed_by=user,
        dispensed_at=timezone.now(),
    )

    # Check if all meds in the prescription are dispensed
    rx = med.prescription
    if rx:
        remaining = rx.medications.filter(is_active=True).exclude(
            id__in=Dispensation.objects.filter(
                medication__prescription=rx,
                status='DISPENSED',
            ).values('medication_id')
        ).count()
        if remaining == 0:
            rx.status = 'DISPENSED'
            rx.save(update_fields=['status'])

    return disp


@transaction.atomic
def dispense_prescription(prescription_id, hospital, user):
    """Dispense all active medications in a prescription."""
    rx = Prescription.objects.get(id=prescription_id, hospital=hospital)
    active_meds = rx.medications.filter(is_active=True)

    if not active_meds.exists():
        raise ValueError('No active medications in this prescription.')

    dispensations = []
    for med in active_meds:
        try:
            d = dispense_medication(med.id, hospital, user)
            dispensations.append(d)
        except ValueError:
            continue  # skip already dispensed

    rx.status = 'DISPENSED'
    rx.save(update_fields=['status'])

    return dispensations


@transaction.atomic
def mark_prescription_in_progress(prescription_id, hospital):
    """Pharmacist starts working on a prescription."""
    rx = Prescription.objects.get(
        id=prescription_id,
        hospital=hospital,
        status='ORDERED',
    )
    rx.status = 'IN_PROGRESS'
    rx.save(update_fields=['status'])
    return rx


def _decrement_stock(medication):
    """Reduce inventory for the medication's drug if stocked."""
    inventory = DrugInventory.objects.filter(
        hospital=medication.hospital,
        drug__name__iexact=medication.drug_name,
        is_active=True,
        quantity__gt=0,
    ).order_by('expiry_date').first()

    if inventory:
        qty = float(medication.quantity)
        if inventory.quantity >= qty:
            inventory.quantity = F('quantity') - qty
            inventory.save(update_fields=['quantity'])
        # If insufficient stock, we still dispense — pharmacist will note it
