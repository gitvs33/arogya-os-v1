"""Lab order management — CRUD, lifecycle actions (collect, receive, approve, repeat), dashboard stats, labels, CSV export."""
import csv

from django.db.models import F
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from ...lab.workflow import LabOrderWorkflow, InvalidTransition
from ...models import LabOrder, LabAlert, LabInventory, LabParameterResult
from ...serializers import (
    LabOrderListSerializer, LabOrderDetailSerializer,
    LabOrderCreateSerializer, LabDashboardStatsSerializer,
)
from ...subscriptions import HasFeatureAccess
from ..base import HospitalScopedViewSet, get_hospital_from_user


class LabOrderViewSet(HospitalScopedViewSet):
    """Central lab order management with full lifecycle."""
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'laboratory'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'sample_type', 'department', 'priority', 'patient']
    search_fields = ['lab_id', 'barcode', 'patient__first_name', 'patient__last_name', 'patient__phone']
    ordering_fields = ['-ordered_at', 'priority', 'tat_deadline']
    ordering = ['-ordered_at']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return LabOrderCreateSerializer
        if self.action == 'retrieve':
            return LabOrderDetailSerializer
        if self.action == 'dashboard_stats':
            return LabDashboardStatsSerializer
        return LabOrderListSerializer

    def get_queryset(self):
        qs = LabOrder.objects.select_related(
            'patient', 'test_panel', 'ordered_by', 'reviewed_by', 'encounter'
        ).prefetch_related(
            'parameter_results__parameter',
            'documents',
            'qc_entries',
            'alerts',
        )
        return qs

    def perform_create(self, serializer):
        serializer.save(ordered_by=self.request.user, hospital=self.get_hospital())

    # ── Lifecycle Actions ─────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def collect_sample(self, request, pk=None):
        order = self.get_object()
        try:
            result = LabOrderWorkflow.collect_sample(
                order, request.user,
                notes=request.data.get('notes', ''),
            )
        except InvalidTransition as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(LabOrderListSerializer(result.order, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def receive_in_lab(self, request, pk=None):
        order = self.get_object()
        try:
            result = LabOrderWorkflow.receive_in_lab(
                order, request.user,
                instrument_id=request.data.get('instrument_id', ''),
                notes=request.data.get('notes', ''),
            )
        except InvalidTransition as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(LabOrderListSerializer(result.order, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def submit_results(self, request, pk=None):
        order = self.get_object()
        results_data = request.data.get('results', [])
        if not results_data:
            return Response(
                {'error': 'No results provided. Send a "results" array.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = LabOrderWorkflow.submit_results(order, request.user, results_data)
        except (InvalidTransition, ValueError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        serializer = LabOrderDetailSerializer(result.order, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def approve_report(self, request, pk=None):
        order = self.get_object()
        try:
            result = LabOrderWorkflow.approve_report(
                order, request.user,
                notes=request.data.get('notes', ''),
            )
        except InvalidTransition as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(LabOrderDetailSerializer(result.order, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def repeat_test(self, request, pk=None):
        original = self.get_object()
        new_order = LabOrderWorkflow.repeat_test(
            original, request.user,
            comments=request.data.get('comments', ''),
        )
        return Response(
            LabOrderDetailSerializer(new_order, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def add_note(self, request, pk=None):
        order = self.get_object()
        note = request.data.get('comments', '')
        if not note:
            return Response({'error': 'comments field is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = LabOrderWorkflow.add_note(order, request.user, note)
        except InvalidTransition as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(LabOrderDetailSerializer(result.order, context={'request': request}).data)

    # ── Collection Actions ────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        today = timezone.now().date()

        total_orders = LabOrder.objects.count()
        in_progress = LabOrder.objects.filter(
            status__in=['ORDERED', 'SAMPLE_COLLECTED', 'RECEIVED_IN_LAB', 'IN_PROGRESS']
        ).count()
        completed_today = LabOrder.objects.filter(
            status='COMPLETED',
            reported_at__date=today
        ).count()
        critical_alerts = LabAlert.objects.filter(is_acknowledged=False).count()
        pending_reports = LabOrder.objects.filter(status__in=['UNDER_REVIEW', 'CRITICAL']).count()
        samples_collected = LabOrder.objects.filter(
            sample_collected_at__isnull=False
        ).count()
        low_stock_items = LabInventory.objects.filter(
            min_stock_threshold__gt=0
        ).filter(
            current_stock__lte=F('min_stock_threshold')
        ).count()

        completed_orders = LabOrder.objects.filter(
            status='COMPLETED',
            tat_deadline__isnull=False,
        )
        total_completed = completed_orders.count()
        on_time = completed_orders.filter(reported_at__lte=F('tat_deadline')).count()
        tat_compliance_pct = round((on_time / total_completed * 100), 1) if total_completed > 0 else 100.0

        status_dist = {}
        for s_code, s_label in LabOrder.STATUS_CHOICES:
            count = LabOrder.objects.filter(status=s_code).count()
            if count > 0:
                status_dist[s_label] = count

        data = {
            'total_orders': total_orders,
            'in_progress': in_progress,
            'completed_today': completed_today,
            'critical_alerts': critical_alerts,
            'pending_reports': pending_reports,
            'samples_collected': samples_collected,
            'tat_compliance_pct': tat_compliance_pct,
            'low_stock_items': low_stock_items,
            'status_distribution': status_dist,
        }
        serializer = LabDashboardStatsSerializer(data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def print_labels(self, request):
        qs = LabOrder.objects.filter(
            status='ORDERED'
        ).select_related('patient', 'test_panel')[:50]

        labels = []
        for order in qs:
            labels.append({
                'lab_id': order.lab_id,
                'barcode': order.barcode,
                'patient_name': str(order.patient),
                'test_name': order.test_panel.name,
                'sample_type': order.get_sample_type_display() if order.sample_type else '',
                'priority': order.get_priority_display(),
                'ordered_at': order.ordered_at.isoformat(),
            })

        return Response(labels)

    @action(detail=False, methods=['get'])
    def reports(self, request):
        qs = LabOrder.objects.select_related('patient', 'test_panel', 'ordered_by')

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        department = request.query_params.get('department')

        if date_from:
            qs = qs.filter(ordered_at__gte=date_from)
        if date_to:
            qs = qs.filter(ordered_at__lte=date_to)
        if department:
            qs = qs.filter(department__iexact=department)

        qs = qs.order_by('-ordered_at')
        export_format = request.query_params.get('format', 'json')
        serializer = LabOrderListSerializer(qs, many=True, context={'request': request})

        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="lab_orders_report.csv"'
            writer = csv.writer(response)
            writer.writerow([
                'Lab ID', 'Patient', 'Test', 'Status', 'Priority',
                'Ordered By', 'Ordered At', 'Completed At', 'TAT Deadline'
            ])
            for item in serializer.data:
                writer.writerow([
                    item.get('lab_id', ''),
                    item.get('patient_name', ''),
                    item.get('test_name', ''),
                    item.get('status', ''),
                    item.get('priority', ''),
                    item.get('ordered_by_name', ''),
                    item.get('ordered_at', ''),
                    item.get('reported_at', ''),
                    item.get('tat_deadline', ''),
                ])
            return response

        return Response(serializer.data)
