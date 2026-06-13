"""Lab test panel catalog."""
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend

from ...models import TestPanel
from ...serializers import TestPanelSerializer, TestPanelDetailSerializer
from ...subscriptions import HasFeatureAccess
from ..base import HospitalScopedViewSet


class TestPanelViewSet(HospitalScopedViewSet):
    """Catalog of all available lab tests and panels."""
    queryset = TestPanel.objects.prefetch_related('parameters').all()
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'laboratory'
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['category', 'is_panel', 'is_active']
    search_fields = ['name', 'short_name']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TestPanelDetailSerializer
        return TestPanelSerializer

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())
