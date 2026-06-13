"""Admin security policy + audit log views."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...permissions import HasAdminRead, HasAdminWrite
from ...models import SecurityPolicy, SystemActivityLog
from ...admin_serializers import (
    SecurityPolicySerializer, AuditLogSerializer,
)
from ..base import HospitalScopedViewSet, HospitalScopedReadOnlyViewSet


class AdminSecurityViewSet(HospitalScopedViewSet):
    """Security & Access Policy CRUD."""
    queryset = SecurityPolicy.objects.all().order_by('policy_type')
    serializer_class = SecurityPolicySerializer
    permission_classes = [IsAuthenticated, HasAdminWrite]
    filterset_fields = ['policy_type', 'is_enforced']

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user, hospital=self.get_hospital())

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=False, methods=['get'])
    def overview(self, request):
        policies = {p.policy_type: p.settings for p in self.get_queryset()}
        data = {
            'password_policy': str(policies.get('password_policy', {}).get('strength', 'Strong')),
            'two_factor_enforcement': str(policies.get('two_factor', {}).get('enforcement', 'Disabled')),
            'session_timeout': f"{policies.get('session', {}).get('timeout_minutes', 30)} min",
            'ip_whitelist_enabled': policies.get('ip_whitelist', {}).get('enabled', False),
            'login_attempts_limit': policies.get('login_attempts', {}).get('max_attempts', 5),
        }
        return Response(data)


class AdminAuditLogViewSet(HospitalScopedReadOnlyViewSet):
    """Audit Logs (Read-only, paginated, filterable)."""
    queryset = SystemActivityLog.objects.select_related(
        'patient', 'encounter'
    ).order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, HasAdminRead]
    filterset_fields = ['event_type', 'patient']
    search_fields = ['description', 'author_name']
    ordering_fields = ['-timestamp']
