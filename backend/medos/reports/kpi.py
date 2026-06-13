"""Reports & Analytics — Overview KPIs (6 metric cards)."""

from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Encounter, Invoice, LabOrder, Medication, TeleConsultSession
from ..subscriptions import require_feature
from .helpers import (
    _parse_global_filters,
    _apply_encounter_filters,
    _apply_invoice_filters,
    _get_period_bounds,
    _compute_growth,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def reports_kpis(request):
    """Return 6 KPI metric cards with vs-yesterday % change.

    Metrics:
      - total_revenue, total_revenue_growth
      - patients_seen, patients_seen_growth
      - admissions, admissions_growth
      - lab_tests, lab_tests_growth
      - prescriptions, prescriptions_growth
      - teleicu_consults, teleicu_consults_growth
    """
    filters = _parse_global_filters(request)
    cur_start, cur_end, prev_start, prev_end = _get_period_bounds(filters)

    def _encounter_kpi(enc_type=None):
        """Return (current_count, previous_count) for encounters."""
        qs_cur = Encounter.objects.filter(created_at__date__gte=cur_start, created_at__date__lte=cur_end)
        qs_prev = Encounter.objects.filter(created_at__date__gte=prev_start, created_at__date__lte=prev_end)
        qs_cur = _apply_encounter_filters(qs_cur, filters)
        qs_prev = _apply_encounter_filters(qs_prev, filters)
        if enc_type:
            qs_cur = qs_cur.filter(encounter_type=enc_type)
            qs_prev = qs_prev.filter(encounter_type=enc_type)
        return qs_cur.count(), qs_prev.count()

    # ── 1. Total Revenue ──
    inv_cur = Invoice.objects.filter(
        created_at__date__gte=cur_start, created_at__date__lte=cur_end
    ).exclude(status='CANCELLED')
    inv_prev = Invoice.objects.filter(
        created_at__date__gte=prev_start, created_at__date__lte=prev_end
    ).exclude(status='CANCELLED')
    inv_cur = _apply_invoice_filters(inv_cur, filters)
    inv_prev = _apply_invoice_filters(inv_prev, filters)

    revenue_cur = float(inv_cur.aggregate(t=Sum('total'))['t'] or 0)
    revenue_prev = float(inv_prev.aggregate(t=Sum('total'))['t'] or 0)

    # ── 2. Patients Seen (total encounters) ──
    patients_cur, patients_prev = _encounter_kpi()

    # ── 3. Admissions (IPD encounters) ──
    admissions_cur, admissions_prev = _encounter_kpi(enc_type='IPD')

    # ── 4. Lab Tests (LabOrder count) ──
    lab_cur = LabOrder.objects.filter(
        created_at__date__gte=cur_start, created_at__date__lte=cur_end
    ).count()
    lab_prev = LabOrder.objects.filter(
        created_at__date__gte=prev_start, created_at__date__lte=prev_end
    ).count()

    # ── 5. Prescriptions (Medication count) ──
    rx_cur = Medication.objects.filter(
        prescribed_at__date__gte=cur_start, prescribed_at__date__lte=cur_end
    ).count()
    rx_prev = Medication.objects.filter(
        prescribed_at__date__gte=prev_start, prescribed_at__date__lte=prev_end
    ).count()

    # ── 6. TeleICU Consults ──
    tele_cur = TeleConsultSession.objects.filter(
        created_at__date__gte=cur_start, created_at__date__lte=cur_end
    ).count()
    tele_prev = TeleConsultSession.objects.filter(
        created_at__date__gte=prev_start, created_at__date__lte=prev_end
    ).count()

    data = {
        'total_revenue': {
            'label': 'Total Revenue',
            'value': round(revenue_cur, 2),
            'growth_pct': _compute_growth(revenue_cur, revenue_prev),
            'prefix': '₹',
            'suffix': '',
            'icon': 'trending-up',
        },
        'patients_seen': {
            'label': 'Patients Seen',
            'value': patients_cur,
            'growth_pct': _compute_growth(patients_cur, patients_prev),
            'prefix': '',
            'suffix': '',
            'icon': 'users',
        },
        'admissions': {
            'label': 'Admissions',
            'value': admissions_cur,
            'growth_pct': _compute_growth(admissions_cur, admissions_prev),
            'prefix': '',
            'suffix': '',
            'icon': 'hospital',
        },
        'lab_tests': {
            'label': 'Lab Tests',
            'value': lab_cur,
            'growth_pct': _compute_growth(lab_cur, lab_prev),
            'prefix': '',
            'suffix': '',
            'icon': 'flask',
        },
        'prescriptions': {
            'label': 'Prescriptions',
            'value': rx_cur,
            'growth_pct': _compute_growth(rx_cur, rx_prev),
            'prefix': '',
            'suffix': '',
            'icon': 'file-text',
        },
        'teleicu_consults': {
            'label': 'TeleICU Consults',
            'value': tele_cur,
            'growth_pct': _compute_growth(tele_cur, tele_prev),
            'prefix': '',
            'suffix': '',
            'icon': 'video',
        },
    }

    return Response(data)
