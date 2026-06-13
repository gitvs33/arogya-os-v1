"""Unit tests for LabOrderWorkflow state machine.

Tests follow the pattern: arrange (create order) → act (call workflow method)
→ assert (check status, timestamps, QC entries, alerts).
"""
from __future__ import annotations

from datetime import date

import pytest
from django.utils import timezone

from medos.lab.workflow import LabOrderWorkflow, InvalidTransition
from medos.models import (
    Patient, LabOrder, LabParameterResult, LabAlert, QCEntry, TestPanel, TestParameter,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def patient(db):
    return Patient.objects.create(
        first_name='Test', last_name='Patient',
        date_of_birth=date(1990, 1, 1), gender='M',
        phone='9999999999',
    )


@pytest.fixture
def panel(db):
    return TestPanel.objects.create(
        name='CBC', short_name='CBC', category='HEMATOLOGY',
        is_panel=True, standard_tat_hours=24,
    )


@pytest.fixture
def parameter(db, panel):
    return TestParameter.objects.create(
        panel=panel, name='Hemoglobin',
        unit='g/dL', ref_range_low=12.0, ref_range_high=16.0,
        critical_low=7.0,
    )


@pytest.fixture
def order(db, patient, panel):
    return LabOrder.objects.create(
        patient=patient, test_panel=panel, status='ORDERED',
    )


@pytest.fixture
def user(db):
    """Return a simple user-like object for performed_by fields."""
    from django.contrib.auth.models import User
    return User.objects.create_user(
        username='labtech', password='test1234',
        first_name='Lab', last_name='Tech',
    )


# ══════════════════════════════════════════════════════════════════════════════
# Transition Table
# ══════════════════════════════════════════════════════════════════════════════


class TestTransitionTable:
    def test_available_actions_ordered(self, order):
        assert LabOrderWorkflow.available_actions(order) == ['collect_sample', 'cancel']

    def test_available_actions_completed(self, order):
        order.status = 'COMPLETED'
        assert LabOrderWorkflow.available_actions(order) == []

    def test_can_perform_true(self, order):
        assert LabOrderWorkflow.can_perform('collect_sample', order) is True

    def test_can_perform_false(self, order):
        assert LabOrderWorkflow.can_perform('approve_report', order) is False

    def test_cannot_repeat_from_ordered(self, order):
        assert LabOrderWorkflow.can_perform('repeat_test', order) is False


# ══════════════════════════════════════════════════════════════════════════════
# collect_sample
# ══════════════════════════════════════════════════════════════════════════════


class TestCollectSample:
    def test_ordered_to_sample_collected(self, order, user):
        result = LabOrderWorkflow.collect_sample(order, user, notes='Venous blood')
        assert result.order.status == 'SAMPLE_COLLECTED'
        assert result.order.sample_collected_at is not None
        assert result.qc_entry is not None
        assert result.qc_entry.action == 'Sample Collected'
        assert result.qc_entry.performed_by == user

    def test_invalid_transition_raises(self, order, user):
        order.status = 'COMPLETED'
        with pytest.raises(InvalidTransition, match="collect_sample"):
            LabOrderWorkflow.collect_sample(order, user)

    def test_qc_entry_created(self, order, user):
        result = LabOrderWorkflow.collect_sample(order, user, notes='Fasting sample')
        qc = QCEntry.objects.filter(order=order, action='Sample Collected').first()
        assert qc is not None
        assert qc.notes == 'Fasting sample'
        assert qc.performed_by == user


# ══════════════════════════════════════════════════════════════════════════════
# receive_in_lab
# ══════════════════════════════════════════════════════════════════════════════


class TestReceiveInLab:
    def test_sample_collected_to_received(self, order, user):
        order.status = 'SAMPLE_COLLECTED'
        order.save()
        result = LabOrderWorkflow.receive_in_lab(order, user, instrument_id='AN-001')
        assert result.order.status == 'RECEIVED_IN_LAB'
        assert result.order.received_in_lab_at is not None

    def test_ordered_to_received_direct(self, order, user):
        """Walk-in samples can skip the SAMPLE_COLLECTED step."""
        result = LabOrderWorkflow.receive_in_lab(order, user)
        assert result.order.status == 'RECEIVED_IN_LAB'

    def test_invalid_when_completed(self, order, user):
        order.status = 'COMPLETED'
        with pytest.raises(InvalidTransition):
            LabOrderWorkflow.receive_in_lab(order, user)

    def test_qc_entry_instrument(self, order, user):
        order.status = 'SAMPLE_COLLECTED'
        order.save()
        result = LabOrderWorkflow.receive_in_lab(order, user, instrument_id='AN-002')
        qc = QCEntry.objects.filter(order=order, action='Sample Received in Lab').first()
        assert qc.instrument_id == 'AN-002'


# ══════════════════════════════════════════════════════════════════════════════
# start_analysis
# ══════════════════════════════════════════════════════════════════════════════


class TestStartAnalysis:
    def test_received_to_in_progress(self, order, user):
        order.status = 'RECEIVED_IN_LAB'
        order.save()
        result = LabOrderWorkflow.start_analysis(order, user)
        assert result.order.status == 'IN_PROGRESS'

    def test_invalid_from_ordered(self, order, user):
        with pytest.raises(InvalidTransition):
            LabOrderWorkflow.start_analysis(order, user)


# ══════════════════════════════════════════════════════════════════════════════
# submit_results
# ══════════════════════════════════════════════════════════════════════════════


class TestSubmitResults:
    def test_received_to_under_review(self, order, user, parameter):
        order.status = 'RECEIVED_IN_LAB'
        order.save()
        results = [{'parameter': str(parameter.id), 'result_value': '13.5', 'result_numeric': 13.5}]
        result = LabOrderWorkflow.submit_results(order, user, results)
        assert result.order.status == 'UNDER_REVIEW'
        assert result.order.analysis_completed_at is not None

    def test_in_progress_to_under_review(self, order, user, parameter):
        order.status = 'IN_PROGRESS'
        order.save()
        results = [{'parameter': str(parameter.id), 'result_value': '14.0', 'result_numeric': 14.0}]
        result = LabOrderWorkflow.submit_results(order, user, results)
        assert result.order.status == 'UNDER_REVIEW'

    def test_raises_invalid_from_ordered(self, order, user, parameter):
        with pytest.raises(InvalidTransition):
            LabOrderWorkflow.submit_results(order, user, [])

    def test_raises_value_error_empty_results(self, order, user):
        order.status = 'RECEIVED_IN_LAB'
        order.save()
        with pytest.raises(ValueError, match='No results'):
            LabOrderWorkflow.submit_results(order, user, [])

    def test_parameter_result_persisted(self, order, user, parameter):
        order.status = 'RECEIVED_IN_LAB'
        order.save()
        results = [{'parameter': str(parameter.id), 'result_value': '13.5', 'result_numeric': 13.5}]
        LabOrderWorkflow.submit_results(order, user, results)
        pr = LabParameterResult.objects.get(order=order, parameter=parameter)
        assert pr.result_value == '13.5'
        assert float(pr.result_numeric) == 13.5
        assert pr.entered_by == user

    def test_auto_escalate_to_critical(self, order, user, parameter):
        """If a result_numeric is <= critical_low, result auto-computes to
        CRITICAL, and the order escalates to CRITICAL with a LabAlert."""
        order.status = 'RECEIVED_IN_LAB'
        order.save()
        # Value 6.5 is <= critical_low (7.0) → auto-computes to CRITICAL.
        LabParameterResult.objects.create(
            order=order, parameter=parameter,
            result_value='6.5', result_numeric=6.5,
            entered_by=user,
        )
        created = LabOrderWorkflow.auto_create_critical_alerts(order, user)
        order.refresh_from_db()
        assert created >= 1
        assert order.status == 'CRITICAL'
        alerts = LabAlert.objects.filter(order=order)
        assert alerts.count() >= 1


# ══════════════════════════════════════════════════════════════════════════════
# approve_report
# ══════════════════════════════════════════════════════════════════════════════


class TestApproveReport:
    def test_under_review_to_completed(self, order, user):
        order.status = 'UNDER_REVIEW'
        order.save()
        result = LabOrderWorkflow.approve_report(order, user, notes='All good')
        assert result.order.status == 'COMPLETED'
        assert result.order.reviewed_by == user
        assert result.order.reported_at is not None

    def test_critical_to_completed(self, order, user):
        order.status = 'CRITICAL'
        order.save()
        result = LabOrderWorkflow.approve_report(order, user)
        assert result.order.status == 'COMPLETED'

    def test_invalid_from_ordered(self, order, user):
        with pytest.raises(InvalidTransition):
            LabOrderWorkflow.approve_report(order, user)

    def test_qc_entry_created(self, order, user):
        order.status = 'UNDER_REVIEW'
        order.save()
        result = LabOrderWorkflow.approve_report(order, user)
        qc = QCEntry.objects.filter(order=order, action='Report Approved & Signed Off').first()
        assert qc is not None


# ══════════════════════════════════════════════════════════════════════════════
# cancel
# ══════════════════════════════════════════════════════════════════════════════


class TestCancel:
    def test_ordered_to_cancelled(self, order, user):
        result = LabOrderWorkflow.cancel(order, user, reason='Duplicate order')
        assert result.order.status == 'CANCELLED'

    def test_invalid_from_completed(self, order, user):
        order.status = 'COMPLETED'
        with pytest.raises(InvalidTransition):
            LabOrderWorkflow.cancel(order, user)

    def test_invalid_from_under_review(self, order, user):
        order.status = 'UNDER_REVIEW'
        with pytest.raises(InvalidTransition):
            LabOrderWorkflow.cancel(order, user)


# ══════════════════════════════════════════════════════════════════════════════
# repeat_test
# ══════════════════════════════════════════════════════════════════════════════


class TestRepeatTest:
    def test_creates_new_order(self, order, user):
        new_order = LabOrderWorkflow.repeat_test(order, user)
        assert new_order.id != order.id
        assert new_order.patient == order.patient
        assert new_order.test_panel == order.test_panel
        assert new_order.status == 'ORDERED'
        assert new_order.ordered_by == user

    def test_original_unchanged(self, order, user):
        original_status = order.status
        LabOrderWorkflow.repeat_test(order, user)
        order.refresh_from_db()
        assert order.status == original_status

    def test_qc_entry_on_new_order(self, order, user):
        new_order = LabOrderWorkflow.repeat_test(order, user)
        qc = QCEntry.objects.filter(order=new_order, action='Repeat Test Ordered').first()
        assert qc is not None
        assert order.lab_id in qc.notes


# ══════════════════════════════════════════════════════════════════════════════
# add_note
# ══════════════════════════════════════════════════════════════════════════════


class TestAddNote:
    def test_appends_comment(self, order, user):
        LabOrderWorkflow.add_note(order, user, 'First note')
        assert 'First note' in order.comments
        assert user.get_full_name() in order.comments

    def test_appends_to_existing_comment(self, order, user):
        order.comments = 'Initial remark'
        order.save()
        LabOrderWorkflow.add_note(order, user, 'Second note')
        order.refresh_from_db()
        assert 'Initial remark' in order.comments
        assert 'Second note' in order.comments

    def test_qc_entry_created(self, order, user):
        result = LabOrderWorkflow.add_note(order, user, 'Urgent review needed')
        assert result.qc_entry.action == 'Pathologist Comment Added'
        assert result.qc_entry.notes == 'Urgent review needed'


# ══════════════════════════════════════════════════════════════════════════════
# Full Happy-Path Integration — ORDERED → COMPLETED
# ══════════════════════════════════════════════════════════════════════════════


class TestFullLifecycle:
    def test_ordered_to_completed(self, order, user, parameter):
        # 1. Collect sample
        result = LabOrderWorkflow.collect_sample(order, user)
        assert result.order.status == 'SAMPLE_COLLECTED'

        # 2. Receive in lab
        result = LabOrderWorkflow.receive_in_lab(result.order, user)
        assert result.order.status == 'RECEIVED_IN_LAB'

        # 3. Start analysis
        result = LabOrderWorkflow.start_analysis(result.order, user)
        assert result.order.status == 'IN_PROGRESS'

        # 4. Submit results
        results = [{'parameter': str(parameter.id), 'result_value': '13.5', 'result_numeric': 13.5}]
        result = LabOrderWorkflow.submit_results(result.order, user, results)
        assert result.order.status == 'UNDER_REVIEW'

        # 5. Approve report
        result = LabOrderWorkflow.approve_report(result.order, user)
        assert result.order.status == 'COMPLETED'

        # Verify 5 QC entries were created across the lifecycle
        qc_count = QCEntry.objects.filter(order=order).count()
        assert qc_count == 5
