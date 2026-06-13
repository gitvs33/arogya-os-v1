"""Lab quality control — audit trail, QC entries, cross-order overview."""
from rest_framework import status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from ...models import LabOrder, QCEntry
from ...serializers import QCEntrySerializer
from ...subscriptions import HasFeatureAccess, require_feature
from ..base import HospitalScopedReadOnlyViewSet, get_hospital_from_user


class QCEntryViewSet(HospitalScopedReadOnlyViewSet):
    """View quality control audit trail entries."""
    queryset = QCEntry.objects.select_related('performed_by').all()
    serializer_class = QCEntrySerializer
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'laboratory'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['order', 'action']
    ordering = ['-timestamp']


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_feature('laboratory')
def lab_create_qc_entry(request, order_id):
    """Log a custom QC entry for a lab order."""
    try:
        hospital = get_hospital_from_user(request.user)
        order = LabOrder.objects.get(id=order_id, hospital=hospital)
    except LabOrder.DoesNotExist:
        return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)

    entry = QCEntry.objects.create(
        order=order,
        action=request.data.get('action', ''),
        performed_by=request.user,
        notes=request.data.get('notes', ''),
        instrument_id=request.data.get('instrument_id', ''),
    )
    serializer = QCEntrySerializer(entry, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('laboratory')
def lab_qc_overview(request):
    """Return all QC entries across orders (Quality Control tab)."""
    hospital = get_hospital_from_user(request.user)
    qs = QCEntry.objects.filter(order__hospital=hospital).select_related(
        'performed_by', 'order__test_panel'
    )

    action = request.query_params.get('action')
    limit = int(request.query_params.get('limit', 50))

    if action:
        qs = qs.filter(action__icontains=action)

    qs = qs.order_by('-timestamp')[:limit]

    results = []
    for entry in qs:
        results.append({
            'id': str(entry.id),
            'lab_id': entry.order.lab_id,
            'test_name': entry.order.test_panel.name,
            'action': entry.action,
            'performed_by': entry.performed_by.get_full_name() or entry.performed_by.username
                           if entry.performed_by else '',
            'timestamp': entry.timestamp,
            'notes': entry.notes,
            'instrument_id': entry.instrument_id,
        })

    return Response(results)
