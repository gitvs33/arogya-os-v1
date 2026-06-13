"""Reports & Analytics — Chart view functions (department, specialty, trend)."""

from django.db.models import Sum
from django.db.models.functions import TruncMonth, TruncWeek
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Invoice, Payment
from ..subscriptions import require_feature
from .helpers import _parse_global_filters, _apply_invoice_filters, _get_period_bounds


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def chart_revenue_by_department(request):
    """Return department revenue for the donut chart.

    Returns: [{ department: "IPD Services", revenue: 2450000, percentage: 28.9 }, ...]
    """
    filters = _parse_global_filters(request)
    cur_start, cur_end, _, _ = _get_period_bounds(filters)

    qs = Invoice.objects.filter(
        created_at__date__gte=cur_start, created_at__date__lte=cur_end
    ).exclude(status='CANCELLED')
    qs = _apply_invoice_filters(qs, filters)

    dept_revenue = (
        qs.values('department')
        .annotate(revenue=Sum('total'))
        .order_by('-revenue')
    )

    total_revenue = sum(float(d['revenue'] or 0) for d in dept_revenue)

    data = []
    for d in dept_revenue:
        rev = float(d['revenue'] or 0)
        pct = round((rev / total_revenue * 100), 1) if total_revenue > 0 else 0
        data.append({
            'department': d['department'] or 'Unspecified',
            'revenue': rev,
            'percentage': pct,
        })

    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def chart_revenue_by_specialty(request):
    """Return revenue by clinical specialty for the bar chart.

    Returns: [{ specialty: "Cardiology", revenue: 1500000 }, ...]
    """
    filters = _parse_global_filters(request)
    cur_start, cur_end, _, _ = _get_period_bounds(filters)

    # Invoices grouped by encounter department (specialty)
    qs = Invoice.objects.filter(
        created_at__date__gte=cur_start, created_at__date__lte=cur_end,
        encounter__isnull=False,
    ).exclude(status='CANCELLED')
    qs = _apply_invoice_filters(qs, filters)

    specialty_revenue = (
        qs.values('encounter__department')
        .annotate(revenue=Sum('total'))
        .order_by('-revenue')
    )

    data = []
    for s in specialty_revenue:
        dept = s['encounter__department']
        if not dept:
            continue
        data.append({
            'specialty': dept,
            'revenue': float(s['revenue'] or 0),
        })

    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def chart_revenue_trend(request):
    """Return time-series revenue data for the trend line chart.

    Query params:
      interval (str): daily | weekly | monthly (default: daily)

    Returns: [{ date: "2026-06-14", revenue: 4500000, collections: 4000000, outstanding: 500000 }, ...]
    """
    filters = _parse_global_filters(request)
    cur_start, cur_end, _, _ = _get_period_bounds(filters)
    interval = request.query_params.get('interval', 'daily')

    # Base querysets
    inv_qs = Invoice.objects.filter(
        created_at__date__gte=cur_start, created_at__date__lte=cur_end
    ).exclude(status='CANCELLED')
    inv_qs = _apply_invoice_filters(inv_qs, filters)

    pay_qs = Payment.objects.filter(
        transaction_time__date__gte=cur_start, transaction_time__date__lte=cur_end,
        status='SUCCESS',
    )

    if interval == 'monthly':
        # Group by month
        revenue_data = (
            inv_qs.annotate(period=TruncMonth('created_at'))
            .values('period')
            .annotate(revenue=Sum('total'))
            .order_by('period')
        )
        collection_data = (
            pay_qs.annotate(period=TruncMonth('transaction_time'))
            .values('period')
            .annotate(collected=Sum('amount'))
            .order_by('period')
        )
        col_map = {c['period']: float(c['collected'] or 0) for c in collection_data}

        results = []
        for r in revenue_data:
            p = r['period']
            rev = float(r['revenue'] or 0)
            col = col_map.get(p, 0)
            results.append({
                'date': p.strftime('%b %Y') if p else '',
                'revenue': rev,
                'collections': col,
                'outstanding': round(rev - col, 2),
            })

    elif interval == 'weekly':
        revenue_data = (
            inv_qs.annotate(period=TruncWeek('created_at'))
            .values('period')
            .annotate(revenue=Sum('total'))
            .order_by('period')
        )
        collection_data = (
            pay_qs.annotate(period=TruncWeek('transaction_time'))
            .values('period')
            .annotate(collected=Sum('amount'))
            .order_by('period')
        )
        col_map = {c['period']: float(c['collected'] or 0) for c in collection_data}

        results = []
        for r in revenue_data:
            p = r['period']
            rev = float(r['revenue'] or 0)
            col = col_map.get(p, 0)
            results.append({
                'date': p.strftime('%d %b') if p else '',
                'revenue': rev,
                'collections': col,
                'outstanding': round(rev - col, 2),
            })

    else:
        # Daily
        revenue_data = (
            inv_qs.values('created_at__date')
            .annotate(revenue=Sum('total'))
            .order_by('created_at__date')
        )
        collection_data = (
            pay_qs.values('transaction_time__date')
            .annotate(collected=Sum('amount'))
            .order_by('transaction_time__date')
        )
        col_map = {c['transaction_time__date']: float(c['collected'] or 0) for c in collection_data}

        results = []
        for r in revenue_data:
            d = r['created_at__date']
            rev = float(r['revenue'] or 0)
            col = col_map.get(d, 0)
            results.append({
                'date': d.strftime('%d %b') if d else '',
                'revenue': rev,
                'collections': col,
                'outstanding': round(rev - col, 2),
            })

    return Response(results)
