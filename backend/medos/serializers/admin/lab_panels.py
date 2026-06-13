"""Admin lab panel serializers."""
from rest_framework import serializers
from ...models import TestPanel, TestParameter


class AdminTestParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestParameter
        fields = [
            'id', 'panel', 'group', 'name', 'unit',
            'ref_range_low', 'ref_range_high',
            'critical_low', 'critical_high',
            'display_order', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AdminTestPanelSerializer(serializers.ModelSerializer):
    parameter_count = serializers.SerializerMethodField()

    class Meta:
        model = TestPanel
        fields = [
            'id', 'name', 'short_name', 'category', 'description',
            'standard_tat_hours', 'sample_types', 'method',
            'lab_location', 'is_panel', 'price', 'is_active',
            'parameter_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at',
                            'parameter_count']

    def get_parameter_count(self, obj):
        return obj.parameters.filter(is_active=True).count()


class AdminTestPanelDetailSerializer(AdminTestPanelSerializer):
    parameters = AdminTestParameterSerializer(many=True, read_only=True)

    class Meta(AdminTestPanelSerializer.Meta):
        fields = AdminTestPanelSerializer.Meta.fields + ['parameters']
