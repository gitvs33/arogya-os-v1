"""Subscription plan feature gating.

Each Hospital has a ``plan`` (basic / professional / enterprise).
This module defines which features are available at each tier.
"""
from functools import wraps

from rest_framework.permissions import BasePermission

# ── Feature Definitions ────────────────────────────────────────────────────

PLAN_FEATURES = {
    'basic': [
        'patients',
        'encounters',
        'billing',
        'pharmacy',
    ],
    'professional': [
        'patients',
        'encounters',
        'billing',
        'pharmacy',
        'laboratory',
        'reports',
        'teleicu',
    ],
    'enterprise': [
        'patients',
        'encounters',
        'billing',
        'pharmacy',
        'laboratory',
        'reports',
        'teleicu',
        'scribe',
        'teleconsult',
        'ai_insights',
        'integrations',
    ],
}


def hospital_has_feature(hospital, feature: str) -> bool:
    """Check if a hospital's plan includes a feature."""
    if hospital is None:
        return False
    allowed = PLAN_FEATURES.get(hospital.plan, [])
    return feature in allowed


class HasFeatureAccess(BasePermission):
    """DRF permission class that gates access by subscription plan.

    Usage in ViewSets::

        class MyViewSet(HospitalScopedViewSet):
            permission_classes = [IsAuthenticated, HasFeatureAccess]
            required_feature = 'laboratory'
    """
    required_feature = None

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        required = getattr(view, 'required_feature', self.required_feature)
        if required is None:
            return True
        profile = getattr(user, 'hospital_profile', None)
        if not profile or not profile.hospital:
            return False
        if not profile.hospital.is_active:
            return False
        if not hospital_has_feature(profile.hospital, required):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                f'Your current plan ({profile.hospital.plan}) does not include '
                f'"{required}". Please upgrade to access this feature.'
            )
        return True


def require_feature(feature_name):
    """Decorator for function-based views that gates access by subscription plan.

    Usage::

        @api_view(['GET'])
        @permission_classes([IsAuthenticated])
        @require_feature('laboratory')
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            from rest_framework.exceptions import PermissionDenied
            user = request.user
            if not user.is_authenticated:
                raise PermissionDenied('Authentication required.')
            profile = getattr(user, 'hospital_profile', None)
            if not profile or not profile.hospital:
                raise PermissionDenied('No hospital associated with this account.')
            if not profile.hospital.is_active:
                raise PermissionDenied('Hospital account is inactive.')
            if not hospital_has_feature(profile.hospital, feature_name):
                raise PermissionDenied(
                    f'Your current plan ({profile.hospital.plan}) does not include '
                    f'"{feature_name}". Please upgrade to access this feature.'
                )
            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator
