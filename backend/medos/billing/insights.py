"""
BillingInsightsEngine — analytical insights for the billing dashboard.

Each insight is independently testable.  The ``analyze()`` method composes all
insights into a list compatible with ``BillingInsightsView``.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional

from django.db.models import Sum

from ..models import Invoice, Payment


class BillingInsightsEngine:
    """Generate billing insights and forecasts without HTTP coupling.

    Usage::

        engine = BillingInsightsEngine()
        insights = engine.analyze()
        return Response(insights)

    For testing, inject a specific ``today``::

        engine = BillingInsightsEngine(today=date(2026, 6, 1))
    """

    def __init__(self, today: Optional[date] = None):
        self._today = today or date.today()

    # ── Individual insights ───────────────────────────────────────────────

    def unbilled_completed_orders(self, max_results: int = 5) -> Optional[dict]:
        """Detect completed lab/imaging orders that haven't been billed.

        Note: there is no direct FK from InvoiceLineItem to LabOrder,
        so this check requires an alternative approach (e.g. a flag on
        LabOrder or a cross-reference table).  Returns ``None`` until
        the data model supports this.
        """
        return None

    def collection_forecast(
        self,
        lookback_days: int = 30,
        forecast_days: int = 7,
    ) -> dict:
        """Forecast future collections based on historical average.

        Always returns a forecast (may be zero if no history).
        """
        since = self._today - timedelta(days=lookback_days)
        recent_payments = Payment.objects.filter(
            transaction_time__date__gte=since,
            status='SUCCESS',
        )
        total_collected = sum(p.amount for p in recent_payments)
        avg_daily = float(total_collected) / lookback_days if total_collected > 0 else 0.0
        projected = avg_daily * forecast_days

        return {
            'type': 'forecast',
            'severity': 'info',
            'title': f'{forecast_days}-Day Collection Forecast',
            'message': (
                f'Projected collection: ₹{projected:,.0f} over next {forecast_days} days '
                f'(based on {lookback_days}-day average of ₹{avg_daily:,.0f}/day)'
            ),
            'forecast_amount': round(projected, 2),
        }

    def overdue_invoices(
        self,
        overdue_threshold_days: int = 30,
    ) -> Optional[dict]:
        """Detect invoices that have been issued but unpaid beyond the threshold.

        Returns a single insight dict, or ``None`` if none overdue.
        """
        cutoff = self._today - timedelta(days=overdue_threshold_days)
        overdue = Invoice.objects.filter(
            status='ISSUED',
            issued_at__lt=cutoff,
        )

        if not overdue.exists():
            return None

        total_overdue = float(sum(inv.total for inv in overdue))

        return {
            'type': 'overdue',
            'severity': 'high',
            'title': 'Overdue Invoices',
            'message': (
                f'{overdue.count()} invoices overdue by more than '
                f'{overdue_threshold_days} days (₹{total_overdue:,.0f} total).'
            ),
            'count': overdue.count(),
            'total_overdue': round(total_overdue, 2),
        }

    # ── Composed analysis ─────────────────────────────────────────────────

    def analyze(self) -> list[dict[str, Any]]:
        """All insights as a list, matching ``BillingInsightsView`` output.

        Filters out ``None`` results (when no issues are found).
        """
        insights: list[dict[str, Any]] = []

        unbilled = self.unbilled_completed_orders()
        if unbilled is not None:
            insights.append(unbilled)

        insights.append(self.collection_forecast())

        overdue = self.overdue_invoices()
        if overdue is not None:
            insights.append(overdue)

        return insights
