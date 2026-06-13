"""Reports & Analytics serializers — report definitions, generated reports, schedules, chart/table data."""
from rest_framework import serializers
from ..models import ReportDefinition, GeneratedReport, ScheduledReport, SavedDashboardView, AIInsight


class ReportDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportDefinition
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class GeneratedReportSerializer(serializers.ModelSerializer):
    report_name = serializers.CharField(source='report_definition.name', read_only=True)
    generated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedReport
        fields = [
            'id', 'report_definition', 'report_name',
            'generated_on', 'generated_by', 'generated_by_name',
            'parameters_used', 'format_type', 'status', 'file_url',
        ]
        read_only_fields = ['id', 'generated_on', 'status']

    def get_generated_by_name(self, obj):
        if obj.generated_by:
            return obj.generated_by.get_full_name() or obj.generated_by.username
        return ''


class ScheduledReportSerializer(serializers.ModelSerializer):
    report_name = serializers.CharField(source='report_definition.name', read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledReport
        fields = [
            'id', 'report_definition', 'report_name',
            'user', 'user_name',
            'frequency', 'schedule_time', 'recipients',
            'is_active', 'last_run_at', 'next_run_at', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'last_run_at', 'next_run_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class SavedDashboardViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedDashboardView
        fields = [
            'id', 'user', 'view_name', 'filters',
            'is_pinned', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AIInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIInsight
        fields = '__all__'
        read_only_fields = ['id', 'generated_at']


# ── Read-only serializers for chart / table data ──────────────────────────────


class KPIEntrySerializer(serializers.Serializer):
    """Single KPI metric card."""
    label = serializers.CharField()
    value = serializers.FloatField()
    growth_pct = serializers.FloatField()
    prefix = serializers.CharField(required=False, default='')
    suffix = serializers.CharField(required=False, default='')
    icon = serializers.CharField(required=False, default='')


class RevenueByDepartmentSerializer(serializers.Serializer):
    department = serializers.CharField()
    revenue = serializers.FloatField()
    percentage = serializers.FloatField()


class RevenueBySpecialtySerializer(serializers.Serializer):
    specialty = serializers.CharField()
    revenue = serializers.FloatField()


class RevenueTrendPointSerializer(serializers.Serializer):
    date = serializers.CharField()
    revenue = serializers.FloatField()
    collections = serializers.FloatField()
    outstanding = serializers.FloatField()


class DepartmentPerformanceSerializer(serializers.Serializer):
    department = serializers.CharField()
    revenue = serializers.FloatField()
    collection = serializers.FloatField()
    outstanding = serializers.FloatField()
    growth_pct = serializers.FloatField()


class TopDoctorSerializer(serializers.Serializer):
    doctor_id = serializers.UUIDField()
    name = serializers.CharField()
    specialty = serializers.CharField()
    avatar = serializers.URLField(required=False, allow_blank=True)
    revenue_generated = serializers.FloatField()
    growth_pct = serializers.FloatField()


class ReportsKPISerializer(serializers.Serializer):
    """Top-level container for all KPI metric cards."""
    total_revenue = KPIEntrySerializer()
    patients_seen = KPIEntrySerializer()
    admissions = KPIEntrySerializer()
    lab_tests = KPIEntrySerializer()
    prescriptions = KPIEntrySerializer()
    teleicu_consults = KPIEntrySerializer()
