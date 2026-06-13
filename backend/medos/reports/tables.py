"""Reports & Analytics — Tabular view functions (department performance, top doctors)."""

from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Invoice, Payment, User
from ..subscriptions import require_feature
from .helpers import _parse_global_filters, _apply_invoice_filters, _get_period_bounds, _compute_growth


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def table_department_performance(request):
    """Return department-wise performance table.

    Returns: [{ department, revenue, collection, outstanding, growth_pct }, ...]
    """
    filters = _parse_global_filters(request)
    cur_start, cur_end, prev_start, prev_end = _get_period_bounds(filters)

    # Current period by department
    inv_cur = Invoice.objects.filter(
        created_at__date__gte=cur_start, created_at__date__lte=cur_end
    ).exclude(status='CANCELLED')
    inv_cur = _apply_invoice_filters(inv_cur, filters)

    dept_cur = (
        inv_cur.values('department')
        .annotate(revenue=Sum('total'))
        .order_by('-revenue')
    )

    # Previous period by department
    inv_prev = Invoice.objects.filter(
        created_at__date__gte=prev_start, created_at__date__lte=prev_end
    ).exclude(status='CANCELLED')
    inv_prev = _apply_invoice_filters(inv_prev, filters)

    dept_prev = {
        d['department']: float(d['revenue'] or 0)
        for d in inv_prev.values('department').annotate(revenue=Sum('total'))
    }

    # Collections (payments) by department
    pay_cur = Payment.objects.filter(
        transaction_time__date__gte=cur_start, transaction_time__date__lte=cur_end,
        status='SUCCESS',
        invoice__isnull=False,
    )

    dept_collections = {}
    for p in pay_cur.select_related('invoice'):
        dept = p.invoice.department or 'Unspecified'
        dept_collections[dept] = dept_collections.get(dept, 0) + float(p.amount)

    data = []
    for d in dept_cur:
        dept_name = d['department'] or 'Unspecified'
        rev = float(d['revenue'] or 0)
        col = dept_collections.get(dept_name, 0)
        prev_rev = dept_prev.get(d['department'], 0)
        data.append({
            'department': dept_name,
            'revenue': rev,
            'collection': col,
            'outstanding': round(rev - col, 2),
            'growth_pct': _compute_growth(rev, prev_rev),
        })

    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def table_top_doctors(request):
    """Return top doctors by revenue generated.

    Returns: [{ doctor_id, name, specialty, avatar, revenue_generated, growth_pct }, ...]
    """
    filters = _parse_global_filters(request)
    cur_start, cur_end, prev_start, prev_end = _get_period_bounds(filters)

    # Current period revenue by doctor
    inv_cur = Invoice.objects.filter(
        created_at__date__gte=cur_start, created_at__date__lte=cur_end,
        encounter__doctor__isnull=False,
    ).exclude(status='CANCELLED')
    inv_cur = _apply_invoice_filters(inv_cur, filters)

    doctor_cur = (
        inv_cur.values(
            'encounter__doctor_id',
            'encounter__doctor__first_name',
            'encounter__doctor__last_name',
        )
        .annotate(revenue=Sum('total'))
        .order_by('-revenue')[:20]
    )

    # Previous period revenue by doctor
    inv_prev = Invoice.objects.filter(
        created_at__date__gte=prev_start, created_at__date__lte=prev_end,
        encounter__doctor__isnull=False,
    ).exclude(status='CANCELLED')
    inv_prev = _apply_invoice_filters(inv_prev, filters)

    doctor_prev = {}
    for d in inv_prev.values('encounter__doctor_id').annotate(revenue=Sum('total')):
        doctor_prev[d['encounter__doctor_id']] = float(d['revenue'] or 0)

    data = []
    for d in doctor_cur:
        doc_id = d['encounter__doctor_id']
        first = d['encounter__doctor__first_name'] or ''
        last = d['encounter__doctor__last_name'] or ''
        name = f"{first} {last}".strip() or str(doc_id)

        # Get user profile for specialty/avatar
        try:
            profile = User.objects.get(id=doc_id).hospital_profile
            specialty = profile.department or profile.designation or 'General'
            avatar = ''
        except User.DoesNotExist:
            specialty = 'General'
            avatar = ''
        except AttributeError:
            # User exists but has no hospital_profile
            specialty = 'General'
            avatar = ''

        rev = float(d['revenue'] or 0)
        prev_rev = doctor_prev.get(doc_id, 0)

        data.append({
            'doctor_id': doc_id,
            'name': name,
            'specialty': specialty,
            'avatar': avatar,
            'revenue_generated': rev,
            'growth_pct': _compute_growth(rev, prev_rev),
        })

    return Response(data)
