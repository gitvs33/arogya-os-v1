"""Admin device integration serializers."""
from rest_framework import serializers
from ...models import DeviceIntegration


class DeviceIntegrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceIntegration
        fields = [
            'id', 'name', 'device_type', 'ip_address', 'port',
            'api_endpoint', 'auth_type', 'credentials',
            'is_active', 'last_heartbeat', 'metadata',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
