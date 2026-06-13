"""Admin security policy and audit log serializers."""
from rest_framework import serializers
from ...models import SecurityPolicy, SystemActivityLog


class SecurityPolicySerializer(serializers.ModelSerializer):
    policy_type_display = serializers.CharField(
        source='get_policy_type_display', read_only=True)

    class Meta:
        model = SecurityPolicy
        fields = [
            'id', 'policy_type', 'policy_type_display',
            'settings', 'is_enforced', 'description',
            'updated_at', 'updated_by',
        ]
        read_only_fields = ['id', 'updated_at']


class AuditLogSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.full_name', read_only=True, default='')
    event_type_display = serializers.SerializerMethodField()

    class Meta:
        model = SystemActivityLog
        fields = [
            'id', 'patient', 'patient_name', 'encounter',
            'event_type', 'event_type_display',
            'description', 'author_name', 'metadata',
            'timestamp',
        ]
        read_only_fields = fields

    def get_event_type_display(self, obj):
        return obj.event_type.replace('_', ' ').title()
