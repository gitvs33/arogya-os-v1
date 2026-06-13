"""Unit tests for ``alerts/thresholds.py`` — pure threshold evaluation.

These tests require zero mocking because ``evaluate_thresholds()`` is a
pure function with no I/O.
"""
import pytest
from decimal import Decimal

from medos.alerts.thresholds import (
    evaluate_thresholds,
    BreachedThreshold,
    THRESHOLDS,
    FIELD_MAP,
)


class TestEvaluateThresholds:
    """Tests for the pure ``evaluate_thresholds`` function."""

    def test_all_normal_values_returns_empty(self):
        """When all vitals are within safe ranges, no thresholds are breached."""
        vitals = {
            'heart_rate': 72,
            'systolic_bp': 120,
            'diastolic_bp': 80,
            'oxygen_saturation': 98,
            'temperature': 37.0,
            'respiratory_rate': 16,
        }
        result = evaluate_thresholds(vitals)
        assert result == []

    def test_high_heart_rate_detected(self):
        """Heart rate above 120 bpm triggers a CRITICAL breach."""
        vitals = {'heart_rate': 150}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        breach = result[0]
        assert breach.name == 'heart_rate'
        assert breach.actual_value == 150.0
        assert breach.severity == 'CRITICAL'

    def test_low_heart_rate_detected(self):
        """Heart rate below 50 bpm triggers a CRITICAL breach."""
        vitals = {'heart_rate': 40}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        assert result[0].name == 'heart_rate'
        assert result[0].actual_value == 40.0

    def test_high_systolic_bp_detected(self):
        """Systolic BP above 180 mmHg triggers a CRITICAL breach."""
        vitals = {'systolic_bp': 200}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        assert result[0].name == 'systolic_bp'
        assert result[0].actual_value == 200.0

    def test_low_oxygen_saturation_detected(self):
        """SpO₂ below 90% triggers a CRITICAL breach."""
        vitals = {'oxygen_saturation': 85}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        assert result[0].name == 'oxygen_saturation'
        assert result[0].severity == 'CRITICAL'

    def test_high_temperature_detected(self):
        """Temperature above 39°C triggers a CRITICAL breach."""
        vitals = {'temperature': 40.5}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        assert result[0].name == 'temperature'
        assert result[0].actual_value == 40.5

    def test_low_temperature_detected(self):
        """Temperature below 35°C triggers a CRITICAL breach."""
        vitals = {'temperature': 34.0}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        assert result[0].name == 'temperature'

    def test_diastolic_bp_warning(self):
        """Diastolic BP outside 60-120 range triggers a WARNING breach."""
        vitals = {'diastolic_bp': 130}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        assert result[0].name == 'diastolic_bp'
        assert result[0].severity == 'WARNING'

    def test_respiratory_rate_warning(self):
        """Respiratory rate outside 8-30 triggers a WARNING breach."""
        vitals = {'respiratory_rate': 35}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        assert result[0].name == 'respiratory_rate'
        assert result[0].severity == 'WARNING'

    def test_multiple_breaches_detected(self):
        """Multiple vitals can breach thresholds simultaneously."""
        vitals = {
            'heart_rate': 150,       # CRITICAL
            'systolic_bp': 200,      # CRITICAL
            'oxygen_saturation': 85, # CRITICAL
        }
        result = evaluate_thresholds(vitals)
        assert len(result) == 3
        names = {b.name for b in result}
        assert names == {'heart_rate', 'systolic_bp', 'oxygen_saturation'}

    def test_missing_field_is_skipped(self):
        """A vitals dict missing a field is silently skipped (no KeyError)."""
        vitals = {'heart_rate': 150}  # Only heart_rate provided
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        assert result[0].name == 'heart_rate'

    def test_empty_dict_returns_empty(self):
        """An empty vitals dict produces no breaches."""
        result = evaluate_thresholds({})
        assert result == []

    def test_none_value_is_skipped(self):
        """A field with None value is silently skipped."""
        vitals = {'heart_rate': None, 'systolic_bp': 120}
        result = evaluate_thresholds(vitals)
        assert result == []

    def test_string_numeric_value_handled(self):
        """String values that look like numbers are converted to float."""
        vitals = {'heart_rate': '150'}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        assert result[0].actual_value == 150.0

    def test_decimal_value_handled(self):
        """Decimal values are converted to float."""
        vitals = {'temperature': Decimal('40.0')}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        assert result[0].name == 'temperature'

    def test_non_numeric_string_is_skipped(self):
        """A non-numeric string value is silently skipped."""
        vitals = {'heart_rate': 'abc'}
        result = evaluate_thresholds(vitals)
        assert result == []

    def test_boundary_exact_min_is_safe(self):
        """Value exactly at the minimum threshold boundary is NOT a breach."""
        vitals = {'heart_rate': 50}  # min is 50
        result = evaluate_thresholds(vitals)
        assert result == []

    def test_boundary_just_below_min_is_breach(self):
        """Value just below the minimum threshold boundary IS a breach."""
        vitals = {'heart_rate': 49.9}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1

    def test_boundary_exact_max_is_safe(self):
        """Value exactly at the maximum threshold boundary is NOT a breach."""
        vitals = {'heart_rate': 120}  # max is 120
        result = evaluate_thresholds(vitals)
        assert result == []

    def test_boundary_just_above_max_is_breach(self):
        """Value just above the maximum threshold boundary IS a breach."""
        vitals = {'heart_rate': 120.1}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1

    def test_breached_threshold_dataclass_fields(self):
        """BreachedThreshold dataclass has the expected fields."""
        vitals = {'heart_rate': 150}
        result = evaluate_thresholds(vitals)
        assert len(result) == 1
        breach = result[0]
        assert breach.name == 'heart_rate'
        assert breach.label == 'Heart Rate (bpm)'
        assert breach.actual_value == 150.0
        assert breach.min == 50
        assert breach.max == 120
        assert breach.severity == 'CRITICAL'
