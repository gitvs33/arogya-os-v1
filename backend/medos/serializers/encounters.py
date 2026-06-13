"""Encounter, vitals, medication, and timeline serializers."""
from rest_framework import serializers

from ..models import Encounter, Vitals, Medication, Prescription, Department


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
            'id', 'encounter', 'prescription',
            'drug_name', 'generic_name', 'brand_name',
            'dosage', 'frequency', 'duration', 'route',
            'quantity', 'unit_price',
            'instructions', 'is_active', 'cancellation_reason',
            'prescribed_at', 'prescribed_by',
        ]
        read_only_fields = ['id', 'prescribed_at', 'prescribed_by']


class PrescriptionSerializer(serializers.ModelSerializer):
    medications = MedicationSerializer(many=True, read_only=True)
    lab_orders = serializers.SerializerMethodField()
    ordered_by_name = serializers.SerializerMethodField()
    encounter_number = serializers.CharField(source='encounter.encounter_number', read_only=True)
    patient_name = serializers.CharField(source='encounter.patient.full_name', read_only=True)

    class Meta:
        model = Prescription
        fields = [
            'id', 'encounter', 'encounter_number', 'patient_name',
            'status', 'version', 'superseded_by',
            'medications', 'lab_orders',
            'ordered_at', 'ordered_by', 'ordered_by_name',
            'cancellation_reason', 'pharmacy_notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'encounter', 'status', 'version',
            'ordered_at', 'ordered_by', 'created_at', 'updated_at',
        ]

    def get_lab_orders(self, obj):
        from ..serializers.lab import LabOrderListSerializer
        orders = obj.lab_orders.all()
        return LabOrderListSerializer(orders, many=True, context=self.context).data

    def get_ordered_by_name(self, obj):
        if obj.ordered_by:
            return obj.ordered_by.get_full_name() or obj.ordered_by.username
        return ''


class EncounterSerializer(serializers.ModelSerializer):
    vitals = VitalsSerializer(many=True, read_only=True)
    medications = MedicationSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    department_name = serializers.CharField(source='department', read_only=True)

    class Meta:
        model = Encounter
        fields = [
            'id', 'encounter_number', 'patient', 'patient_name',
            'encounter_type', 'status',
            'doctor', 'department', 'department_ref', 'department_name',
            'location',
            'bed_number', 'clinical_acuity', 'care_sub_status',
            'chief_complaint', 'clinical_notes',
            'diagnosis', 'vitals', 'medications',
            'created_at', 'updated_at', 'scheduled_date',
            'completed_at', 'follow_up_date',
        ]
        read_only_fields = ['id', 'encounter_number', 'created_at', 'updated_at', 'department_name']

    def validate(self, attrs):
        # Sync department_ref with department text
        department_ref = attrs.get('department_ref')
        if department_ref and not attrs.get('department'):
            attrs['department'] = department_ref.name
        department = attrs.get('department')
        if department and not department_ref:
            # Try to find a matching Department record
            hospital = self.context['request'].hospital
            match = Department.objects.filter(
                hospital=hospital,
                name__iexact=department,
            ).first()
            if match:
                attrs['department_ref'] = match
        return attrs


class EncounterCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Encounter
        fields = [
            'id', 'encounter_number', 'patient', 'encounter_type',
            'status', 'department', 'department_ref', 'location',
            'bed_number', 'clinical_acuity', 'care_sub_status',
            'chief_complaint', 'scheduled_date',
        ]
        read_only_fields = ['id', 'encounter_number', 'status']
        extra_kwargs = {
            'patient': {'required': False},
        }

    def validate(self, attrs):
        # Sync department_ref with department text
        department_ref = attrs.get('department_ref')
        if department_ref and not attrs.get('department'):
            attrs['department'] = department_ref.name
        department = attrs.get('department')
        if department and not department_ref:
            # Try to find a matching Department record
            hospital = self.context['request'].hospital
            match = Department.objects.filter(
                hospital=hospital,
                name__iexact=department,
            ).first()
            if match:
                attrs['department_ref'] = match
        return attrs

    def create(self, validated_data):
        encounter = Encounter(**validated_data)
        encounter.status = 'ACTIVE' if encounter.encounter_type in ['TELEICU', 'EMERGENCY', 'OPD', 'IPD'] else 'PLANNED'
        encounter.save()

        if encounter.encounter_type == 'TELEICU':
            from ..models.icu import TeleICUSession, ICUBed
            hospital = getattr(encounter, 'hospital', None)
            
            # Try to assign an available bed
            bed = ICUBed.objects.filter(hospital=hospital, status='AVAILABLE').first()
            if bed:
                bed.status = 'OCCUPIED'
                bed.save(update_fields=['status'])
                encounter.bed_number = bed.bed_number
                encounter.location = bed.ward.name
                encounter.save(update_fields=['bed_number', 'location'])

            TeleICUSession.objects.create(
                encounter=encounter,
                hospital=hospital,
                bed=bed,
                acuity_status='STABLE',
                is_active=True
            )
            
            from ..teleicu.registry import get_registry
            from ..tasks import generate_mock_vitals
            get_registry().add(str(encounter.patient.id), str(encounter.id))
            try:
                generate_mock_vitals.delay(str(encounter.patient.id), str(encounter.id))
            except Exception:
                pass  # Ignore if celery is not running

        return encounter


class TimelineEntrySerializer(serializers.Serializer):
    """Unified timeline event — wraps any model into a feed entry."""
    id = serializers.CharField()
    type = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField(required=False, default='')
    timestamp = serializers.DateTimeField()
    data = serializers.JSONField(required=False, default=dict)
