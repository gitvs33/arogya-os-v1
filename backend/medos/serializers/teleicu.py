"""TeleICU serializers — wards, beds, sessions, consults, activity log, dashboard stats."""
from rest_framework import serializers
from ..models import ICUWard, ICUBed, TeleICUSession, TeleConsultSession, SystemActivityLog


class ICUWardSerializer(serializers.ModelSerializer):
    available_beds = serializers.IntegerField(read_only=True)
    occupied_beds = serializers.IntegerField(read_only=True)

    class Meta:
        model = ICUWard
        fields = [
            'id', 'name', 'total_beds',
            'available_beds', 'occupied_beds',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ICUBedSerializer(serializers.ModelSerializer):
    ward_name = serializers.CharField(source='ward.name', read_only=True)

    class Meta:
        model = ICUBed
        fields = [
            'id', 'ward', 'ward_name', 'bed_number', 'status',
            'camera_feed_url', 'device_ip',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TeleICUSessionSerializer(serializers.ModelSerializer):
    patient_id = serializers.UUIDField(source='encounter.patient_id', read_only=True)
    patient_name = serializers.CharField(source='encounter.patient.full_name', read_only=True)
    encounter_number = serializers.CharField(source='encounter.encounter_number', read_only=True)
    bed_label = serializers.CharField(source='bed.__str__', read_only=True)
    ward_name = serializers.CharField(source='bed.ward.name', read_only=True, default='')

    class Meta:
        model = TeleICUSession
        fields = [
            'id', 'encounter', 'bed', 'bed_label', 'ward_name',
            'patient_id', 'patient_name', 'encounter_number',
            'acuity_status', 'support_type', 'is_active',
            'admitted_at', 'discharged_at', 'updated_at',
        ]
        read_only_fields = ['id', 'admitted_at', 'updated_at']


class TeleICUSessionCreateSerializer(serializers.ModelSerializer):
    """Used for creating a new TeleICUSession."""
    class Meta:
        model = TeleICUSession
        fields = [
            'encounter', 'bed', 'acuity_status', 'support_type', 'is_active',
        ]


class TeleConsultSessionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = TeleConsultSession
        fields = [
            'id', 'patient', 'patient_name', 'doctor', 'doctor_name',
            'encounter', 'specialty', 'call_type', 'status',
            'meeting_link', 'started_at', 'ended_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_doctor_name(self, obj):
        return obj.doctor.get_full_name() or obj.doctor.username if obj.doctor else ''


class SystemActivityLogSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True, default='')

    class Meta:
        model = SystemActivityLog
        fields = [
            'id', 'patient', 'patient_name', 'encounter',
            'event_type', 'description', 'author_name', 'metadata',
            'timestamp',
        ]
        read_only_fields = ['id', 'timestamp']


class TeleICUVitalsTrendPointSerializer(serializers.Serializer):
    """Single data point for vital trend charts."""
    timestamp = serializers.DateTimeField()
    heart_rate = serializers.FloatField(required=False, allow_null=True)
    systolic_bp = serializers.FloatField(required=False, allow_null=True)
    diastolic_bp = serializers.FloatField(required=False, allow_null=True)
    respiratory_rate = serializers.FloatField(required=False, allow_null=True)
    oxygen_saturation = serializers.FloatField(required=False, allow_null=True)
    temperature = serializers.FloatField(required=False, allow_null=True)


class TeleICUDashboardStatsSerializer(serializers.Serializer):
    """Top-level TeleICU dashboard KPIs."""
    total_patients = serializers.IntegerField()
    critical_alerts_count = serializers.IntegerField()
    new_alerts_today = serializers.IntegerField()
    devices_online_pct = serializers.FloatField()
    active_consults = serializers.IntegerField()
    occupied_beds = serializers.IntegerField()
    total_beds = serializers.IntegerField()


class TeleICUPatientSerializer(serializers.Serializer):
    """Patient in the TeleICU list with bed info + latest vitals snapshot."""
    id = serializers.UUIDField()
    name = serializers.CharField()
    bed = serializers.CharField(required=False, allow_blank=True)
    ward = serializers.CharField(required=False, allow_blank=True)
    status = serializers.CharField()
    support_type = serializers.CharField(required=False, allow_blank=True)
    vitals = serializers.DictField(required=False, default=dict)
    encounter_id = serializers.UUIDField(required=False)
    session_id = serializers.UUIDField(required=False)
