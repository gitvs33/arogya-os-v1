"""Patient registration, profile, and insurance serializers."""
from rest_framework import serializers
from ..models import Patient, PatientInsurance
from .encounters import EncounterCreateSerializer

class PatientSerializer(serializers.ModelSerializer):
    age = serializers.IntegerField(read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Patient
        fields = [
            'id', 'hospital_patient_id', 'first_name', 'last_name',
            'full_name', 'date_of_birth', 'age', 'gender', 'phone',
            'email',
            # Registration wizard state
            'registration_status',
            # Emergency Contact
            'emergency_contact_name', 'emergency_contact_relationship',
            'emergency_contact_phone', 'emergency_contact_alternate_phone',
            # Additional Basic Info
            'marital_status', 'nationality',
            # Identification
            'aadhaar_number', 'pan_number',
            'identification_type', 'identification_number',
            # Address (structured)
            'address', 'address_line1', 'address_line2',
            'city', 'state', 'pincode', 'country',
            'abha_id',
            'blood_group', 'profile_picture',
            'insurance_provider', 'insurance_id',
            'is_active', 'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']


class PatientMinimalSerializer(serializers.ModelSerializer):
    """Lightweight serializer for patient lists."""
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Patient
        fields = ['id', 'full_name', 'phone', 'gender', 'age', 'city', 'blood_group', 'is_active']


class PatientInsuranceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientInsurance
        fields = [
            'id', 'patient', 'provider_name', 'policy_number',
            'valid_upto', 'coverage_amount', 'is_primary',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PatientRegistrationSerializer(serializers.Serializer):
    """Composite serializer for one-shot patient registration with encounter."""
    patient = PatientSerializer()
    encounter = EncounterCreateSerializer(required=False)
    insurance = PatientInsuranceSerializer(required=False, many=True)

    def create(self, validated_data):
        patient_data = validated_data.pop('patient')
        encounter_data = validated_data.pop('encounter', None)
        insurance_data = validated_data.pop('insurance', [])

        # Lazy import to avoid circular dependency
        from ..views.base import get_hospital_from_user
        hospital = get_hospital_from_user(self.context['request'].user)

        # Create patient
        patient_serializer = PatientSerializer(data=patient_data)
        patient_serializer.is_valid(raise_exception=True)
        patient = patient_serializer.save(
            created_by=self.context['request'].user,
            hospital=hospital,
        )

        # Create encounter if provided
        encounter = None
        if encounter_data:
            encounter_data.pop('patient', None)
            enc_serializer = EncounterCreateSerializer(
                data=encounter_data,
                context=self.context,
            )
            enc_serializer.is_valid(raise_exception=True)
            encounter = enc_serializer.save(
                doctor=self.context['request'].user,
                patient=patient,
                hospital=hospital,
            )

        # Create insurance policies if provided
        for ins_data in insurance_data:
            ins_data['patient'] = patient.id
            ins_serializer = PatientInsuranceSerializer(data=ins_data)
            ins_serializer.is_valid(raise_exception=True)
            ins_serializer.save(hospital=hospital)

        return {'patient': patient, 'encounter': encounter}
