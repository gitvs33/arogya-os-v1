"""
Threshold-based alert engine for TeleICU vitals monitoring.

Wires together the pure threshold evaluator (``thresholds``) with the
side-effect broadcaster (``broadcaster``).
"""
import logging
from typing import Any

from .thresholds import (
    THRESHOLDS,
    FIELD_MAP,
    BreachedThreshold,
    build_alert_message as _build_alert_message,
    evaluate_thresholds,
)
from .broadcaster import (
    AlertBroadcaster,
    DatabaseAndWebSocketBroadcaster,
    AlertPayload,
)

logger = logging.getLogger(__name__)

# Re-export for convenience
ThresholdDict = dict[str, str | float]

# Default broadcaster used by ``check_vitals_thresholds``.
# Swap this for ``LoggingBroadcaster`` in tests.
_default_broadcaster: AlertBroadcaster = DatabaseAndWebSocketBroadcaster()


def get_default_broadcaster() -> AlertBroadcaster:
    """Return the current default alert broadcaster."""
    return _default_broadcaster


def set_default_broadcaster(broadcaster: AlertBroadcaster) -> None:
    """Override the default alert broadcaster (useful in tests)."""
    global _default_broadcaster
    _default_broadcaster = broadcaster


def build_alert_message(threshold: ThresholdDict, actual_value: float) -> str:
    """Return a human-readable alert message for a breached threshold.

    .. deprecated::
        Use ``alerts.thresholds.build_alert_message(name, label, value, min, max)``
        instead. Kept for backward compatibility.
    """
    return _build_alert_message(
        name=threshold['name'],
        label=threshold['label'],
        actual_value=actual_value,
        min_val=threshold['min'],
        max_val=threshold['max'],
    )


def check_vitals_thresholds(
    vitals_data: dict[str, Any],
    patient_id: str,
    encounter_id: str,
) -> list[AlertPayload]:
    """Evaluate *vitals_data* against every registered threshold.

    This is the **public API** — kept for backward compatibility.
    Under the hood it:

        1. Calls ``evaluate_thresholds(vitals_data)`` (pure function).
        2. Delegates side effects to the default ``AlertBroadcaster``.

    Args:
        vitals_data: A flat dict of vitals values keyed by field name
            (e.g. ``{'heart_rate': 72, 'systolic_bp': 120, ...}``).
        patient_id: The patient's primary key.
        encounter_id: The encounter's primary key.

    Returns:
        A list of alert dicts that were generated (may be empty).
    """
    breaches = evaluate_thresholds(vitals_data)
    if not breaches:
        return []

    broadcaster = get_default_broadcaster()
    return broadcaster.broadcast(breaches, patient_id, encounter_id)
