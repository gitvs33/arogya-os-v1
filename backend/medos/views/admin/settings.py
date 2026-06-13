"""Admin system settings CRUD."""
from rest_framework.permissions import IsAuthenticated
from ...permissions import HasAdminWrite
from ...models import SystemSetting
from ...admin_serializers import SystemSettingSerializer
from ..base import HospitalScopedViewSet


class AdminSystemSettingViewSet(HospitalScopedViewSet):
    """System Settings CRUD."""
    queryset = SystemSetting.objects.all().order_by('category', 'key')
    serializer_class = SystemSettingSerializer
    permission_classes = [IsAuthenticated, HasAdminWrite]
    search_fields = ['key', 'label', 'value']
    filterset_fields = ['category', 'value_type']

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user, hospital=self.get_hospital())

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
