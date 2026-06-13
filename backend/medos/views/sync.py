"""Sync views — offline-first CRDT replication."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction

from ..models import SyncEntry, HospitalUserProfile
from ..serializers import SyncEntrySerializer, SyncPushSerializer


class SyncViewSet(viewsets.ViewSet):
    """Sync operations for offline-first CRDT replication."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Pull sync entries since a given timestamp."""
        since = request.query_params.get('since')
        model_name = request.query_params.get('model_name')
        queryset = SyncEntry.objects.all()
        if since:
            queryset = queryset.filter(updated_at__gte=since)
        if model_name:
            queryset = queryset.filter(model_name=model_name)
        queryset = queryset.order_by('-updated_at')[:100]
        serializer = SyncEntrySerializer(queryset, many=True)
        return Response(serializer.data)

    def _compute_current_role_hash(self, user):
        """Compute the current role snapshot hash for a user."""
        profile = getattr(user, 'hospital_profile', None)
        if not profile:
            return None
        return profile.get_role_snapshot_hash()

    @action(detail=False, methods=['post'])
    def push(self, request):
        """Push offline sync entries with role hash verification."""
        serializer = SyncPushSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        current_hash = self._compute_current_role_hash(request.user)

        entries = []
        with transaction.atomic():
            for entry_data in serializer.validated_data['entries']:
                stored_hash = entry_data.get('role_snapshot_hash', '')

                # Verify the role snapshot hash matches the user's current role
                if stored_hash and current_hash and stored_hash != current_hash:
                    return Response(
                        {
                            'error': 'Role changed since offline session. Please refresh and re-submit.',
                            'stale_entry': entry_data.get('record_id'),
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                entry, created = SyncEntry.objects.update_or_create(
                    record_id=entry_data.get('record_id'),
                    defaults={
                        'model_name': entry_data['model_name'],
                        'jsonb_snapshot': entry_data['jsonb_snapshot'],
                        'version': entry_data.get('version', 1),
                        'source': 'offline',
                        'role_snapshot_hash': stored_hash,
                        'created_by': request.user,
                    }
                )
                entries.append(entry)

        return Response(
            SyncEntrySerializer(entries, many=True).data,
            status=status.HTTP_201_CREATED
        )
