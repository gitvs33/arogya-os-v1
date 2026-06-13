"""Admin lab panel management — CRUD for TestPanel + TestParameter."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction

from ...permissions import HasAdminWrite
from ...models import TestPanel, TestParameter
from ...serializers.admin.lab_panels import (
    AdminTestPanelSerializer,
    AdminTestPanelDetailSerializer,
    AdminTestParameterSerializer,
)
from ..base import HospitalScopedViewSet


class AdminTestPanelViewSet(HospitalScopedViewSet):
    """Admin CRUD for lab test panels and their parameters.

    Extends the clinical TestPanelViewSet with admin-specific features:
    - Manage parameters inline
    - Activate/deactivate panels
    - View usage statistics
    """
    queryset = TestPanel.objects.prefetch_related('parameters').all()
    serializer_class = AdminTestPanelSerializer
    permission_classes = [IsAuthenticated, HasAdminWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['category', 'is_panel', 'is_active']
    search_fields = ['name', 'short_name']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AdminTestPanelDetailSerializer
        return AdminTestPanelSerializer

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())

    # ── Statistics ──────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Aggregate lab panel statistics for admin dashboard."""
        hospital = self.get_hospital()
        panels = TestPanel.objects.filter(hospital=hospital)
        total_parameters = TestParameter.objects.filter(
            panel__hospital=hospital
        ).count()
        active_panels = panels.filter(is_active=True).count()
        categories = list(panels.values_list(
            'category', flat=True
        ).distinct().order_by('category'))

        return Response({
            'total_panels': panels.count(),
            'active_panels': active_panels,
            'total_parameters': total_parameters,
            'categories': categories,
        })

    # ── Parameter management ───────────────────────────────────────

    @action(detail=True, methods=['get'])
    def parameters(self, request, pk=None):
        """List all parameters for a test panel."""
        panel = self.get_object()
        params = panel.parameters.filter(is_active=True).order_by('display_order')
        serializer = AdminTestParameterSerializer(params, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_parameter(self, request, pk=None):
        """Add a parameter to a test panel."""
        panel = self.get_object()
        serializer = AdminTestParameterSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(panel=panel, hospital=self.get_hospital())
        return Response(serializer.data, status=201)

    @action(detail=False, methods=['delete'], url_path=r'parameter/(?P<param_pk>[^/.]+)')
    def delete_parameter(self, request, param_pk=None):
        """Delete a test parameter."""
        hospital = self.get_hospital()
        param = TestParameter.objects.get(id=param_pk, panel__hospital=hospital)
        param.delete()
        return Response(status=204)
