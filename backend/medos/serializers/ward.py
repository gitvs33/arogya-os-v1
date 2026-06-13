"""Ward/IPD serializers."""
from rest_framework import serializers
from ..models import (
    Ward, Bed, DailyRound, NursingNote, MedicationAdministration,
    BillingAccrual,
)


# ═══════════════════════════════════════════════════════════════════════════════
#  WARD
# ═══════════════════════════════════════════════════════════════════════════════


class WardSerializer(serializers.ModelSerializer):
    total_beds = serializers.IntegerField(read_only=True)
    available_beds = serializers.IntegerField(read_only=True)
    occupied_beds = serializers.IntegerField(read_only=True)

    class Meta:
        model = Ward
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class WardMinimalSerializer(serializers.ModelSerializer):
    """Compact ward info for dropdowns and quick views."""
    class Meta:
        model = Ward
        fields = ['id', 'name', 'ward_type', 'bed_charge_per_day']


# ═══════════════════════════════════════════════════════════════════════════════
#  BED
# ═══════════════════════════════════════════════════════════════════════════════


class BedSerializer(serializers.ModelSerializer):
    ward_name = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    days_occupied = serializers.IntegerField(read_only=True)

    class Meta:
        model = Bed
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_ward_name(self, obj):
        return obj.ward.name if obj.ward else ''

    def get_patient_name(self, obj):
        return obj.patient_name


class BedCreateSerializer(serializers.ModelSerializer):
    """Lightweight for creating beds."""
    class Meta:
        model = Bed
        fields = ['ward', 'bed_number', 'notes']


class BedMapSerializer(serializers.Serializer):
    """Bed map entry — used by the bed-map endpoint."""
    id = serializers.UUIDField()
    bed_number = serializers.CharField()
    status = serializers.CharField()
    status_label = serializers.CharField()
    notes = serializers.CharField()
    patient = serializers.DictField(child=serializers.CharField(), allow_null=True)
    encounter = serializers.DictField(child=serializers.CharField(), allow_null=True)


class WardBedMapSerializer(serializers.Serializer):
    """Full ward with beds for the bed-map endpoint."""
    id = serializers.UUIDField()
    name = serializers.CharField()
    ward_type = serializers.CharField()
    ward_type_label = serializers.CharField()
    bed_charge_per_day = serializers.CharField()
    floor = serializers.CharField()
    total_beds = serializers.IntegerField()
    available_beds = serializers.IntegerField()
    occupied_beds = serializers.IntegerField()
    beds = BedMapSerializer(many=True)


# ═══════════════════════════════════════════════════════════════════════════════
#  DAILY ROUND
# ═══════════════════════════════════════════════════════════════════════════════


class DailyRoundSerializer(serializers.ModelSerializer):
    conducted_by_name = serializers.SerializerMethodField()
    encounter_patient_name = serializers.SerializerMethodField()
    prescription_id = serializers.SerializerMethodField()

    class Meta:
        model = DailyRound
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_conducted_by_name(self, obj):
        if obj.conducted_by:
            return obj.conducted_by.get_full_name() or obj.conducted_by.username
        return ''

    def get_encounter_patient_name(self, obj):
        if obj.encounter and obj.encounter.patient:
            return obj.encounter.patient.full_name
        return ''

    def get_prescription_id(self, obj):
        return str(obj.prescription.id) if obj.prescription else None


class DailyRoundCreateSerializer(serializers.ModelSerializer):
    """For creating/initialising a daily round."""
    class Meta:
        model = DailyRound
        fields = ['encounter', 'notes']


# ═══════════════════════════════════════════════════════════════════════════════
#  NURSING NOTE
# ═══════════════════════════════════════════════════════════════════════════════


class NursingNoteSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = NursingNote
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name() or obj.recorded_by.username
        return ''


# ═══════════════════════════════════════════════════════════════════════════════
#  MEDICATION ADMINISTRATION
# ═══════════════════════════════════════════════════════════════════════════════


class MedicationAdministrationSerializer(serializers.ModelSerializer):
    drug_name = serializers.SerializerMethodField()
    administered_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicationAdministration
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def get_drug_name(self, obj):
        return obj.medication.drug_name if obj.medication else ''

    def get_administered_by_name(self, obj):
        if obj.administered_by:
            return obj.administered_by.get_full_name() or obj.administered_by.username
        return ''


class MedicationAdministrationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationAdministration
        fields = ['encounter', 'medication', 'administered_at', 'dose_given', 'route', 'notes']


# ═══════════════════════════════════════════════════════════════════════════════
#  BILLING ACCRUAL
# ═══════════════════════════════════════════════════════════════════════════════


class BillingAccrualSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingAccrual
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


# ═══════════════════════════════════════════════════════════════════════════════
#  DISCHARGE
# ═══════════════════════════════════════════════════════════════════════════════


class DischargeReadinessSerializer(serializers.Serializer):
    can_discharge = serializers.BooleanField()
    blocks = serializers.ListField(child=serializers.DictField())
    encounter_id = serializers.CharField()
    patient_name = serializers.CharField()


class DischargeDataSerializer(serializers.Serializer):
    discharge_diagnosis = serializers.CharField(required=True)
    condition_at_discharge = serializers.CharField(required=False, allow_blank=True)
    follow_up_instructions = serializers.CharField(required=False, allow_blank=True)
    discharge_medications = serializers.CharField(required=False, allow_blank=True)


# ═══════════════════════════════════════════════════════════════════════════════
#  NURSING STATION
# ═══════════════════════════════════════════════════════════════════════════════


class NursingStationPendingMedicationSerializer(serializers.Serializer):
    bed_number = serializers.CharField()
    patient_name = serializers.CharField()
    patient_id = serializers.CharField()
    encounter_id = serializers.CharField()
    medication_id = serializers.CharField()
    drug_name = serializers.CharField()
    dosage = serializers.CharField()
    route = serializers.CharField()
    frequency = serializers.CharField()


class NursingStationVitalsDueSerializer(serializers.Serializer):
    bed_number = serializers.CharField()
    patient_name = serializers.CharField()
    patient_id = serializers.CharField()
    encounter_id = serializers.CharField()
    last_recorded = serializers.CharField()
    needs_vitals = serializers.BooleanField()


class NursingStationAlertSerializer(serializers.Serializer):
    bed_number = serializers.CharField()
    patient_name = serializers.CharField()
    patient_id = serializers.CharField()
    encounter_id = serializers.CharField()
    alert_id = serializers.CharField()
    severity = serializers.CharField()
    message = serializers.CharField()
    created_at = serializers.CharField()


class NursingStationSerializer(serializers.Serializer):
    pending_medications = NursingStationPendingMedicationSerializer(many=True)
    vitals_due = NursingStationVitalsDueSerializer(many=True)
    alerts = NursingStationAlertSerializer(many=True)
