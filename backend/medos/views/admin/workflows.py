"""Admin workflow / state machine definition CRUD."""
from rest_framework.permissions import IsAuthenticated
from ...permissions import HasAdminWrite
from ...models import WorkflowDefinition
from ...admin_serializers import WorkflowDefinitionSerializer
from ..base import HospitalScopedViewSet


class AdminWorkflowViewSet(HospitalScopedViewSet):
    """Workflow / State Machine Setup CRUD."""
    queryset = WorkflowDefinition.objects.all().order_by('module', 'name')
    serializer_class = WorkflowDefinitionSerializer
    permission_classes = [IsAuthenticated, HasAdminWrite]
    search_fields = ['name', 'module', 'description']
    filterset_fields = ['module', 'is_active']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, hospital=self.get_hospital())
