"""Admin user management serializers."""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from ...models import Role, HospitalUserProfile

User = get_user_model()


class AdminUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    role_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    employee_id = serializers.CharField(required=False, allow_blank=True, write_only=True)
    department = serializers.CharField(required=False, allow_blank=True, write_only=True)
    designation = serializers.CharField(required=False, allow_blank=True, write_only=True)
    is_active_user = serializers.BooleanField(source='is_active', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'is_active_user', 'is_staff',
            'date_joined', 'last_login',
            'role', 'role_id', 'employee_id', 'department', 'designation',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']

    def get_role(self, obj):
        profile = getattr(obj, 'hospital_profile', None)
        return profile.role.name if profile and profile.role else ''

    def update(self, instance, validated_data):
        # Pop profile fields from validated_data
        role_id = validated_data.pop('role_id', None)
        employee_id = validated_data.pop('employee_id', None)
        department = validated_data.pop('department', None)
        designation = validated_data.pop('designation', None)

        # Update User fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update HospitalUserProfile fields
        profile = getattr(instance, 'hospital_profile', None)
        if profile:
            if role_id is not None:
                try:
                    profile.role = Role.objects.get(id=role_id)
                except Role.DoesNotExist:
                    pass
            if employee_id is not None:
                profile.employee_id = employee_id
            if department is not None:
                profile.department = department
            if designation is not None:
                profile.designation = designation
            profile.save()

        return instance


class AdminUserCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField(required=False)
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, default='')
    last_name = serializers.CharField(required=False, default='')
    employee_id = serializers.CharField(required=False, allow_blank=True)
    role_id = serializers.UUIDField(required=False, allow_null=True)
    department = serializers.CharField(required=False, default='')
    designation = serializers.CharField(required=False, default='')
    phone = serializers.CharField(required=False, default='')
    is_active = serializers.BooleanField(default=True)
