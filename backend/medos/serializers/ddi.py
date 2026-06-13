"""Drug-drug interaction serializers."""
from rest_framework import serializers
from ..models import DrugInteraction


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
