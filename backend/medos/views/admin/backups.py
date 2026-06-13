"""Admin backup record CRUD with trigger and restore actions."""
from django.utils import timezone as tz
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...permissions import HasAdminManageUsers
from ...models import BackupRecord, SystemActivityLog
from ...admin_serializers import BackupRecordSerializer
from ..base import HospitalScopedViewSet, get_hospital_from_user


class AdminBackupViewSet(HospitalScopedViewSet):
    """Backup & Restore CRUD with trigger action."""
    queryset = BackupRecord.objects.all().order_by('-started_at')
    serializer_class = BackupRecordSerializer
    permission_classes = [IsAuthenticated, HasAdminManageUsers]
    filterset_fields = ['status', 'backup_type']

    def perform_create(self, serializer):
        serializer.save(triggered_by=self.request.user, hospital=self.get_hospital())

    @action(detail=False, methods=['post'])
    def trigger(self, request):
        """Trigger a new manual backup."""
        backup_type = request.data.get('backup_type', 'MANUAL')
        notes = request.data.get('notes', '')

        record = BackupRecord.objects.create(
            backup_type=backup_type if backup_type in ('MANUAL', 'SCHEDULED') else 'MANUAL',
            status='IN_PROGRESS',
            triggered_by=request.user,
            hospital=get_hospital_from_user(request.user),
            notes=notes,
        )

        # Simulate completion for now (in production, Celery task would handle this)
        record.status = 'COMPLETED'
        record.completed_at = tz.now()
        record.file_size_mb = round(256.0 + (hash(str(record.id)) % 1000) / 10, 1)
        record.save(update_fields=['status', 'completed_at', 'file_size_mb'])

        SystemActivityLog.objects.create(
            event_type='BACKUP',
            description=f'Manual backup triggered by {request.user.username}',
            author_name=request.user.get_full_name() or request.user.username,
            timestamp=tz.now(),
        )

        serializer = BackupRecordSerializer(record)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Restore from a backup record (mock)."""
        record = self.get_object()
        if record.status != 'COMPLETED':
            return Response(
                {'error': 'Can only restore from a completed backup.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({
            'status': 'restore_initiated',
            'backup_id': str(record.id),
            'message': f'Restore initiated from backup {record.id}',
        })
