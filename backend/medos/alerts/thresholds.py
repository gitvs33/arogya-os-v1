"""
Pure threshold evaluation for TeleICU vitals monitoring.

This module contains zero I/O — it only evaluates vitals data against
clinical thresholds and returns the results as dataclass instances.
"""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class BreachedThreshold:
    """A single threshold that was breached by a vitals reading."""

    name: str
    label: str
    actual_value: float
    min: float
    max: float
    severity: str  # 'WARNING' | 'CRITICAL'


# ── Clinical Thresholds ──────────────────────────────────────────────────────
# Each entry has a human-readable label, the field name used in the Vitals
# model / serialised payload, (min, max) range, and a severity level.

THRESHOLDS: list[dict[str, Any]] = [
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
FIELD_MAP: dict[str, str] = {
    'heart_rate': 'heart_rate',
    'systolic_bp': 'systolic_bp',
    'diastolic_bp': 'diastolic_bp',
    'oxygen_saturation': 'oxygen_saturation',
    'temperature': 'temperature',
    'respiratory_rate': 'respiratory_rate',
}


def build_alert_message(name: str, label: str, actual_value: float, min_val: float, max_val: float) -> str:
    """Return a human-readable alert message for a breached threshold."""
    direction = 'high' if actual_value > max_val else 'low'
    return (
        f"{label} is too {direction}: "
        f"{actual_value} (range: {min_val}–{max_val})"
    )


def evaluate_thresholds(vitals_data: dict[str, Any]) -> list[BreachedThreshold]:
    """Evaluate *vitals_data* against every registered threshold.

    This is a **pure function** — it performs zero I/O and has zero side effects.
    It simply compares the values in *vitals_data* against the clinical thresholds
    and returns a list of ``BreachedThreshold`` dataclass instances for each
    value that falls outside the safe range.

    Args:
        vitals_data: A flat dict of vitals values keyed by field name
            (e.g. ``{'heart_rate': 72, 'systolic_bp': 120, ...}``).

    Returns:
        A list of ``BreachedThreshold`` instances (may be empty).
    """
    breached: list[BreachedThreshold] = []

    for threshold in THRESHOLDS:
        field = FIELD_MAP.get(threshold['name'])
        raw_value = vitals_data.get(field)

        if raw_value is None:
            continue

        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue

        min_val = threshold['min']
        max_val = threshold['max']

        # Check if value is outside the safe range
        if min_val <= value <= max_val:
            continue

        breached.append(BreachedThreshold(
            name=threshold['name'],
            label=threshold['label'],
            actual_value=value,
            min=min_val,
            max=max_val,
            severity=threshold['severity'],
        ))

    return breached
