"""Standardised error handling utilities for the MedOS API.

Provides helpers for consistent error responses.

Usage — in settings.py, add:
    REST_FRAMEWORK['EXCEPTION_HANDLER'] = 'medos.exceptions.custom_exception_handler'

NOTE: This module is NOT currently wired into settings, because changing
the global error response format is a behaviour change. Existing views
return error dicts of varying shapes. Activating this handler would
normalise them — a valuable future task, but intentionally deferred.
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """DRF exception handler that wraps all errors in a consistent shape.

    Preserves DRF's built-in handling (validation errors, auth failures,
    throttling, etc.) and adds a unified envelope.
    """
    response = exception_handler(exc, context)

    if response is not None:
        data = response.data

        # Wrap into consistent format
        wrapped = {
            'error': _extract_message(data),
            'code': response.status_text.lower().replace(' ', '_'),
        }

        # Preserve detailed validation errors under 'detail'
        if isinstance(data, dict) and any(
            isinstance(v, list) for v in data.values()
        ):
            wrapped['detail'] = data

        response.data = wrapped

    return response


def _extract_message(data):
    """Extract a human-readable message from DRF error data."""
    if isinstance(data, str):
        return data
    if isinstance(data, list):
        return str(data[0]) if data else 'Unknown error'
    if isinstance(data, dict):
        for key in ('detail', 'message', 'error', 'non_field_errors'):
            if key in data:
                val = data[key]
                if isinstance(val, list) and val:
                    return str(val[0])
                if isinstance(val, str):
                    return val
        # Fallback: return first value
        for val in data.values():
            if isinstance(val, list) and val:
                return str(val[0])
            if isinstance(val, str):
                return val
        return 'Validation error'
    return 'Unknown error'
