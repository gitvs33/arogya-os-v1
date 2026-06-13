"""Lab trend and history — time-series data and previous orders for a given panel."""
from datetime import timedelta

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

from ...models import LabOrder, LabParameterResult
from ...serializers import (
    LabTrendPointSerializer, LabParameterResultSerializer,
    LabResultHistorySerializer,
)
from ...subscriptions import require_feature
from ..base import get_hospital_from_user


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('laboratory')
def lab_trend(request):
    """Return time-series data for a parameter across a patient's history."""
    hospital = get_hospital_from_user(request.user)
    patient_id = request.query_params.get('patient_id')
    parameter_id = request.query_params.get('parameter_id')
    months = int(request.query_params.get('months', 6))

    if not patient_id or not parameter_id:
        return Response(
            {'error': 'patient_id and parameter_id are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    since = timezone.now() - timedelta(days=30 * months)

    results = LabParameterResult.objects.filter(
        order__patient_id=patient_id,
        order__hospital=hospital,
        parameter_id=parameter_id,
        result_numeric__isnull=False,
        entered_at__gte=since,
    ).select_related('order').order_by('entered_at')

    data = []
    for r in results:
        data.append({
            'date': r.entered_at,
            'value': float(r.result_numeric) if r.result_numeric is not None else None,
            'status': r.get_status_display(),
            'lab_id': r.order.lab_id,
        })

    serializer = LabTrendPointSerializer(data, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('laboratory')
def lab_history(request):
    """Return previous complete orders for the same test panel."""
    hospital = get_hospital_from_user(request.user)
    patient_id = request.query_params.get('patient_id')
    panel_id = request.query_params.get('panel_id')
    limit = int(request.query_params.get('limit', 5))

    if not patient_id or not panel_id:
        return Response(
            {'error': 'patient_id and panel_id are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    orders = LabOrder.objects.filter(
        patient_id=patient_id,
        test_panel_id=panel_id,
        hospital=hospital,
        status__in=['COMPLETED', 'UNDER_REVIEW'],
    ).prefetch_related(
        'parameter_results__parameter',
        'reviewed_by',
    ).order_by('-ordered_at')[:limit]

    data = []
    for order in orders:
        results_serializer = LabParameterResultSerializer(
            order.parameter_results.all(), many=True,
            context={'request': request}
        )
        data.append({
            'lab_id': order.lab_id,
            'ordered_at': order.ordered_at,
            'status': order.get_status_display(),
            'results': results_serializer.data,
            'reported_by': order.reviewed_by.get_full_name() or order.reviewed_by.username
                         if order.reviewed_by else '',
        })

    serializer = LabResultHistorySerializer(data, many=True)
    return Response(serializer.data)
