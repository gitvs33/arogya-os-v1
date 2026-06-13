"""Admin master data entry serializers."""
from rest_framework import serializers
from ...models import MasterDataEntry


class MasterDataEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterDataEntry
        fields = [
            'id', 'category', 'key', 'value',
            'is_active', 'display_order', 'metadata',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
