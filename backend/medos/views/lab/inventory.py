"""Lab inventory — manage reagents, consumables, equipment, low-stock alerts."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import F

from ...models import LabInventory
from ...serializers import LabInventorySerializer
from ...subscriptions import HasFeatureAccess
from ..base import HospitalScopedViewSet


class LabInventoryViewSet(HospitalScopedViewSet):
    """Manage lab reagents, consumables, and equipment."""
    queryset = LabInventory.objects.all()
    serializer_class = LabInventorySerializer
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'laboratory'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['item_type']
    search_fields = ['item_name']
    ordering = ['item_name']

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Return items with stock at or below the minimum threshold."""
        qs = self.get_queryset().filter(
            min_stock_threshold__gt=0,
            current_stock__lte=F('min_stock_threshold'),
        ).order_by('current_stock')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
