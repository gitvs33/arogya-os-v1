"""Public department listing — any authenticated user can read departments.

This is separate from the admin CRUD viewset (which requires HasAdminWrite)
so that receptionists and clinical staff can select departments during
patient registration without needing admin privileges.
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend

from ..models import Department
from ..serializers import DepartmentSerializer
from .base import HospitalScopedViewSet


class DepartmentViewSet(HospitalScopedViewSet):
    """Read-only department listing for patient registration / encounters.

    Any authenticated user can list and retrieve departments.
    Create/update/delete is handled by AdminDepartmentViewSet.
    """
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'code']
    pagination_class = None  # Departments are a small list — no pagination
