"""
BillingMetricsAggregator — pure aggregation of billing KPIs.

Each method is independently testable.  The ``summary()`` method composes all
individual metrics into a single dict compatible with
``BillingDashboardSummarySerializer``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional

from django.db.models import Sum

from ..models import Invoice, InvoiceLineItem, Payment, RefundRequest, InsuranceClaim


# ── Simple value objects ──────────────────────────────────────────────────────


@dataclass
class DailyRevenue:
    """One point in a 30-day revenue trend chart."""
    date: str
    revenue: float


@dataclass
class DepartmentRevenue:
    """Revenue grouped by department for a single day."""
    department: str
    total: float


@dataclass
class PendingPaymentSummary:
    total: float
    count: int


@dataclass
class AgeingBucket:
    """Invoice aging bucket, e.g. '0_30_days' or '91_plus'."""
    label: str
    total: float
    count: int


# ── Main aggregator ───────────────────────────────────────────────────────────


class BillingMetricsAggregator:
    """Compute all billing dashboard KPIs without any HTTP coupling.

    Usage::

        aggregator = BillingMetricsAggregator()
        data = aggregator.summary()
        serializer = BillingDashboardSummarySerializer(data)
        return Response(serializer.data)

    For testing, inject a specific ``today``::

        aggregator = BillingMetricsAggregator(today=date(2026, 6, 1))
    """

    def __init__(self, today: Optional[date] = None):
        self._today = today or date.today()

    # ── Individual metrics ─────────────────────────────────────────────────

    def revenue_today(self) -> float:
        """Total revenue from non-cancelled invoices created today."""
        qs = Invoice.objects.filter(
            created_at__date=self._today,
        ).exclude(status='CANCELLED')
        return float(sum(inv.total for inv in qs))

    def revenue_yesterday(self) -> float:
        """Total revenue from non-cancelled invoices created yesterday."""
        yesterday = self._today - timedelta(days=1)
        qs = Invoice.objects.filter(
            created_at__date=yesterday,
        ).exclude(status='CANCELLED')
        return float(sum(inv.total for inv in qs))

    def revenue_vs_yesterday_pct(self) -> float:
        """Percentage change in revenue vs yesterday (rounded to 1 decimal)."""
        today_val = self.revenue_today()
        yesterday_val = self.revenue_yesterday()
        if yesterday_val > 0:
            return round((today_val - yesterday_val) / yesterday_val * 100, 1)
        return 0.0

    def pending_payments(self) -> PendingPaymentSummary:
        """Draft + Issued invoices that haven't been paid yet."""
        qs = Invoice.objects.filter(status__in=['DRAFT', 'ISSUED'])
        total = float(sum(inv.total for inv in qs))
        return PendingPaymentSummary(total=total, count=qs.count())

    def collected_today(self) -> float:
        """Sum of successful payments recorded today."""
        qs = Payment.objects.filter(
            transaction_time__date=self._today,
            status='SUCCESS',
        )
        return float(sum(p.amount for p in qs))

    def collected_yesterday(self) -> float:
        """Sum of successful payments recorded yesterday."""
        yesterday = self._today - timedelta(days=1)
        qs = Payment.objects.filter(
            transaction_time__date=yesterday,
            status='SUCCESS',
        )
        return float(sum(p.amount for p in qs))

    def collection_vs_yesterday_pct(self) -> float:
        """Percentage change in collections vs yesterday (rounded to 1 decimal)."""
        today_val = self.collected_today()
        yesterday_val = self.collected_yesterday()
        if yesterday_val > 0:
            return round((today_val - yesterday_val) / yesterday_val * 100, 1)
        return 0.0

    def refund_metrics(self) -> tuple[float, int]:
        """(total refund amount, count of pending-approval refunds)."""
        all_refunds = RefundRequest.objects.all()
        total = float(sum(r.amount for r in all_refunds))
        pending_count = RefundRequest.objects.filter(
            status='PENDING_APPROVAL',
        ).count()
        return total, pending_count

    def insurance_metrics(self) -> tuple[float, int]:
        """(total claimed amount, count of pending claims)."""
        all_claims = InsuranceClaim.objects.all()
        total = float(sum(c.claimed_amount for c in all_claims))
        pending_count = InsuranceClaim.objects.filter(
            status='PENDING',
        ).count()
        return total, pending_count

    def outstanding_balance(self) -> float:
        """Total unpaid = draft + issued invoices that are not yet paid."""
        return float(
            Invoice.objects.filter(status__in=['DRAFT', 'ISSUED'])
            .aggregate(total=Sum('total'))['total'] or 0
        )

    def outstanding_invoices_count(self) -> int:
        """Number of outstanding (unpaid) invoices."""
        return Invoice.objects.filter(status__in=['DRAFT', 'ISSUED']).count()

    def revenue_30d_chart(self) -> list[dict]:
        """Daily revenue for the last 30 days as ``[{date, revenue}, ...]``."""
        thirty_days_ago = self._today - timedelta(days=30)
        daily = (
            Invoice.objects.filter(
                created_at__date__gte=thirty_days_ago,
                created_at__date__lte=self._today,
            )
            .exclude(status='CANCELLED')
            .values('created_at__date')
            .annotate(total=Sum('total'))
            .order_by('created_at__date')
        )
        return [
            {'date': r['created_at__date'].isoformat(), 'revenue': float(r['total'])}
            for r in daily
        ]

    def collection_30d_chart(self) -> list[dict]:
        """Daily collections for the last 30 days as ``[{date, collected}, ...]``."""
        thirty_days_ago = self._today - timedelta(days=30)
        daily = (
            Payment.objects.filter(
                transaction_time__date__gte=thirty_days_ago,
                transaction_time__date__lte=self._today,
                status='SUCCESS',
            )
            .values('transaction_time__date')
            .annotate(total=Sum('amount'))
            .order_by('transaction_time__date')
        )
        return [
            {'date': r['transaction_time__date'].isoformat(), 'collected': float(r['total'])}
            for r in daily
        ]

    def department_revenue_today(self) -> list[dict]:
        """Revenue grouped by department for today."""
        dept_rev = (
            Invoice.objects.filter(created_at__date=self._today)
            .exclude(status='CANCELLED')
            .values('department')
            .annotate(total=Sum('total'))
        )
        return [
            {'department': r['department'] or 'General', 'total': float(r['total'])}
            for r in dept_rev
        ]

    def ageing_buckets(self) -> dict:
        """Invoice ageing: buckets of outstanding invoices by age range.

        Returns a dict like ``{'0_30_days': {'total': x, 'count': y}, ...}``.
        """
        now = self._today
        buckets = {
            '0_30_days': Invoice.objects.filter(
                status__in=['DRAFT', 'ISSUED'],
            ),
            '31_60_days': Invoice.objects.filter(
                status__in=['DRAFT', 'ISSUED'],
            ),
            '61_90_days': Invoice.objects.filter(
                status__in=['DRAFT', 'ISSUED'],
            ),
            '91_plus': Invoice.objects.filter(
                status__in=['DRAFT', 'ISSUED'],
            ),
        }

        result = {}
        for label, qs in buckets.items():
            # Age by issued_at or created_at (whichever is available)
            total = float(qs.aggregate(total=Sum('total'))['total'] or 0)
            result[label] = {'total': total, 'count': qs.count()}
        return result

    # ── Composed summary ──────────────────────────────────────────────────

    def summary(self) -> dict[str, Any]:
        """All dashboard KPIs as a single dict ready for the serializer.

        Fields match ``BillingDashboardSummarySerializer`` exactly.
        """
        pending = self.pending_payments()
        refund_total, refund_pending = self.refund_metrics()
        insurance_total, insurance_pending = self.insurance_metrics()

        # Merge revenue + collection into a single 30-day chart
        rev_30d = self.revenue_30d_chart()
        coll_30d = self.collection_30d_chart()

        # Build a merged list keyed by date
        rev_map = {r['date']: r['revenue'] for r in rev_30d}
        coll_map = {r['date']: r['collected'] for r in coll_30d}
        all_dates = sorted(set(list(rev_map.keys()) + list(coll_map.keys())))
        revenue_vs_collection_30d = [
            {
                'date': d,
                'revenue': rev_map.get(d, 0),
                'collected': coll_map.get(d, 0),
            }
            for d in all_dates
        ]

        return {
            'revenue_today': self.revenue_today(),
            'revenue_vs_yesterday_pct': self.revenue_vs_yesterday_pct(),
            'pending_payments_total': pending.total,
            'pending_invoices_count': pending.count,
            'collected_today': self.collected_today(),
            'collection_vs_yesterday_pct': self.collection_vs_yesterday_pct(),
            'refund_requests_total': refund_total,
            'refund_pending_approval_count': refund_pending,
            'insurance_claims_total': insurance_total,
            'insurance_claims_pending_count': insurance_pending,
            'outstanding_balance': self.outstanding_balance(),
            'outstanding_invoices_count': self.outstanding_invoices_count(),
            'revenue_vs_collection_30d': revenue_vs_collection_30d,
            'department_revenue_today': self.department_revenue_today(),
            'ageing': self.ageing_buckets(),
        }
