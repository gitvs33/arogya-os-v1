"""Admin system settings serializers."""
from rest_framework import serializers
from ...models import SystemSetting


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = [
            'id', 'key', 'label', 'value', 'value_type',
            'category', 'is_encrypted', 'description',
            'updated_at', 'updated_by',
        ]
        read_only_fields = ['id', 'updated_at', 'updated_by']
