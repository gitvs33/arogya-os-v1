"""Dashboard overview serializers — KPI cards, charts, module status, alerts, storage, license, system info."""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from ...models import AdminModule, LicenseInfo, StorageMetrics, SystemAlert

User = get_user_model()


class KPIEntrySerializer(serializers.Serializer):
    count = serializers.IntegerField(default=0)
    growth = serializers.CharField(required=False, default='')
    percentage = serializers.FloatField(required=False, default=0.0)


class KPISubObjectField(serializers.Field):
    def to_representation(self, value):
        return value


class AdminKPISerializer(serializers.Serializer):
    total_users = KPISubObjectField()
    active_users = KPISubObjectField()
    departments = KPISubObjectField()
    roles = KPISubObjectField()
    system_uptime = KPISubObjectField()
    storage_used = KPISubObjectField()


class SystemOverviewPointSerializer(serializers.Serializer):
    date = serializers.CharField()
    logins = serializers.IntegerField()
    transactions = serializers.IntegerField()
    errors = serializers.IntegerField()


class AdminModuleSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='label', read_only=True)

    class Meta:
        model = AdminModule
        fields = ['id', 'name', 'label', 'status', 'is_critical', 'updated_at']


class SystemAlertSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = SystemAlert
        fields = [
            'id', 'severity', 'title', 'description', 'timestamp',
            'is_resolved', 'created_at', 'resolved_at',
        ]


class UserActivitySerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    name = serializers.CharField()
    avatar_url = serializers.URLField(allow_blank=True)
    role = serializers.CharField()
    logins_count = serializers.IntegerField()
    last_login_timestamp = serializers.DateTimeField()


class AuditCategorySerializer(serializers.Serializer):
    name = serializers.CharField()
    count = serializers.IntegerField()
    percentage = serializers.FloatField()


class AuditSummarySerializer(serializers.Serializer):
    total_logs = serializers.IntegerField()
    categories = serializers.ListField(child=AuditCategorySerializer())


class SecurityOverviewSerializer(serializers.Serializer):
    password_policy = serializers.CharField()
    two_factor_enforcement = serializers.CharField()
    session_timeout = serializers.CharField()


class RecentActivitySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    action_type = serializers.CharField()
    description = serializers.CharField()
    timestamp = serializers.DateTimeField()
    author_name = serializers.CharField()


class DatabaseStorageSerializer(serializers.Serializer):
    storage_used_tb = serializers.FloatField()
    storage_total_tb = serializers.FloatField()
    database_status = serializers.CharField()
    last_backup = serializers.DateTimeField(allow_null=True)
    next_backup = serializers.DateTimeField(allow_null=True)


class LicenseInfoSerializer(serializers.ModelSerializer):
    active_users = serializers.SerializerMethodField()

    class Meta:
        model = LicenseInfo
        fields = [
            'id', 'edition', 'valid_from', 'valid_till',
            'registered_modules', 'total_modules',
            'active_users', 'user_limit', 'is_active',
        ]

    def get_active_users(self, obj):
        return User.objects.filter(is_active=True).count()


class SystemInfoSerializer(serializers.Serializer):
    version = serializers.CharField()
    environment = serializers.CharField()
    server_name = serializers.CharField()
    server_time = serializers.DateTimeField()
    timezone = serializers.CharField()
    python_version = serializers.CharField()
    django_version = serializers.CharField()
    database = serializers.CharField()
