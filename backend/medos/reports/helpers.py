"""Reports & Analytics — Pure helper functions (no view logic)."""

from datetime import date, timedelta, datetime
from django.utils import timezone


def _parse_global_filters(request):
    """Extract global filter parameters from request query params.

    Returns a dict with keys: date_from, date_to, location, department, doctor_id, payer
    All values are strings or None.
    """
    return {
        'date_from': request.query_params.get('date_from'),
        'date_to': request.query_params.get('date_to'),
        'location': request.query_params.get('location_id'),
        'department': request.query_params.get('department'),
        'doctor_id': request.query_params.get('doctor_id'),
        'payer': request.query_params.get('payer'),
    }


def _get_current_period(filters):
    """Return (start_date, end_date) for the current period.

    Defaults to today if no filters provided.
    """
    date_from = filters.get('date_from')
    date_to = filters.get('date_to')
    today = timezone.now().date()

    if date_from:
        start = datetime.strptime(date_from, '%Y-%m-%d').date()
    else:
        start = today

    if date_to:
        end = datetime.strptime(date_to, '%Y-%m-%d').date()
    else:
        end = today

    return start, end


def _get_previous_period(start, end):
    """Return (prev_start, prev_end) of the same length as (start, end)."""
    delta = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=delta - 1)
    return prev_start, prev_end


def _apply_encounter_filters(qs, filters):
    """Apply global filters to an Encounter queryset."""
    department = filters.get('department')
    doctor_id = filters.get('doctor_id')
    location = filters.get('location')

    if department:
        qs = qs.filter(department__iexact=department)
    if doctor_id:
        qs = qs.filter(doctor_id=doctor_id)
    if location:
        qs = qs.filter(location__iexact=location)
    return qs


def _apply_invoice_filters(qs, filters):
    """Apply global filters to an Invoice queryset."""
    department = filters.get('department')
    doctor_id = filters.get('doctor_id')

    if department:
        qs = qs.filter(department__iexact=department)
    if doctor_id:
        qs = qs.filter(encounter__doctor_id=doctor_id)
    return qs


def _compute_growth(current, previous):
    """Compute percentage growth: ((current - previous) / previous) * 100."""
    if previous and previous > 0:
        return round(((current - previous) / previous) * 100, 1)
    return 0.0


def _get_period_bounds(filters):
    """Convenience: return (cur_start, cur_end, prev_start, prev_end)."""
    cur_start, cur_end = _get_current_period(filters)
    prev_start, prev_end = _get_previous_period(cur_start, cur_end)
    return cur_start, cur_end, prev_start, prev_end
