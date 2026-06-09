from rest_framework import serializers
from .models import (
    Patient, Encounter, Vitals, Medication, SyncEntry,
    DrugInteraction, Invoice, InvoiceLineItem, MedicalAlert
)


class PatientSerializer(serializers.ModelSerializer):
    age = serializers.IntegerField(read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Patient
        fields = [
            'id', 'hospital_patient_id', 'first_name', 'last_name',
            'full_name', 'date_of_birth', 'age', 'gender', 'phone',
            'email', 'address', 'city', 'state', 'pincode', 'abha_id',
            'is_active', 'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']


class PatientMinimalSerializer(serializers.ModelSerializer):
    """Lightweight serializer for patient lists."""
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Patient
        fields = ['id', 'full_name', 'phone', 'gender', 'age', 'city', 'is_active']


class VitalsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vitals
        fields = [
            'id', 'encounter', 'recorded_at', 'recorded_by',
            'systolic_bp', 'diastolic_bp', 'heart_rate',
            'respiratory_rate', 'temperature', 'oxygen_saturation',
            'weight', 'height', 'blood_glucose',
        ]
        read_only_fields = ['id', 'encounter', 'recorded_at', 'recorded_by']


class MedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medication
        fields = [
            'id', 'encounter', 'drug_name', 'generic_name', 'brand_name',
            'dosage', 'frequency', 'duration', 'route', 'instructions',
            'is_active', 'prescribed_at', 'prescribed_by',
        ]
        read_only_fields = ['id', 'prescribed_at', 'prescribed_by']


class EncounterSerializer(serializers.ModelSerializer):
    vitals = VitalsSerializer(many=True, read_only=True)
    medications = MedicationSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)

    class Meta:
        model = Encounter
        fields = [
            'id', 'patient', 'patient_name', 'encounter_type', 'status',
            'doctor', 'department', 'chief_complaint', 'clinical_notes',
            'diagnosis', 'vitals', 'medications',
            'created_at', 'updated_at', 'scheduled_date', 'completed_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EncounterCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Encounter
        fields = [
            'id', 'patient', 'encounter_type', 'status', 'department',
            'chief_complaint', 'scheduled_date',
        ]
        read_only_fields = ['id', 'status']

    def create(self, validated_data):
        encounter = Encounter(**validated_data)
        encounter.status = 'PLANNED'
        encounter.save()
        return encounter


class SyncEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncEntry
        fields = [
            'record_id', 'model_name', 'jsonb_snapshot', 'version',
            'source', 'role_snapshot_hash', 'created_by',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SyncPushSerializer(serializers.Serializer):
    """Serializer for pushing offline sync entries."""
    entries = SyncEntrySerializer(many=True)


class DrugInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DrugInteraction
        fields = [
            'id', 'drug_a', 'drug_b', 'severity',
            'description', 'mechanism', 'recommendation',
            'source', 'cached_at',
        ]
        read_only_fields = ['id', 'cached_at']


class DDIQuerySerializer(serializers.Serializer):
    """Serializer for DDI check request."""
    drugs = serializers.ListField(
        child=serializers.CharField(max_length=200),
        min_length=2, max_length=20
    )


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = ['id', 'description', 'quantity', 'unit_price', 'total_price']
        read_only_fields = ['id']


class InvoiceSerializer(serializers.ModelSerializer):
    line_items = InvoiceLineItemSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'patient', 'patient_name', 'encounter',
            'invoice_type', 'invoice_number', 'status',
            'subtotal', 'tax', 'tax_percent', 'total',
            'line_items', 'created_at', 'issued_at', 'paid_at',
            'created_by',
        ]
        read_only_fields = ['id', 'invoice_number', 'created_at', 'created_by']


class MedicalAlertSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)

    class Meta:
        model = MedicalAlert
        fields = [
            'id', 'alert_type', 'severity', 'status',
            'patient', 'patient_name', 'encounter', 'message', 'details',
            'created_at', 'acknowledged_at', 'acknowledged_by',
            'resolved_at',
        ]
        read_only_fields = ['id', 'created_at']


class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics response."""
    total_patients = serializers.IntegerField()
    today_encounters = serializers.IntegerField()
    active_alerts = serializers.IntegerField()
    pending_invoices = serializers.IntegerField()
