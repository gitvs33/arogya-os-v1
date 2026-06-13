"""Admin ward & bed setup serializers."""
from rest_framework import serializers
from ...models import Ward, Bed


class AdminWardSerializer(serializers.ModelSerializer):
    """Serializer for ward CRUD in admin panel."""
    bed_count = serializers.SerializerMethodField()
    occupied_count = serializers.SerializerMethodField()
    available_count = serializers.SerializerMethodField()

    class Meta:
        model = Ward
        fields = [
            'id', 'name', 'ward_type', 'floor', 'bed_charge_per_day',
            'is_active',
            'bed_count', 'occupied_count', 'available_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at',
                            'bed_count', 'occupied_count', 'available_count']

    def get_bed_count(self, obj):
        return Bed.objects.filter(ward=obj).count()

    def get_occupied_count(self, obj):
        return Bed.objects.filter(ward=obj, status__iexact='occupied').count()

    def get_available_count(self, obj):
        return Bed.objects.filter(ward=obj, status__iexact='available').count()


class AdminWardDetailSerializer(AdminWardSerializer):
    """Detail serializer that also includes bed breakdown by status."""
    maintenance_count = serializers.SerializerMethodField()

    class Meta(AdminWardSerializer.Meta):
        fields = AdminWardSerializer.Meta.fields + ['maintenance_count']

    def get_maintenance_count(self, obj):
        return Bed.objects.filter(ward=obj, status__iexact='maintenance').count()


class AdminBedSerializer(serializers.ModelSerializer):
    """Serializer for individual bed in admin panel."""
    patient_name = serializers.SerializerMethodField()
    encounter_id = serializers.SerializerMethodField()
    ward_name = serializers.SerializerMethodField()

    class Meta:
        model = Bed
        fields = [
            'id', 'ward', 'ward_name', 'bed_number',
            'status',
            'patient_name', 'encounter_id',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at',
                            'patient_name', 'encounter_id', 'ward_name']

    def get_ward_name(self, obj):
        return obj.ward.name if obj.ward else ''

    def get_patient_name(self, obj):
        if obj.current_encounter and obj.current_encounter.patient:
            return obj.current_encounter.patient.full_name
        return None

    def get_encounter_id(self, obj):
        if obj.current_encounter:
            return str(obj.current_encounter.id)
        return None


class AdminBedCreateSerializer(serializers.Serializer):
    """Serializer for bulk bed creation."""
    count = serializers.IntegerField(min_value=1, max_value=100, default=1)
    bed_number_start = serializers.IntegerField(default=1)
