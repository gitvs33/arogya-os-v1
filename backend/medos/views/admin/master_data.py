"""Admin master data / lookup table CRUD."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ...permissions import HasAdminWrite
from ...models import MasterDataEntry
from ...admin_serializers import MasterDataEntrySerializer
from ..base import HospitalScopedViewSet


class AdminMasterDataViewSet(HospitalScopedViewSet):
    """Master Data / Lookup Tables CRUD."""
    queryset = MasterDataEntry.objects.all().order_by('category', 'display_order')
    serializer_class = MasterDataEntrySerializer
    permission_classes = [IsAuthenticated, HasAdminWrite]
    search_fields = ['category', 'key', 'value']
    filterset_fields = ['category', 'is_active']

    @action(detail=False, methods=['get'])
    def categories(self, request):
        cats = (MasterDataEntry.objects
                .values_list('category', flat=True)
                .distinct()
                .order_by('category'))
        return Response(list(cats))
