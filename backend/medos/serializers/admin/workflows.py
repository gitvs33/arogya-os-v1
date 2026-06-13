"""Admin workflow definition serializers."""
from rest_framework import serializers
from ...models import WorkflowDefinition


class WorkflowDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowDefinition
        fields = [
            'id', 'name', 'module', 'description',
            'initial_state', 'states', 'transitions',
            'is_active', 'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
