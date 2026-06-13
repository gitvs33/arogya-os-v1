"""TeleICU views — ICU wards, beds, sessions, monitoring, dashboard."""
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from ..teleicu.registry import get_registry
from ..teleicu.helpers import (
    compute_dashboard_stats,
    build_monitored_patients_list,
    compute_vitals_trend,
)
from ..tasks import generate_mock_vitals
from ..models import (
    Encounter, ICUWard, ICUBed, Patient,
    TeleConsultSession, TeleICUSession,
    SystemActivityLog, MedicalAlert,
)
from ..serializers import (
    ICUWardSerializer, ICUBedSerializer,
    TeleICUSessionSerializer, TeleICUSessionCreateSerializer,
    TeleConsultSessionSerializer, SystemActivityLogSerializer,
    MedicalAlertSerializer,
    TeleICUDashboardStatsSerializer,
)
from ..subscriptions import HasFeatureAccess, require_feature
from .base import HospitalScopedViewSet, HospitalScopedReadOnlyViewSet, get_hospital_from_user


@permission_classes([IsAuthenticated])
@require_feature('teleicu')
def start_monitoring(request):
    """Start streaming vitals for a patient."""
    patient_id = request.data.get('patient_id')
    encounter_id = request.data.get('encounter_id')

    if not patient_id or not encounter_id:
        return Response(
            {'error': 'Both patient_id and encounter_id are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not Patient.objects.filter(id=patient_id).exists():
        return Response(
            {'error': 'Patient not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    encounter_qs = Encounter.objects.filter(id=encounter_id, patient_id=patient_id)
    if not encounter_qs.exists():
        return Response(
            {'error': 'Encounter not found or does not belong to this patient.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    get_registry().add(patient_id, encounter_id)
    generate_mock_vitals.delay(patient_id, encounter_id)

    return Response({
        'status': 'started',
        'patient_id': patient_id,
        'encounter_id': encounter_id,
        'message': 'Vitals monitoring started.',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_feature('teleicu')
def stop_monitoring(request):
    """Stop streaming vitals for a patient."""
    patient_id = request.data.get('patient_id')

    if not patient_id:
        return Response(
            {'error': 'patient_id is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    removed = get_registry().remove(patient_id)

    if removed is None:
        return Response(
            {'error': 'Patient is not currently being monitored.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response({
        'status': 'stopped',
        'patient_id': patient_id,
        'message': 'Vitals monitoring stopped.',
    })


# ── TeleICU ViewSets ──────────────────────────────────────────────────────────


class ICUWardViewSet(HospitalScopedViewSet):
    """CRUD for ICU wards."""
    queryset = ICUWard.objects.all()
    serializer_class = ICUWardSerializer
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'teleicu'
    filter_backends = [DjangoFilterBackend]
    search_fields = ['name']
    ordering_fields = ['name']


class ICUBedViewSet(HospitalScopedViewSet):
    """CRUD for ICU beds."""
    queryset = ICUBed.objects.select_related('ward')
    serializer_class = ICUBedSerializer
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'teleicu'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['ward', 'status']
    ordering_fields = ['ward__name', 'bed_number']


class TeleICUSessionViewSet(HospitalScopedViewSet):
    """CRUD for TeleICU sessions (active ICU stays)."""
    queryset = TeleICUSession.objects.select_related(
        'encounter__patient', 'bed__ward'
    )
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'teleicu'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active', 'acuity_status', 'support_type', 'bed']
    search_fields = [
        'encounter__patient__first_name',
        'encounter__patient__last_name',
    ]
    ordering_fields = ['-admitted_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return TeleICUSessionCreateSerializer
        return TeleICUSessionSerializer

    @action(detail=True, methods=['post'])
    def discharge(self, request, pk=None):
        """Mark a TeleICU session as discharged / inactive."""
        session = self.get_object()
        session.is_active = False
        session.discharged_at = timezone.now()
        session.save()

        if session.bed:
            session.bed.status = 'AVAILABLE'
            session.bed.save(update_fields=['status'])

        SystemActivityLog.objects.create(
            patient=session.encounter.patient,
            encounter=session.encounter,
            event_type='DISCHARGE',
            description=f"Patient discharged from {session.bed}" if session.bed else "ICU session ended",
            author_name=request.user.get_full_name() or request.user.username,
            metadata={'session_id': str(session.id)},
        )

        serializer = TeleICUSessionSerializer(session)
        return Response(serializer.data)


class TeleConsultSessionViewSet(HospitalScopedViewSet):
    """CRUD for tele-consultation sessions."""
    queryset = TeleConsultSession.objects.select_related('patient', 'doctor', 'encounter')
    serializer_class = TeleConsultSessionSerializer
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'teleicu'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'specialty', 'call_type', 'patient', 'doctor']
    ordering_fields = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())

    @action(detail=True, methods=['post'])
    def start_call(self, request, pk=None):
        """Mark consult as active and log the start."""
        consult = self.get_object()
        consult.status = 'ACTIVE'
        consult.started_at = timezone.now()
        consult.save()

        SystemActivityLog.objects.create(
            patient=consult.patient,
            encounter=consult.encounter,
            event_type='CONSULT',
            description=f"{consult.get_call_type_display()} started with {consult.doctor.get_full_name() or consult.doctor.username} ({consult.specialty})",
            author_name=request.user.get_full_name() or request.user.username,
        )

        return Response(TeleConsultSessionSerializer(consult).data)

    @action(detail=True, methods=['post'])
    def end_call(self, request, pk=None):
        """Mark consult as completed."""
        consult = self.get_object()
        consult.status = 'COMPLETED'
        consult.ended_at = timezone.now()
        consult.save()
        return Response(TeleConsultSessionSerializer(consult).data)


class SystemActivityLogViewSet(HospitalScopedReadOnlyViewSet):
    """Read-only view of system activity logs."""
    queryset = SystemActivityLog.objects.select_related('patient', 'encounter')
    serializer_class = SystemActivityLogSerializer
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'teleicu'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['patient', 'encounter', 'event_type']
    ordering_fields = ['-timestamp']


# ── TeleICU Dashboard Views ───────────────────────────────────────────────────


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('teleicu')
def teleicu_dashboard_stats(request):
    """Return top-level KPIs for the TeleICU dashboard."""
    hospital = get_hospital_from_user(request.user)
    data = compute_dashboard_stats(hospital)
    return Response(TeleICUDashboardStatsSerializer(data).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('teleicu')
def teleicu_monitored_patients(request):
    """Return the list of actively monitored patients with bed info + latest vitals.

    Queries the database directly via ``TeleICUSession`` rather than the
    in-memory/Redis cache so the list stays in sync with the dashboard stats.
    """
    hospital = get_hospital_from_user(request.user)
    active_sessions = TeleICUSession.objects.filter(
        is_active=True, hospital=hospital
    ).select_related('encounter__patient', 'bed__ward')
    monitored = {str(s.encounter.patient_id): str(s.encounter_id) for s in active_sessions}
    results = build_monitored_patients_list(monitored, hospital)
    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('teleicu')
def teleicu_vitals_trend(request, patient_id):
    """Return aggregated time-series vitals data for trend charts."""
    hospital = get_hospital_from_user(request.user)
    period = request.query_params.get('period', '1H')
    encounter_id = request.query_params.get('encounter_id')
    data = compute_vitals_trend(patient_id, hospital, period, encounter_id)
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('teleicu')
def teleicu_cameras(request):
    """Return active camera feed URLs for the video grid."""
    hospital = get_hospital_from_user(request.user)
    qs = ICUBed.objects.filter(
        hospital=hospital, status='OCCUPIED'
    ).exclude(camera_feed_url='').select_related('ward')

    ward_filter = request.query_params.get('ward')
    if ward_filter:
        qs = qs.filter(ward__name__icontains=ward_filter)

    results = [
        {
            'id': str(bed.id),
            'bed_label': str(bed),
            'ward_name': bed.ward.name,
            'camera_feed_url': bed.camera_feed_url,
            'device_ip': bed.device_ip,
        }
        for bed in qs
    ]

    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('teleicu')
def teleicu_timeline(request):
    """Return unified chronological activity log across all ICU patients."""
    hospital = get_hospital_from_user(request.user)
    patient_id = request.query_params.get('patient_id')
    limit = int(request.query_params.get('limit', 50))

    qs = SystemActivityLog.objects.filter(hospital=hospital).select_related('patient', 'encounter')
    if patient_id:
        qs = qs.filter(patient_id=patient_id)

    qs = qs.order_by('-timestamp')[:limit]
    serializer = SystemActivityLogSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('teleicu')
def teleicu_alerts(request):
    """Return critical alerts for the TeleICU dashboard."""
    hospital = get_hospital_from_user(request.user)
    status_filter = request.query_params.get('status', 'ACTIVE')
    limit = int(request.query_params.get('limit', 20))

    qs = MedicalAlert.objects.filter(
        hospital=hospital, severity__in=['CRITICAL', 'WARNING']
    ).select_related('patient', 'encounter').order_by('-created_at')

    if status_filter.upper() != 'ALL':
        qs = qs.filter(status=status_filter.upper())

    qs = qs[:limit]
    serializer = MedicalAlertSerializer(qs, many=True)
    return Response(serializer.data)
