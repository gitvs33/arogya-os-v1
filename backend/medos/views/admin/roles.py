"""Admin role management CRUD."""
from rest_framework.permissions import IsAuthenticated
from ...permissions import HasAdminManageRoles
from ...models import Role
from ...admin_serializers import AdminRoleSerializer
from ..base import HospitalScopedViewSet


class AdminRoleViewSet(HospitalScopedViewSet):
    """Role Management CRUD."""
    queryset = Role.objects.all().order_by('name')
    serializer_class = AdminRoleSerializer
    permission_classes = [IsAuthenticated, HasAdminManageRoles]
    search_fields = ['name', 'description']
    filterset_fields = ['is_active']

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())
