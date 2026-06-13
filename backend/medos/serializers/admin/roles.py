"""Admin role management serializers."""
from rest_framework import serializers
from ...models import Role, HospitalUserProfile


class AdminRoleSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            'id', 'name', 'description', 'permissions',
            'is_active', 'user_count', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_user_count(self, obj):
        return HospitalUserProfile.objects.filter(role=obj).count()
