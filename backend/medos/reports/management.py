"""Reports & Analytics — Report management views (crud, scheduling, saved views)."""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import ReportDefinition, GeneratedReport, ScheduledReport, SavedDashboardView
from ..serializers import (
    ReportDefinitionSerializer,
    GeneratedReportSerializer,
    ScheduledReportSerializer,
    SavedDashboardViewSerializer,
)
from ..subscriptions import require_feature


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def recent_reports(request):
    """Return recently generated reports (Recent Reports table)."""
    reports = GeneratedReport.objects.select_related(
        'report_definition', 'generated_by'
    ).all()[:50]
    serializer = GeneratedReportSerializer(reports, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def generate_report(request):
    """Trigger asynchronous generation of a new report.

    Request body:
    {
        "report_definition_id": "<uuid>",
        "format_type": "PDF" | "EXCEL" | "CSV",
        "parameters": { "date_from": "...", "date_to": "...", ... }
    }

    Creates a GeneratedReport record with status=PENDING and kicks off a
    Celery background task. Returns the GeneratedReport record.
    """
    report_def_id = request.data.get('report_definition_id')
    format_type = request.data.get('format_type', 'PDF')
    parameters = request.data.get('parameters', {})

    if not report_def_id:
        return Response(
            {'error': 'report_definition_id is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        report_def = ReportDefinition.objects.get(id=report_def_id)
    except ReportDefinition.DoesNotExist:
        return Response(
            {'error': 'Report definition not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if format_type.upper() not in ['PDF', 'EXCEL', 'CSV']:
        return Response(
            {'error': 'format_type must be PDF, EXCEL, or CSV'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    generated = GeneratedReport.objects.create(
        report_definition=report_def,
        generated_by=request.user,
        parameters_used=parameters,
        format_type=format_type.upper(),
        status='PENDING',
    )

    # Kick off async Celery task
    from ..tasks import process_report_generation
    process_report_generation.delay(str(generated.id))

    serializer = GeneratedReportSerializer(generated)
    return Response(serializer.data, status=status.HTTP_202_ACCEPTED)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def scheduled_reports(request):
    """GET: List scheduled reports for the current user.
    POST: Create a new scheduled report subscription.
    """
    if request.method == 'GET':
        qs = ScheduledReport.objects.filter(
            user=request.user
        ).select_related('report_definition')
        serializer = ScheduledReportSerializer(qs, many=True)
        return Response(serializer.data)

    # POST — create
    serializer = ScheduledReportSerializer(data=request.data, context={'request': request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    serializer.save(user=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def saved_dashboard_views(request):
    """GET: List saved dashboard views for the current user.
    POST: Save a new dashboard view (filters preset).
    DELETE: Delete a saved view (requires ?id= query param).
    """
    if request.method == 'GET':
        qs = SavedDashboardView.objects.filter(user=request.user).order_by('-is_pinned', '-updated_at')
        serializer = SavedDashboardViewSerializer(qs, many=True)
        return Response(serializer.data)

    if request.method == 'DELETE':
        view_id = request.query_params.get('id')
        if not view_id:
            return Response(
                {'error': 'id query parameter is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deleted, _ = SavedDashboardView.objects.filter(id=view_id, user=request.user).delete()
        if deleted:
            return Response({'deleted': True})
        return Response(
            {'error': 'View not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    # POST — create
    serializer = SavedDashboardViewSerializer(data=request.data, context={'request': request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    serializer.save(user=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def reports_report_definitions(request):
    """List all active report definitions (template catalog)."""
    qs = ReportDefinition.objects.filter(is_active=True)
    serializer = ReportDefinitionSerializer(qs, many=True)
    return Response(serializer.data)
