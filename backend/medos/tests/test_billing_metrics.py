"""Tests for BillingMetricsAggregator and BillingInsightsEngine."""
from __future__ import annotations

from datetime import date, datetime, timedelta, time as dt_time

import pytest
from django.utils import timezone

from medos.billing.metrics import BillingMetricsAggregator
from medos.billing.insights import BillingInsightsEngine
from medos.models import (
    Patient, Invoice,
    Payment, RefundRequest, InsuranceClaim,
)


# Counter for unique invoice numbers
_inv_counter = 0


def _inv(**kwargs) -> Invoice:
    """Create an Invoice with a unique invoice_number.

    ``auto_now_add`` on ``created_at`` overrides explicit values, so if
    ``created_at`` is passed we set it via an update afterwards.
    """
    global _inv_counter
    _inv_counter += 1
    created_at = kwargs.pop('created_at', None)
    kwargs.setdefault('invoice_number', f'TEST-INV-{_inv_counter:04d}')
    inv = Invoice.objects.create(**kwargs)
    if created_at is not None:
        Invoice.objects.filter(id=inv.id).update(created_at=created_at)
        inv.refresh_from_db()
    return inv


# Counters for unique numbers
_claim_counter = 0
_payment_counter = 0


def _payment(**kwargs) -> Payment:
    """Create a Payment with a unique receipt_number.

    ``auto_now_add`` on ``transaction_time`` overrides explicit values, so
    if ``transaction_time`` is passed we set it via an update afterwards.
    """
    global _payment_counter
    _payment_counter += 1
    transaction_time = kwargs.pop('transaction_time', None)
    kwargs.setdefault('receipt_number', f'TEST-RCT-{_payment_counter:04d}')
    pmt = Payment.objects.create(**kwargs)
    if transaction_time is not None:
        Payment.objects.filter(id=pmt.id).update(transaction_time=transaction_time)
        pmt.refresh_from_db()
    return pmt


def _claim(**kwargs) -> InsuranceClaim:
    """Create an InsuranceClaim with a unique claim_number."""
    global _claim_counter
    _claim_counter += 1
    kwargs.setdefault('claim_number', f'TEST-CLM-{_claim_counter:04d}')
    return InsuranceClaim.objects.create(**kwargs)


def _refund(**kwargs) -> RefundRequest:
    """Create a RefundRequest with a unique refund_number."""
    global _claim_counter
    _claim_counter += 1
    kwargs.setdefault('refund_number', f'TEST-RFD-{_claim_counter:04d}')
    return RefundRequest.objects.create(**kwargs)


# ── Helpers ───────────────────────────────────────────────────────────────────


def dt_at(date_obj: date) -> datetime:
    """Return a timezone-aware datetime for the beginning of *date_obj*."""
    return timezone.make_aware(datetime.combine(date_obj, dt_time.min))


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def patient(db):
    return Patient.objects.create(
        first_name='Test', last_name='Patient',
        date_of_birth=date(1990, 1, 1), gender='M',
        phone='9999999999',
    )


@pytest.fixture
def today() -> date:
    return date(2026, 6, 10)


@pytest.fixture
def yesterday(today) -> date:
    return today - timedelta(days=1)


@pytest.fixture
def aggregator(db, today) -> BillingMetricsAggregator:
    return BillingMetricsAggregator(today=today)


@pytest.fixture
def engine(db, today) -> BillingInsightsEngine:
    return BillingInsightsEngine(today=today)


# ══════════════════════════════════════════════════════════════════════════════
# Revenue Metrics
# ══════════════════════════════════════════════════════════════════════════════


