"""
Threshold-based alert engine for TeleICU vitals monitoring.

Defines clinical thresholds and, when a value breaches a threshold,
creates a MedicalAlert record and broadcasts the alert over WebSocket.
"""
import logging
from decimal import Decimal

from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import MedicalAlert

logger = logging.getLogger(__name__)

# ── Clinical Thresholds ──────────────────────────────────────────────────────
# Each entry has a human-readable label, the field name used in the Vitals
# model / serialised payload, (min, max) range, and a severity level.

THRESHOLDS = [
    {
        'name': 'heart_rate',
        'label': 'Heart Rate (bpm)',
        'min': 50,
        'max': 120,
        'severity': 'CRITICAL',
    },
    {
        'name': 'systolic_bp',
        'label': 'Systolic BP (mmHg)',
        'min': 90,
        'max': 180,
        'severity': 'CRITICAL',
    },
    {
        'name': 'diastolic_bp',
        'label': 'Diastolic BP (mmHg)',
        'min': 60,
        'max': 120,
        'severity': 'WARNING',
    },
    {
        'name': 'oxygen_saturation',
        'label': 'SpO₂ (%)',
        'min': 90,
        'max': 100,
        'severity': 'CRITICAL',
    },
    {
        'name': 'temperature',
        'label': 'Temperature (°C)',
        'min': 35.0,
        'max': 39.0,
        'severity': 'CRITICAL',
    },
    {
        'name': 'respiratory_rate',
        'label': 'Respiratory Rate (breaths/min)',
        'min': 8,
        'max': 30,
        'severity': 'WARNING',
    },
]

# Map threshold name → Vitals model field name
FIELD_MAP = {
    'heart_rate': 'heart_rate',
    'systolic_bp': 'systolic_bp',
    'diastolic_bp': 'diastolic_bp',
    'oxygen_saturation': 'oxygen_saturation',
    'temperature': 'temperature',
    'respiratory_rate': 'respiratory_rate',
}


def build_alert_message(threshold, actual_value):
    """Return a human-readable alert message for a breached threshold."""
    direction = 'high' if actual_value > threshold['max'] else 'low'
    return (
        f"{threshold['label']} is too {direction}: "
        f"{actual_value} (range: {threshold['min']}–{threshold['max']})"
    )


def check_vitals_thresholds(vitals_data, patient_id, encounter_id):
    """Evaluate *vitals_data* against every registered threshold.

    For each breached threshold this function:
        1. Creates a ``MedicalAlert`` record in the database.
        2. Broadcasts the alert over the ``alerts`` WebSocket group.

    Args:
        vitals_data (dict): A flat dict of vitals values keyed by field name
            (e.g. ``{'heart_rate': 72, 'systolic_bp': 120, ...}``).
        patient_id (str|uuid.UUID): The patient's primary key.
        encounter_id (str|uuid.UUID): The encounter's primary key.

    Returns:
        list[dict]: A list of alert dicts that were generated (may be empty).
    """
    breached_alerts = []

    for threshold in THRESHOLDS:
        field = FIELD_MAP.get(threshold['name'])
        raw_value = vitals_data.get(field)

        if raw_value is None:
            continue

        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue

        # Check if value is outside the safe range
        if threshold['min'] <= value <= threshold['max']:
            continue

        # ── Threshold breached → create alert ────────────────────────────
        message = build_alert_message(threshold, value)

        try:
            alert = MedicalAlert.objects.create(
                alert_type='VITALS',
                severity=threshold['severity'],
                status='ACTIVE',
                patient_id=patient_id,
                encounter_id=encounter_id,
                message=message,
                details={
                    'threshold_name': threshold['name'],
                    'threshold_label': threshold['label'],
                    'min': threshold['min'],
                    'max': threshold['max'],
                    'actual_value': value,
                    'field': field,
                },
            )
        except Exception as exc:
            logger.error(
                'Failed to create MedicalAlert for patient %s: %s',
                patient_id, exc,
            )
            continue

        alert_payload = {
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
        breached_alerts.append(alert_payload)

        # ── Broadcast alert over WebSocket ───────────────────────────────
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'alerts',
                {
                    'type': 'alert_push',
                    'data': alert_payload,
                },
            )
        except Exception as exc:
            logger.error(
                'Failed to broadcast alert via channel_layer: %s', exc,
            )

    return breached_alerts
