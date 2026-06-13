"""Admin department management CRUD."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ...permissions import HasAdminWrite
from ...models import Department, HospitalUserProfile
from ...admin_serializers import DepartmentSerializer
from ..base import HospitalScopedViewSet


class AdminDepartmentViewSet(HospitalScopedViewSet):
    """Department Setup CRUD."""
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, HasAdminWrite]
    search_fields = ['name', 'code']
    filterset_fields = ['is_active']

    @action(detail=True, methods=['get'])
    def staff_count(self, request, pk=None):
        department = self.get_object()
        count = HospitalUserProfile.objects.filter(
            department__iexact=department.name
        ).count()
        return Response({'department': department.name, 'staff_count': count})
