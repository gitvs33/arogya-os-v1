"""Drug-Drug Interaction views."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import F, Q

from ..models import DrugInteraction
from ..serializers import DrugInteractionSerializer, DDIQuerySerializer


class DDIViewSet(viewsets.ReadOnlyModelViewSet):
    """Drug-Drug Interaction lookup."""
    queryset = DrugInteraction.objects.all()
    serializer_class = DrugInteractionSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['drug_a', 'drug_b']

    @action(detail=False, methods=['post'])
    def check(self, request):
        """Check interactions between a list of drugs."""
        serializer = DDIQuerySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        drugs = serializer.validated_data['drugs']
        interactions = DrugInteraction.objects.filter(
            Q(drug_a__in=drugs) & Q(drug_b__in=drugs)
        ).exclude(drug_a=F('drug_b'))
        result = DrugInteractionSerializer(interactions, many=True)
        return Response({
            'drugs': drugs,
            'interactions': result.data,
            'total_interactions': len(result.data),
        })
