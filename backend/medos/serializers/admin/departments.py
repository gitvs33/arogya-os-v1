"""Admin department management serializers."""
from rest_framework import serializers
from ...models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    head_name = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'code', 'description',
            'is_active', 'head_of_department', 'head_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_head_name(self, obj):
        if obj.head_of_department:
            return (obj.head_of_department.get_full_name()
                    or obj.head_of_department.username)
        return ''
