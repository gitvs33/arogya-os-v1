"""Laboratory module serializers — test panels/parameters, lab orders, QC, inventory, alerts."""
from rest_framework import serializers
from ..models import (
    TestPanel, TestParameter, LabOrder, LabParameterResult,
    LabDocument, QCEntry, LabInventory, LabAlert,
)


class TestPanelSerializer(serializers.ModelSerializer):
    parameter_count = serializers.SerializerMethodField()

    class Meta:
        model = TestPanel
        fields = [
            'id', 'name', 'short_name', 'category', 'description',
            'standard_tat_hours', 'sample_types', 'method', 'lab_location',
            'is_panel', 'price', 'is_active', 'parameter_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_parameter_count(self, obj):
        return obj.parameters.count() if obj.is_panel else 0


class TestParameterSerializer(serializers.ModelSerializer):
    panel_name = serializers.CharField(source='panel.name', read_only=True)

    class Meta:
        model = TestParameter
        fields = [
            'id', 'panel', 'panel_name', 'group', 'name', 'unit',
            'ref_range_low', 'ref_range_high',
            'critical_low', 'critical_high',
            'display_order', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TestPanelDetailSerializer(TestPanelSerializer):
    """Panel detail with all parameters nested."""
    parameters = TestParameterSerializer(many=True, read_only=True)

    class Meta(TestPanelSerializer.Meta):
        fields = TestPanelSerializer.Meta.fields + ['parameters']


class LabParameterResultSerializer(serializers.ModelSerializer):
    parameter_name = serializers.CharField(source='parameter.name', read_only=True)
    parameter_group = serializers.CharField(source='parameter.group', read_only=True)
    parameter_unit = serializers.CharField(source='parameter.unit', read_only=True)
    ref_range_low = serializers.DecimalField(source='parameter.ref_range_low', read_only=True, max_digits=10, decimal_places=2)
    ref_range_high = serializers.DecimalField(source='parameter.ref_range_high', read_only=True, max_digits=10, decimal_places=2)
    critical_low = serializers.DecimalField(source='parameter.critical_low', read_only=True, max_digits=10, decimal_places=2)
    critical_high = serializers.DecimalField(source='parameter.critical_high', read_only=True, max_digits=10, decimal_places=2)
    display_order = serializers.IntegerField(source='parameter.display_order', read_only=True)
    entered_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LabParameterResult
        fields = [
            'id', 'order', 'parameter', 'parameter_name', 'parameter_group',
            'parameter_unit', 'result_value', 'result_numeric',
            'ref_range_low', 'ref_range_high',
            'critical_low', 'critical_high',
            'status', 'notes', 'display_order',
            'entered_by', 'entered_by_name', 'entered_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'entered_at', 'updated_at']

    def get_entered_by_name(self, obj):
        if obj.entered_by:
            return obj.entered_by.get_full_name() or obj.entered_by.username
        return ''


class LabDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LabDocument
        fields = [
            'id', 'order', 'document_type', 'file_url', 'filename',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at',
        ]
        read_only_fields = ['id', 'uploaded_at']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return ''


class QCEntrySerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = QCEntry
        fields = [
            'id', 'order', 'action', 'performed_by', 'performed_by_name',
            'timestamp', 'notes', 'instrument_id',
        ]
        read_only_fields = ['id', 'timestamp']

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            return obj.performed_by.get_full_name() or obj.performed_by.username
        return ''


class LabInventorySerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = LabInventory
        fields = [
            'id', 'item_name', 'item_type', 'current_stock',
            'min_stock_threshold', 'unit', 'expiry_date',
            'batch_number', 'location', 'is_low_stock',
            'last_restocked_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class LabAlertSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    lab_id = serializers.CharField(source='order.lab_id', read_only=True)
    test_name = serializers.CharField(source='order.test_panel.name', read_only=True)
    parameter_name = serializers.CharField(source='parameter_result.parameter.name', read_only=True, default='')

    class Meta:
        model = LabAlert
        fields = [
            'id', 'order', 'lab_id', 'parameter_result', 'patient',
            'patient_name', 'alert_message', 'severity',
            'test_name', 'parameter_name',
            'is_acknowledged', 'created_at',
            'acknowledged_at', 'acknowledged_by',
        ]
        read_only_fields = ['id', 'created_at']


class LabOrderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the All Tests list view.

    Returns nested objects (patient, test_panel, ordered_by) at their original
    FK field names so the frontend can access order.patient.full_name etc.
    """
    patient = serializers.SerializerMethodField()
    test_panel = serializers.SerializerMethodField()
    ordered_by = serializers.SerializerMethodField()
    critical_count = serializers.SerializerMethodField()
    parameter_count = serializers.SerializerMethodField()
    completed_count = serializers.SerializerMethodField()
    tat_remaining_hours = serializers.SerializerMethodField()
    encounter = serializers.SerializerMethodField()

    class Meta:
        model = LabOrder
        fields = [
            'id', 'lab_id', 'barcode',
            'patient',
            'encounter', 'test_panel',
            'sample_type', 'priority', 'status',
            'department', 'visit_type', 'bed_unit',
            'ordered_by',
            'ordered_at', 'sample_collected_at', 'received_in_lab_at',
            'analysis_completed_at', 'reported_at',
            'tat_deadline', 'tat_remaining_hours',
            'critical_count', 'parameter_count', 'completed_count',
            'comments',
        ]
        read_only_fields = fields

    def get_patient(self, obj):
        if not obj.patient:
            return None
        return {
            'id': str(obj.patient.id),
            'full_name': obj.patient.full_name,
            'age': obj.patient.age,
            'gender': obj.patient.gender,
            'mrn': obj.patient.hospital_patient_id or '',
        }

    def get_test_panel(self, obj):
        if not obj.test_panel:
            return None
        return {
            'id': str(obj.test_panel.id),
            'name': obj.test_panel.name,
            'short_name': obj.test_panel.short_name,
            'category': obj.test_panel.category,
        }

    def get_ordered_by(self, obj):
        if not obj.ordered_by:
            return None
        return {
            'id': str(obj.ordered_by.id),
            'full_name': obj.ordered_by.get_full_name() or obj.ordered_by.username,
        }

    def get_encounter(self, obj):
        if not obj.encounter:
            return None
        return {
            'id': str(obj.encounter.id),
            'encounter_type': obj.encounter.encounter_type,
        }

    def get_critical_count(self, obj):
        return obj.parameter_results.filter(status='CRITICAL').count()

    def get_parameter_count(self, obj):
        return obj.parameter_results.count()

    def get_completed_count(self, obj):
        return obj.parameter_results.exclude(status='PENDING').count()

    def get_tat_remaining_hours(self, obj):
        if not obj.tat_deadline:
            return None
        from django.utils import timezone
        now = timezone.now()
        if now >= obj.tat_deadline:
            return 0
        diff = obj.tat_deadline - now
        return round(diff.total_seconds() / 3600, 1)


class LabOrderDetailSerializer(serializers.ModelSerializer):
    """Full detail serializer for a single lab order with nested data.

    Returns nested objects (patient, test_panel, ordered_by) at their original
    FK field names so the frontend can access order.patient.full_name etc.
    """
    patient = serializers.SerializerMethodField()
    test_panel = serializers.SerializerMethodField()
    ordered_by = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    parameter_results = LabParameterResultSerializer(many=True, read_only=True)
    documents = LabDocumentSerializer(many=True, read_only=True)
    qc_entries = QCEntrySerializer(many=True, read_only=True)
    alerts = LabAlertSerializer(many=True, read_only=True)
    tat_remaining_hours = serializers.SerializerMethodField()

    class Meta:
        model = LabOrder
        fields = [
            'id', 'lab_id', 'barcode',
            'patient',
            'encounter', 'test_panel',
            'sample_type', 'priority', 'status',
            'department', 'visit_type', 'bed_unit',
            'ordered_by',
            'reviewed_by', 'reviewed_by_name',
            'ordered_at', 'sample_collected_at', 'received_in_lab_at',
            'analysis_completed_at', 'reported_at',
            'tat_deadline', 'tat_remaining_hours',
            'comments',
            'parameter_results', 'documents', 'qc_entries', 'alerts',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'lab_id', 'barcode', 'created_at', 'updated_at',
            'ordered_at', 'ordered_by',
        ]

    def get_patient(self, obj):
        if not obj.patient:
            return None
        from ..serializers.patients import PatientMinimalSerializer
        pat_data = PatientMinimalSerializer(
            obj.patient, context=self.context,
        ).data
        pat_data['mrn'] = obj.patient.hospital_patient_id or ''
        return pat_data

    def get_test_panel(self, obj):
        if not obj.test_panel:
            return None
        return TestPanelSerializer(obj.test_panel, context=self.context).data

    def get_ordered_by(self, obj):
        if not obj.ordered_by:
            return None
        return {
            'id': str(obj.ordered_by.id),
            'full_name': obj.ordered_by.get_full_name() or obj.ordered_by.username,
        }

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return ''

    def get_tat_remaining_hours(self, obj):
        if not obj.tat_deadline:
            return None
        from django.utils import timezone
        now = timezone.now()
        if now >= obj.tat_deadline:
            return 0
        diff = obj.tat_deadline - now
        return round(diff.total_seconds() / 3600, 1)


class LabOrderCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new lab order."""
    class Meta:
        model = LabOrder
        fields = [
            'patient', 'encounter', 'test_panel',
            'department', 'sample_type', 'priority',
            'visit_type', 'bed_unit', 'comments',
        ]

    def create(self, validated_data):
        validated_data['ordered_by'] = self.context['request'].user
        return super().create(validated_data)


class LabDashboardStatsSerializer(serializers.Serializer):
    """Lab dashboard KPI cards and status distribution."""
    total_orders = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    completed_today = serializers.IntegerField()
    critical_alerts = serializers.IntegerField()
    pending_reports = serializers.IntegerField()
    samples_collected = serializers.IntegerField()
    tat_compliance_pct = serializers.FloatField()
    low_stock_items = serializers.IntegerField()
    status_distribution = serializers.DictField()


class LabTrendPointSerializer(serializers.Serializer):
    """Single data point for a lab results trend chart."""
    date = serializers.DateTimeField()
    value = serializers.FloatField(allow_null=True)
    status = serializers.CharField()
    lab_id = serializers.CharField()


class LabResultHistorySerializer(serializers.Serializer):
    """Previous results for the same panel across historical orders."""
    lab_id = serializers.CharField()
    ordered_at = serializers.DateTimeField()
    status = serializers.CharField()
    results = LabParameterResultSerializer(many=True)
    reported_by = serializers.CharField(allow_blank=True)



