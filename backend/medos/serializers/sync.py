"""Offline sync entry serializers."""
from rest_framework import serializers
from ..models import SyncEntry


class SyncEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncEntry
        fields = [
            'record_id', 'model_name', 'jsonb_snapshot', 'version',
            'source', 'role_snapshot_hash', 'created_by',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SyncPushSerializer(serializers.Serializer):
    """Serializer for pushing offline sync entries."""
    entries = SyncEntrySerializer(many=True)
