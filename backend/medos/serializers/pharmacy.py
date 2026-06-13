"""Pharmacy serializers."""
from rest_framework import serializers
from ..models import Drug, DrugInventory, Dispensation


class DrugSerializer(serializers.ModelSerializer):
    class Meta:
        model = Drug
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class DrugMinimalSerializer(serializers.ModelSerializer):
    """Compact drug info for dropdowns."""
    class Meta:
        model = Drug
        fields = ['id', 'name', 'generic_name', 'strength', 'dosage_form']


class DrugInventorySerializer(serializers.ModelSerializer):
    drug_name = serializers.SerializerMethodField()

    class Meta:
        model = DrugInventory
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_drug_name(self, obj):
        return str(obj.drug) if obj.drug else ''


class DispensationSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    dispensed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Dispensation
        fields = '__all__'
        read_only_fields = [
            'id', 'dispensed_at', 'dispensed_by',
            'created_at', 'updated_at',
        ]

    def get_patient_name(self, obj):
        return str(obj.patient) if obj.patient else ''

    def get_dispensed_by_name(self, obj):
        if obj.dispensed_by:
            return obj.dispensed_by.get_full_name() or obj.dispensed_by.username
        return ''


class DispensationCreateSerializer(serializers.ModelSerializer):
    """Lightweight create serializer for dispensing."""
    class Meta:
        model = Dispensation
        fields = [
            'medication', 'encounter', 'patient', 'drug_name',
            'dosage', 'quantity_dispensed', 'unit',
            'inventory_item', 'notes',
        ]
