"""Clinical data serializers — alerts, lab results, allergies, diagnoses, orders, imaging, documents, care plans."""
from rest_framework import serializers
from ..models import (
    MedicalAlert, LabResult, Allergy, Diagnosis,
    ServiceOrder, ImagingResult, PatientDocument, CarePlan,
)


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


class LabResultSerializer(serializers.ModelSerializer):
    test_name_with_status = serializers.SerializerMethodField()

    class Meta:
        model = LabResult
        fields = [
            'id', 'encounter', 'test_name', 'category',
            'result_value', 'reference_range', 'unit', 'status',
            'notes', 'ordered_by', 'ordered_at', 'resulted_at',
            'updated_at', 'test_name_with_status',
        ]
        read_only_fields = ['id', 'ordered_at', 'ordered_by', 'updated_at']

    def get_test_name_with_status(self, obj):
        return f"{obj.test_name} ({obj.get_status_display()})"


class AllergySerializer(serializers.ModelSerializer):
    class Meta:
        model = Allergy
        fields = [
            'id', 'patient', 'allergen', 'reaction', 'severity',
            'onset_date', 'is_active', 'noted_by', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DiagnosisSerializer(serializers.ModelSerializer):
    duration = serializers.SerializerMethodField()

    class Meta:
        model = Diagnosis
        fields = [
            'id', 'patient', 'encounter', 'icd10_code', 'condition_name',
            'onset_date', 'resolved_date', 'duration', 'status', 'notes',
            'diagnosed_by', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_duration(self, obj):
        if not obj.onset_date:
            return None
        from datetime import date
        delta = (date.today() - obj.onset_date).days // 365
        return f"Since {delta} yr{'s' if delta != 1 else ''}" if delta >= 1 else "Since last year"


class ServiceOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrder
        fields = [
            'id', 'patient', 'encounter', 'order_name', 'category',
            'status', 'clinical_notes', 'ordered_by', 'ordered_at',
            'completed_at',
        ]
        read_only_fields = ['id', 'ordered_at', 'ordered_by', 'updated_at']


class ImagingResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImagingResult
        fields = [
            'id', 'patient', 'encounter', 'modality', 'title',
            'findings', 'impression', 'status', 'report_file',
            'ordered_by', 'reviewed_by', 'ordered_at', 'resulted_at',
        ]
        read_only_fields = ['id', 'ordered_at', 'updated_at']


class PatientDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientDocument
        fields = [
            'id', 'patient', 'encounter', 'document_type', 'title',
            'description', 'file_url', 'notes', 'uploaded_by',
            'uploaded_at', 'updated_at',
        ]
        read_only_fields = ['id', 'uploaded_at', 'updated_at', 'uploaded_by']


class CarePlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = CarePlan
        fields = [
            'id', 'patient', 'encounter', 'title', 'description',
            'goals', 'interventions', 'status', 'start_date', 'end_date',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']
