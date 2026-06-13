"""Lab parameter results CRUD."""
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from ...models import LabParameterResult
from ...serializers import LabParameterResultSerializer
from ...subscriptions import HasFeatureAccess
from ..base import HospitalScopedViewSet


class LabParameterResultViewSet(HospitalScopedViewSet):
    """Per-parameter lab results. Mainly used for updates."""
    queryset = LabParameterResult.objects.select_related(
        'order', 'parameter', 'entered_by'
    )
    serializer_class = LabParameterResultSerializer
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'laboratory'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['order', 'parameter', 'status']

    def perform_create(self, serializer):
        serializer.save(entered_by=self.request.user, hospital=self.get_hospital())

    def perform_update(self, serializer):
        serializer.save(entered_by=self.request.user)
