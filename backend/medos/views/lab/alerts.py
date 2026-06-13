"""Lab critical alerts — view and acknowledge."""
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from ...models import LabAlert, QCEntry
from ...serializers import LabAlertSerializer
from ...subscriptions import HasFeatureAccess
from ..base import HospitalScopedReadOnlyViewSet


class LabAlertViewSet(HospitalScopedReadOnlyViewSet):
    """View and acknowledge critical lab alerts."""
    queryset = LabAlert.objects.select_related(
        'patient', 'order__test_panel', 'parameter_result__parameter'
    ).all()
    serializer_class = LabAlertSerializer
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'laboratory'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_acknowledged', 'severity', 'patient']
    ordering = ['-created_at']

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge a critical alert."""
        alert = self.get_object()
        alert.is_acknowledged = True
        alert.acknowledged_at = timezone.now()
        alert.acknowledged_by = request.user
        alert.save(update_fields=['is_acknowledged', 'acknowledged_at', 'acknowledged_by'])

        QCEntry.objects.create(
            order=alert.order,
            action='Critical Alert Acknowledged',
            performed_by=request.user,
            notes=alert.alert_message[:200],
        )

        return Response(LabAlertSerializer(alert, context={'request': request}).data)
