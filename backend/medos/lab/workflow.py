"""LabOrderWorkflow — state machine for lab order lifecycle.

Encodes every valid transition and the side-effects for each state
change (QC audit trail, critical-alert creation, timestamp updates).

Usage::

    workflow = LabOrderWorkflow()
    order = workflow.collect_sample(order, request.user, notes="...")
    order = workflow.submit_results(order, request.user, results=[...])
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, ClassVar

from django.db import transaction
from django.utils import timezone

from ..models import LabOrder, LabParameterResult, LabAlert, QCEntry


# ── Domain Errors ─────────────────────────────────────────────────────────────


class InvalidTransition(ValueError):
    """Raised when an action is not allowed from the current order status."""

    def __init__(self, action: str, current_status: str) -> None:
        self.action = action
        self.current_status = current_status
        super().__init__(f"Cannot '{action}' — current status is '{current_status}'")


# ── Transition Table ──────────────────────────────────────────────────────────

# Maps current status → list of allowed action names.
TRANSITIONS: dict[str, list[str]] = {
    'ORDERED':             ['collect_sample', 'cancel'],
    'SAMPLE_COLLECTED':    ['receive_in_lab', 'cancel'],
    'RECEIVED_IN_LAB':     ['start_analysis', 'cancel'],
    'IN_PROGRESS':         ['submit_results'],
    'UNDER_REVIEW':        ['approve_report', 'repeat_test'],
    'CRITICAL':            ['approve_report', 'repeat_test'],
    'COMPLETED':           [],
    'CANCELLED':           [],
}

# Actions that set the order to a new status (mapping action → target status).
ACTION_TARGETS: dict[str, str] = {
    'collect_sample':   'SAMPLE_COLLECTED',
    'receive_in_lab':   'RECEIVED_IN_LAB',
    'start_analysis':   'IN_PROGRESS',
    'submit_results':   'UNDER_REVIEW',   # may be overridden to CRITICAL if critical results found
    'approve_report':   'COMPLETED',
    'cancel':           'CANCELLED',
}


# ── Result Container ──────────────────────────────────────────────────────────


@dataclass
class TransitionResult:
    """Returned by every lifecycle action."""

    order: LabOrder
    qc_entry: QCEntry | None = None
    alerts_created: int = 0
    extra: dict[str, Any] = field(default_factory=dict)


# ── Workflow Engine ───────────────────────────────────────────────────────────


class LabOrderWorkflow:
    """Lab order state machine — validates transitions and orchestrates side-effects."""

    # Expose transition table so callers can inspect valid actions.
    transitions: ClassVar[dict[str, list[str]]] = TRANSITIONS
    action_targets: ClassVar[dict[str, str]] = ACTION_TARGETS

    # ── Public helpers ────────────────────────────────────────────────────

    @staticmethod
    def available_actions(order: LabOrder) -> list[str]:
        """Return allowed actions for the current status."""
        return TRANSITIONS.get(order.status, [])

    @staticmethod
    def can_perform(action: str, order: LabOrder) -> bool:
        """Check if *action* is valid for the current status (no exception)."""
        return action in TRANSITIONS.get(order.status, [])

    @staticmethod
    def _raise_if_not_allowed(action: str, order: LabOrder) -> None:
        if not LabOrderWorkflow.can_perform(action, order):
            raise InvalidTransition(action, order.status)

    # ── Lifecycle Methods ──────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def collect_sample(
        order: LabOrder,
        user: Any,
        *,
        notes: str = "",
    ) -> TransitionResult:
        """ORDERED → SAMPLE_COLLECTED."""
        LabOrderWorkflow._raise_if_not_allowed('collect_sample', order)

        order.status = 'SAMPLE_COLLECTED'
        order.sample_collected_at = timezone.now()
        order.save(update_fields=['status', 'sample_collected_at', 'updated_at'])

        qc = QCEntry.objects.create(
            order=order,
            action='Sample Collected',
            performed_by=user,
            notes=notes,
        )

        return TransitionResult(order=order, qc_entry=qc)

    @staticmethod
    @transaction.atomic
    def receive_in_lab(
        order: LabOrder,
        user: Any,
        *,
        instrument_id: str = "",
        notes: str = "",
    ) -> TransitionResult:
        """SAMPLE_COLLECTED → RECEIVED_IN_LAB.

        Also accepts ORDERED as source (for direct walk-in samples that were
        never formally "collected" by a phlebotomist).
        """
        if order.status not in ('SAMPLE_COLLECTED', 'ORDERED'):
            raise InvalidTransition('receive_in_lab', order.status)

        order.status = 'RECEIVED_IN_LAB'
        order.received_in_lab_at = timezone.now()
        order.save(update_fields=['status', 'received_in_lab_at', 'updated_at'])

        qc = QCEntry.objects.create(
            order=order,
            action='Sample Received in Lab',
            performed_by=user,
            instrument_id=instrument_id,
            notes=notes,
        )

        return TransitionResult(order=order, qc_entry=qc)

    @staticmethod
    @transaction.atomic
    def start_analysis(
        order: LabOrder,
        user: Any,
        *,
        notes: str = "",
    ) -> TransitionResult:
        """RECEIVED_IN_LAB → IN_PROGRESS."""
        LabOrderWorkflow._raise_if_not_allowed('start_analysis', order)

        order.status = 'IN_PROGRESS'
        order.save(update_fields=['status', 'updated_at'])

        qc = QCEntry.objects.create(
            order=order,
            action='Analysis Started',
            performed_by=user,
            notes=notes,
        )

        return TransitionResult(order=order, qc_entry=qc)

    @staticmethod
    @transaction.atomic
    def submit_results(
        order: LabOrder,
        user: Any,
        results: list[dict],
    ) -> TransitionResult:
        """RECEIVED_IN_LAB or IN_PROGRESS → UNDER_REVIEW (or CRITICAL).

        Persists parameter results, then auto-promotes to CRITICAL if any
        result has status == 'CRITICAL'.
        """
        if order.status not in ('RECEIVED_IN_LAB', 'IN_PROGRESS'):
            raise InvalidTransition('submit_results', order.status)

        if not results:
            raise ValueError("No results provided.")

        # Create / update parameter results.
        for r in results:
            LabParameterResult.objects.update_or_create(
                order=order,
                parameter_id=r['parameter'],
                defaults={
                    'result_value': r.get('result_value', ''),
                    'result_numeric': r.get('result_numeric'),
                    'notes': r.get('notes', ''),
                    'entered_by': user,
                },
            )

        order.status = 'UNDER_REVIEW'
        order.analysis_completed_at = timezone.now()
        order.save(update_fields=['status', 'analysis_completed_at', 'updated_at'])

        qc = QCEntry.objects.create(
            order=order,
            action='Results Submitted',
            performed_by=user,
            notes=f'{len(results)} parameter(s) entered',
        )

        # Check for critical results and auto-escalate.
        alerts_created = LabOrderWorkflow.auto_create_critical_alerts(order, user)

        result = TransitionResult(
            order=order,
            qc_entry=qc,
            alerts_created=alerts_created,
        )

        # If an alert was created the status was bumped to CRITICAL inside
        # _auto_create_critical_alerts, so refresh the order object.
        if alerts_created > 0:
            order.refresh_from_db()

        return result

    @staticmethod
    def auto_create_critical_alerts(order: LabOrder, user: Any) -> int:
        """Check for critical parameter results and create alerts + escalate.

        Returns the number of alerts created.
        """
        critical_results = order.parameter_results.filter(status='CRITICAL')
        created = 0
        for cr in critical_results:
            _, was_created = LabAlert.objects.get_or_create(
                order=order,
                parameter_result=cr,
                patient=order.patient,
                severity='CRITICAL',
                defaults={
                    'alert_message': (
                        f"{order.test_panel.name} — {cr.parameter.name}: "
                        f"{cr.result_value} {cr.parameter.unit} (Critical)"
                    ),
                },
            )
            if was_created:
                created += 1

        if created > 0:
            order.status = 'CRITICAL'
            order.save(update_fields=['status', 'updated_at'])

        return created

    @staticmethod
    @transaction.atomic
    def approve_report(
        order: LabOrder,
        user: Any,
        *,
        notes: str = "",
    ) -> TransitionResult:
        """UNDER_REVIEW or CRITICAL → COMPLETED."""
        if order.status not in ('UNDER_REVIEW', 'CRITICAL'):
            raise InvalidTransition('approve_report', order.status)

        order.status = 'COMPLETED'
        order.reviewed_by = user
        order.reported_at = timezone.now()
        order.save(update_fields=['status', 'reviewed_by', 'reported_at', 'updated_at'])

        qc = QCEntry.objects.create(
            order=order,
            action='Report Approved & Signed Off',
            performed_by=user,
            notes=notes,
        )

        return TransitionResult(order=order, qc_entry=qc)

    @staticmethod
    @transaction.atomic
    def cancel(
        order: LabOrder,
        user: Any,
        *,
        reason: str = "",
    ) -> TransitionResult:
        """ORDERED, SAMPLE_COLLECTED, or RECEIVED_IN_LAB → CANCELLED."""
        LabOrderWorkflow._raise_if_not_allowed('cancel', order)

        order.status = 'CANCELLED'
        order.save(update_fields=['status', 'updated_at'])

        qc = QCEntry.objects.create(
            order=order,
            action='Order Cancelled',
            performed_by=user,
            notes=reason,
        )

        return TransitionResult(order=order, qc_entry=qc)

    @staticmethod
    @transaction.atomic
    def repeat_test(
        original: LabOrder,
        user: Any,
        *,
        comments: str = "",
    ) -> LabOrder:
        """Create a duplicate order to repeat the test (regardless of status).

        Does *not* change the original order's status.
        """
        new_order = LabOrder.objects.create(
            patient=original.patient,
            encounter=original.encounter,
            test_panel=original.test_panel,
            department=original.department,
            sample_type=original.sample_type,
            priority=original.priority,
            visit_type=original.visit_type,
            bed_unit=original.bed_unit,
            ordered_by=user,
            comments=comments or f'Repeat of {original.lab_id}',
        )

        QCEntry.objects.create(
            order=new_order,
            action='Repeat Test Ordered',
            performed_by=user,
            notes=f'Original order: {original.lab_id}',
        )

        return new_order

    @staticmethod
    @transaction.atomic
    def add_note(
        order: LabOrder,
        user: Any,
        note: str,
    ) -> TransitionResult:
        """Append a pathologist comment (no status change)."""
        timestamp = timezone.now().strftime('%Y-%m-%d %H:%M')
        header = f"{timestamp} — {user.get_full_name() or user.username}:"

        existing = order.comments or ""
        if existing:
            order.comments = f"{existing}\n---\n{header}\n{note}"
        else:
            order.comments = f"{header}\n{note}"
        order.save(update_fields=['comments', 'updated_at'])

        qc = QCEntry.objects.create(
            order=order,
            action='Pathologist Comment Added',
            performed_by=user,
            notes=note[:200],
        )

        return TransitionResult(order=order, qc_entry=qc)
