"""
Alert broadcaster interface and implementations.

Separates the *side effects* of alerting (persisting to DB, broadcasting over
WebSocket) from the pure threshold evaluation logic in :mod:`thresholds`.
"""
import logging
from abc import ABC, abstractmethod
from typing import Any

from .thresholds import BreachedThreshold

logger = logging.getLogger(__name__)

# Type for the serialised alert payload returned by broadcasters
AlertPayload = dict[str, str | dict | None]


class AlertBroadcaster(ABC):
    """Abstract base for alert broadcasters.

    Implementations handle the impure parts of alerting: persisting alerts
    to the database and pushing them over WebSocket (or any other channel).
    """

    @abstractmethod
    def broadcast(
        self,
        breaches: list[BreachedThreshold],
        patient_id: str,
        encounter_id: str,
    ) -> list[AlertPayload]:
        """Persist alerts and push to subscribers.

        Args:
            breaches: The list of breached thresholds to broadcast.
            patient_id: The patient's primary key.
            encounter_id: The encounter's primary key.

        Returns:
            A list of serialised alert payloads that were generated.
        """
        ...


class DatabaseAndWebSocketBroadcaster(AlertBroadcaster):
    """Production broadcaster.

    Creates ``MedicalAlert`` records in the database and broadcasts
    each alert over the ``alerts`` WebSocket group.
    """

    def broadcast(
        self,
        breaches: list[BreachedThreshold],
        patient_id: str,
        encounter_id: str,
    ) -> list[AlertPayload]:
        from django.utils import timezone
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from ..models import MedicalAlert

        channel_layer = get_channel_layer()
        payloads: list[AlertPayload] = []

        for breach in breaches:
            message = (
                f"{breach.label} is too {'high' if breach.actual_value > breach.max else 'low'}: "
                f"{breach.actual_value} (range: {breach.min}–{breach.max})"
            )

            try:
                alert = MedicalAlert.objects.create(
                    alert_type='VITALS',
                    severity=breach.severity,
                    status='ACTIVE',
                    patient_id=patient_id,
                    encounter_id=encounter_id,
                    message=message,
                    details={
                        'threshold_name': breach.name,
                        'threshold_label': breach.label,
                        'min': breach.min,
                        'max': breach.max,
                        'actual_value': breach.actual_value,
                        'field': breach.name,
                    },
                )
            except Exception as exc:
                logger.error(
                    'Failed to create MedicalAlert for patient %s: %s',
                    patient_id, exc,
                )
                continue

            payload: AlertPayload = {
                'id': str(alert.id),
                'alert_type': alert.alert_type,
                'severity': alert.severity,
                'status': alert.status,
                'patient_id': str(patient_id),
                'encounter_id': str(encounter_id),
                'message': alert.message,
                'details': alert.details,
                'created_at': alert.created_at.isoformat(),
            }
            payloads.append(payload)

            # ── Broadcast alert over WebSocket ───────────────────────────
            try:
                async_to_sync(channel_layer.group_send)(
                    'alerts',
                    {
                        'type': 'alert_push',
                        'data': payload,
                    },
                )
            except Exception as exc:
                logger.error(
                    'Failed to broadcast alert via channel_layer: %s', exc,
                )

        return payloads


class LoggingBroadcaster(AlertBroadcaster):
    """Test/dev broadcaster — just logs what would have been sent.

    Does not touch the database or WebSocket. Useful for development
    and for writing hermetic tests.
    """

    def broadcast(
        self,
        breaches: list[BreachedThreshold],
        patient_id: str,
        encounter_id: str,
    ) -> list[AlertPayload]:
        payloads: list[AlertPayload] = []

        for breach in breaches:
            payload: AlertPayload = {
                'id': '<dry-run>',
                'alert_type': 'VITALS',
                'severity': breach.severity,
                'status': 'ACTIVE',
                'patient_id': str(patient_id),
                'encounter_id': str(encounter_id),
                'message': (
                    f"{breach.label} is too "
                    f"{'high' if breach.actual_value > breach.max else 'low'}: "
                    f"{breach.actual_value} (range: {breach.min}–{breach.max})"
                ),
                'details': {
                    'threshold_name': breach.name,
                    'threshold_label': breach.label,
                    'min': breach.min,
                    'max': breach.max,
                    'actual_value': breach.actual_value,
                    'field': breach.name,
                },
                'created_at': '',
            }
            payloads.append(payload)

        logger.info(
            '[LoggingBroadcaster] Would broadcast %d alert(s) for patient %s '
            '(encounter %s)',
            len(payloads), patient_id, encounter_id,
        )

        return payloads
