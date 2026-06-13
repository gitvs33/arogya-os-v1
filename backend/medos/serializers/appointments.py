"""Appointment serializers."""
from rest_framework import serializers
from ..models import Appointment


class AppointmentSerializer(serializers.ModelSerializer):
    """Full appointment detail."""
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    encounter_id = serializers.UUIDField(source='encounter.id', read_only=True)

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_name', 'doctor', 'doctor_name',
            'appointment_type', 'status', 'appointment_date', 'appointment_time',
            'end_time', 'duration_minutes', 'department', 'reason', 'notes',
            'encounter', 'encounter_id',
            'cancellation_reason', 'cancelled_at',
            'checked_in_at', 'completed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'encounter', 'encounter_id',
            'cancelled_at', 'checked_in_at', 'completed_at',
            'created_at', 'updated_at',
        ]

    def get_patient_name(self, obj):
        return str(obj.patient) if obj.patient else ''

    def get_doctor_name(self, obj):
        if obj.doctor:
            return obj.doctor.get_full_name() or obj.doctor.username
        return ''


class AppointmentCreateSerializer(serializers.ModelSerializer):
    """Used for creating appointments (fewer required fields)."""

    class Meta:
        model = Appointment
        fields = [
            'patient', 'doctor', 'appointment_type', 'status',
            'appointment_date', 'appointment_time', 'duration_minutes',
            'department', 'reason', 'notes',
        ]


class AppointmentMinimalSerializer(serializers.ModelSerializer):
    """Compact representation for dashboard / list views."""
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient_name', 'doctor_name',
            'appointment_type', 'status',
            'appointment_date', 'appointment_time',
            'department', 'reason',
        ]

    def get_patient_name(self, obj):
        return str(obj.patient) if obj.patient else ''

    def get_doctor_name(self, obj):
        if obj.doctor:
            return obj.doctor.get_full_name() or obj.doctor.username
        return ''
