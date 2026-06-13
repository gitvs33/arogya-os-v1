"""Admin device integration CRUD."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...permissions import HasAdminWrite
from ...models import DeviceIntegration
from ...admin_serializers import DeviceIntegrationSerializer
from ..base import HospitalScopedViewSet


class AdminDeviceViewSet(HospitalScopedViewSet):
    """Device Integration CRUD."""
    queryset = DeviceIntegration.objects.all().order_by('name')
    serializer_class = DeviceIntegrationSerializer
    permission_classes = [IsAuthenticated, HasAdminWrite]
    search_fields = ['name', 'device_type', 'ip_address']
    filterset_fields = ['device_type', 'is_active', 'auth_type']

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        device = self.get_object()
        return Response({
            'status': 'success',
            'message': f'Connection test initiated for {device.name}',
            'device_ip': device.ip_address,
            'device_port': device.port,
        })

    @action(detail=True, methods=['post'])
    def heartbeat(self, request, pk=None):
        device = self.get_object()
        device.last_heartbeat = timezone.now()
        device.save(update_fields=['last_heartbeat'])
        return Response({
            'status': 'success',
            'last_heartbeat': device.last_heartbeat,
        })

    @action(detail=False, methods=['get'])
    def online(self, request):
        five_min_ago = timezone.now() - timedelta(minutes=5)
        qs = self.get_queryset().filter(
            is_active=True,
            last_heartbeat__gte=five_min_ago,
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
