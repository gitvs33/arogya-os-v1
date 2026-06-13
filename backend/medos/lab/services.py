"""
Lab service layer — prescription-based lab queue, sample management.

All business logic lives here. Views are thin adapters (3–10 lines).
"""
from django.db import transaction
from django.utils import timezone
from django.db.models import Prefetch

from ..models import Prescription, LabOrder


def get_lab_queue(hospital):
    """Return active lab orders grouped by patient and priority.

    Shows ORDERED and SAMPLE_COLLECTED lab orders.
    Grouped by patient so the lab team works through one patient at a time.
    """
    active_statuses = ['ORDERED', 'SAMPLE_COLLECTED', 'RECEIVED_IN_LAB', 'IN_PROGRESS']

    # Get active lab orders directly
    orders = LabOrder.objects.filter(
        hospital=hospital,
        status__in=active_statuses
    ).select_related(
        'patient', 'encounter', 'test_panel', 'ordered_by'
    ).order_by('ordered_at')

    # Group by patient
    grouped = {}
    for lo in orders:
        pid = str(lo.patient_id)
        if pid not in grouped:
            grouped[pid] = []
        grouped[pid].append(lo)

    # Build grouped response
    sections = {
        'stat': [],
        'urgent': [],
        'routine': [],
    }

    for pid, pt_orders in grouped.items():
        encounter = pt_orders[0].encounter
        patient = pt_orders[0].patient
        
        patient_name = patient.full_name if patient else 'Unknown'
        bed = pt_orders[0].bed_unit or (encounter.bed_number if encounter else '')
        etype = pt_orders[0].visit_type or (encounter.encounter_type if encounter else '')
        acuity = (encounter.clinical_acuity or '').lower() if encounter else ''

        lab_orders_data = []
        highest_priority = 'ROUTINE'

        for lo in pt_orders:
            lab_orders_data.append({
                'id': str(lo.id),
                'lab_id': lo.lab_id,
                'test_name': lo.test_panel.short_name or lo.test_panel.name if lo.test_panel else 'Unknown',
                'test_panel_id': str(lo.test_panel_id) if lo.test_panel else '',
                'priority': lo.priority,
                'status': lo.status,
                'sample_type': lo.sample_type,
                'patient_name': lo.patient.full_name if lo.patient else patient_name,
                'ordered_at': lo.ordered_at.isoformat() if lo.ordered_at else '',
                'tat_deadline': lo.tat_deadline.isoformat() if lo.tat_deadline else '',
                'barcode': lo.barcode,
            })
            # Track highest priority for this patient
            prio_order = {'STAT': 0, 'URGENT': 1, 'ROUTINE': 2}
            if prio_order.get(lo.priority, 2) < prio_order.get(highest_priority, 2):
                highest_priority = lo.priority

        entry = {
            'group_id': pid,
            'prescription_status': 'ACTIVE',
            'version': 1,
            'encounter_id': str(encounter.id) if encounter else '',
            'patient_name': patient_name,
            'clinical_acuity': acuity,
            'encounter_type': etype,
            'bed_number': bed,
            'doctor_name': pt_orders[0].ordered_by.get_full_name() or pt_orders[0].ordered_by.username if pt_orders[0].ordered_by else '',
            'ordered_at': pt_orders[0].ordered_at.isoformat() if pt_orders[0].ordered_at else '',
            'lab_orders': lab_orders_data,
            'order_count': len(lab_orders_data),
            'highest_priority': highest_priority,
        }

        section = 'routine'
        if highest_priority == 'STAT' or acuity == 'critical':
            section = 'stat'
        elif highest_priority == 'URGENT':
            section = 'urgent'

        sections[section].append(entry)

    # Sort within sections
    for key in sections:
        sections[key].sort(key=lambda e: e['ordered_at'])

    return {
        section: entries
        for section, entries in sections.items()
        if entries
    }


@transaction.atomic
def collect_all_samples(patient_id, hospital, user):
    """Mark all lab orders for a patient as SAMPLE_COLLECTED."""
    orders = LabOrder.objects.filter(patient_id=patient_id, hospital=hospital, status='ORDERED')
    count = orders.update(status='SAMPLE_COLLECTED')
    return count


@transaction.atomic
def mark_order_in_progress(order_id, hospital):
    """Lab technician starts working on an order."""
    order = LabOrder.objects.get(id=order_id, hospital=hospital, status='SAMPLE_COLLECTED')
    order.status = 'RECEIVED_IN_LAB'
    order.save(update_fields=['status'])
    return order