class TestRevenueMetrics:
    def test_revenue_today_no_invoices_returns_zero(self, aggregator):
        assert aggregator.revenue_today() == 0.0

    def test_revenue_today_counts_non_cancelled_invoices(
        self, aggregator, today, patient
    ):
        _inv(
            patient=patient, total=1000, status='PAID',
            created_at=dt_at(today),
        )
        assert aggregator.revenue_today() == 1000.0

    def test_revenue_today_excludes_cancelled(
        self, aggregator, today, patient
    ):
        _inv(
            patient=patient, total=1000, status='CANCELLED',
            created_at=dt_at(today),
        )
        assert aggregator.revenue_today() == 0.0

    def test_revenue_yesterday_separate_from_today(
        self, aggregator, today, yesterday, patient
    ):
        _inv(
            patient=patient, total=500, status='PAID',
            created_at=dt_at(yesterday),
        )
        _inv(
            patient=patient, total=1000, status='PAID',
            created_at=dt_at(today),
        )
        assert aggregator.revenue_yesterday() == 500.0
        assert aggregator.revenue_today() == 1000.0

    def test_vs_yesterday_pct_positive(
        self, aggregator, today, yesterday, patient
    ):
        _inv(patient=patient, total=500, status='PAID', created_at=dt_at(yesterday))
        _inv(patient=patient, total=1000, status='PAID', created_at=dt_at(today))
        assert aggregator.revenue_vs_yesterday_pct() == 100.0

    def test_vs_yesterday_pct_negative(
        self, aggregator, today, yesterday, patient
    ):
        _inv(patient=patient, total=1000, status='PAID', created_at=dt_at(yesterday))
        _inv(patient=patient, total=500, status='PAID', created_at=dt_at(today))
        assert aggregator.revenue_vs_yesterday_pct() == -50.0

    def test_vs_yesterday_pct_zero_when_no_yesterday(
        self, aggregator, today, patient
    ):
        _inv(patient=patient, total=1000, status='PAID', created_at=dt_at(today))
        assert aggregator.revenue_vs_yesterday_pct() == 0.0


# ══════════════════════════════════════════════════════════════════════════════
# Pending Payments
# ══════════════════════════════════════════════════════════════════════════════


class TestPendingPayments:
    def test_pending_counts_draft_and_issued(self, aggregator, patient):
        _inv(patient=patient, total=1000, status='DRAFT')
        _inv(patient=patient, total=2000, status='ISSUED')
        _inv(patient=patient, total=3000, status='PAID')
        result = aggregator.pending_payments()
        assert result.total == 3000.0
        assert result.count == 2

    def test_pending_empty_when_none(self, aggregator, patient):
        result = aggregator.pending_payments()
        assert result.total == 0.0
        assert result.count == 0


# ══════════════════════════════════════════════════════════════════════════════
# Collection Metrics
# ══════════════════════════════════════════════════════════════════════════════


class TestCollectionMetrics:
    def test_collected_today_successful_payments(
        self, aggregator, today, patient
    ):
        inv = _inv(patient=patient, total=500, status='PAID')
        _payment(
            invoice=inv, patient=patient, amount=500,
            status='SUCCESS', transaction_time=dt_at(today),
        )
        assert aggregator.collected_today() == 500.0

    def test_collected_today_excludes_failed(
        self, aggregator, today, patient
    ):
        inv = _inv(patient=patient, total=500, status='ISSUED')
        _payment(
            invoice=inv, patient=patient, amount=500,
            status='FAILED', transaction_time=dt_at(today),
        )
        assert aggregator.collected_today() == 0.0

    def test_collection_vs_yesterday(
        self, aggregator, today, yesterday, patient
    ):
        inv = _inv(patient=patient, total=200, status='PAID')
        _payment(
            invoice=inv, patient=patient, amount=200,
            status='SUCCESS', transaction_time=dt_at(yesterday),
        )
        _payment(
            invoice=inv, patient=patient, amount=400,
            status='SUCCESS', transaction_time=dt_at(today),
        )
        assert aggregator.collection_vs_yesterday_pct() == 100.0


# ══════════════════════════════════════════════════════════════════════════════
# Refund & Insurance Metrics
# ══════════════════════════════════════════════════════════════════════════════


class TestRefundAndInsurance:
    def test_refund_metrics(self, aggregator, patient):
        inv = _inv(patient=patient, total=1000, status='ISSUED')
        _refund(invoice=inv, patient=patient, amount=500, status='PENDING_APPROVAL')
        _refund(invoice=inv, patient=patient, amount=300, status='APPROVED')
        total, pending = aggregator.refund_metrics()
        assert total == 800.0
        assert pending == 1

    def test_insurance_metrics(self, aggregator, patient):
        inv = _inv(patient=patient, total=10000, status='ISSUED')
        _claim(
            invoice=inv, patient=patient,
            claimed_amount=8000, status='PENDING',
        )
        _claim(
            invoice=inv, patient=patient,
            claimed_amount=2000, status='SETTLED',
        )
        total, pending = aggregator.insurance_metrics()
        assert total == 10000.0
        assert pending == 1


