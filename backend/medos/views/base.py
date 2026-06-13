"""Base ViewSets and mixins for tenant-scoped data isolation.

Every ViewSet that handles hospital-specific data should inherit from
HospitalScopedViewSet instead of viewsets.ModelViewSet. This automatically
filters all queries to the logged-in user's hospital and attaches the
hospital FK on create.
"""
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, NotFound


def get_hospital_from_user(user):
    """Extract the hospital from a user's profile.

    Returns the Hospital instance or raises PermissionDenied.
    """
    profile = getattr(user, 'hospital_profile', None)
    if not profile or not profile.hospital:
        raise PermissionDenied(
            'No hospital associated with this account.'
        )
    return profile.hospital


class HospitalScopedViewSet(viewsets.ModelViewSet):
    """Base class for all hospital-scoped ModelViewSets.

    - ``get_queryset()`` auto-filters by the current user's hospital.
    - ``perform_create()`` auto-attaches the current user's hospital.
    - ``get_object()`` returns 404 (not 403) when the object belongs
      to another hospital, preventing resource enumeration.

    Subclasses may override ``get_queryset()`` but should call
    ``super().get_queryset()`` and chain additional filters.
    """

    def get_hospital(self):
        """Return the Hospital instance for the current user."""
        return get_hospital_from_user(self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        hospital = self.get_hospital()
        return qs.filter(hospital=hospital)

    def perform_create(self, serializer):
        hospital = self.get_hospital()
        serializer.save(hospital=hospital)

    def get_object(self):
        """Return 404 if object doesn't belong to user's hospital.

        Override the default DRF behaviour so that users cannot
        determine whether a resource exists in another hospital
        (which would be a side-channel information leak).
        """
        obj = super().get_object()
        hospital = self.get_hospital()
        if getattr(obj, 'hospital_id', None) != hospital.id:
            raise NotFound(
                'No %s matches the given query.' %
                obj._meta.verbose_name
            )
        return obj


class HospitalScopedReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only version of HospitalScopedViewSet."""

    def get_hospital(self):
        return get_hospital_from_user(self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(hospital=self.get_hospital())

    def get_object(self):
        obj = super().get_object()
        hospital = self.get_hospital()
        if getattr(obj, 'hospital_id', None) != hospital.id:
            raise NotFound(
                'No %s matches the given query.' %
                obj._meta.verbose_name
            )
        return obj
