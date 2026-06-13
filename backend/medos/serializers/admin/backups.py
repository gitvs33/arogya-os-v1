"""Admin backup record serializers."""
from rest_framework import serializers
from ...models import BackupRecord


class BackupRecordSerializer(serializers.ModelSerializer):
    triggered_by_name = serializers.SerializerMethodField()
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = BackupRecord
        fields = [
            'id', 'backup_type', 'status', 'file_url',
            'file_size_mb', 'started_at', 'completed_at',
            'triggered_by', 'triggered_by_name',
            'duration_seconds', 'notes',
        ]
        read_only_fields = [
            'id', 'started_at', 'completed_at',
            'duration_seconds',
        ]

    def get_triggered_by_name(self, obj):
        if obj.triggered_by:
            return (obj.triggered_by.get_full_name()
                    or obj.triggered_by.username)
        return ''

    def get_duration_seconds(self, obj):
        if obj.completed_at and obj.started_at:
            return int((obj.completed_at - obj.started_at).total_seconds())
        return None