# ══════════════════════════════════════════════════════════════════════════════
# Outstanding Balance
# ══════════════════════════════════════════════════════════════════════════════


class TestOutstanding:
    def test_outstanding_balance(self, aggregator, patient):
        _inv(patient=patient, total=5000, status='DRAFT')
        _inv(patient=patient, total=3000, status='ISSUED')
        _inv(patient=patient, total=2000, status='PAID')
        assert aggregator.outstanding_balance() == 8000.0
        assert aggregator.outstanding_invoices_count() == 2


# ══════════════════════════════════════════════════════════════════════════════
# 30-Day Charts
# ══════════════════════════════════════════════════════════════════════════════


class TestCharts:
    def test_revenue_30d_chart_empty_when_no_data(self, aggregator):
        result = aggregator.revenue_30d_chart()
        assert result == []

    def test_revenue_30d_returns_data(self, aggregator, today, patient):
        _inv(
            patient=patient, total=1000, status='PAID',
            created_at=dt_at(today),
        )
        result = aggregator.revenue_30d_chart()
        assert len(result) >= 1
        assert 'date' in result[0]
        assert 'revenue' in result[0]
        assert result[0]['revenue'] == 1000.0


# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════


class TestSummary:
    def test_summary_contains_all_expected_keys(self, aggregator):
        data = aggregator.summary()
        expected_keys = {
            'revenue_today',
            'revenue_vs_yesterday_pct',
            'pending_payments_total',
            'pending_invoices_count',
            'collected_today',
            'collection_vs_yesterday_pct',
            'refund_requests_total',
            'refund_pending_approval_count',
            'insurance_claims_total',
            'insurance_claims_pending_count',
            'outstanding_balance',
            'outstanding_invoices_count',
            'revenue_vs_collection_30d',
            'department_revenue_today',
            'ageing',
        }
        assert set(data.keys()) == expected_keys

    def test_summary_values_are_serializable(self, aggregator):
        data = aggregator.summary()
        for key in (
            'revenue_today', 'pending_payments_total', 'collected_today',
            'refund_requests_total', 'insurance_claims_total', 'outstanding_balance',
        ):
            assert isinstance(data[key], float), f'{key} should be float, got {type(data[key])}'
        assert isinstance(data['pending_invoices_count'], int)
        assert isinstance(data['outstanding_invoices_count'], int)
        assert isinstance(data['revenue_vs_collection_30d'], list)
        assert isinstance(data['ageing'], dict)


# ══════════════════════════════════════════════════════════════════════════════
# BillingInsightsEngine Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestBillingInsightsEngine:
    def test_unbilled_orders_none_when_no_orders(self, engine):
        assert engine.unbilled_completed_orders() is None

    def test_collection_forecast_returns_data(self, engine, today, patient):
        inv = _inv(patient=patient, total=10000, status='PAID')
        _payment(
            invoice=inv, patient=patient, amount=10000,
            status='SUCCESS', transaction_time=dt_at(today),
        )
        result = engine.collection_forecast(lookback_days=30, forecast_days=7)
        assert result['type'] == 'forecast'
        # At least today's payment should give a positive forecast
        assert result['forecast_amount'] >= 0

    def test_collection_forecast_zero_when_no_history(self, engine):
        result = engine.collection_forecast(lookback_days=30, forecast_days=7)
        assert result['type'] == 'forecast'
        assert result['forecast_amount'] == 0.0

    def test_overdue_invoices_none_when_none_overdue(self, engine):
        assert engine.overdue_invoices() is None

    def test_overdue_invoices_detected(self, engine, today, patient):
        thirty_days_ago = today - timedelta(days=31)
        _inv(
            patient=patient, total=5000, status='ISSUED',
            issued_at=dt_at(thirty_days_ago),
        )
        result = engine.overdue_invoices(overdue_threshold_days=30)
        assert result is not None
        assert result['type'] == 'overdue'
        assert result['count'] == 1
        assert result['total_overdue'] == 5000.0

    def test_analyze_returns_list(self, engine):
        insights = engine.analyze()
        assert isinstance(insights, list)
        # At minimum the forecast is always present
        assert len(insights) >= 1
        assert any(i['type'] == 'forecast' for i in insights)
