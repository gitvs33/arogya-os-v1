"""Appointment views — CRUD plus check-in, start, cancel, reschedule, doctor availability."""
from datetime import date, datetime, timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from ..models import Appointment, Encounter
from ..serializers import (
    AppointmentSerializer,
    AppointmentCreateSerializer,
    AppointmentMinimalSerializer,
)
from ..services.dashboard_service import get_live_activity
from .base import HospitalScopedViewSet, get_hospital_from_user


class AppointmentViewSet(HospitalScopedViewSet):
    """CRUD for patient appointments with lifecycle actions."""
    queryset = Appointment.objects.select_related(
        'patient', 'doctor', 'encounter'
    ).all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'appointment_type', 'department', 'doctor', 'patient']
    search_fields = [
        'patient__first_name', 'patient__last_name',
        'reason', 'notes',
    ]
    ordering_fields = ['appointment_date', 'appointment_time', '-created_at']
    ordering = ['appointment_date', 'appointment_time']

    def get_serializer_class(self):
        if self.action == 'create':
            return AppointmentCreateSerializer
        if self.action in ('list', 'upcoming'):
            return AppointmentMinimalSerializer
        return AppointmentSerializer

    def perform_create(self, serializer):
        serializer.save(
            hospital=self.get_hospital(),
            created_by=self.request.user,
        )

    # ── Lifecycle Actions ──────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        """Mark appointment as checked in."""
        appointment = self.get_object()
        appointment.check_in()
        return Response(AppointmentSerializer(appointment, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start appointment and create an encounter."""
        appointment = self.get_object()
        if appointment.encounter:
            return Response(
                {'error': 'Appointment already has an encounter'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        encounter = appointment.start()
        return Response({
            'appointment': AppointmentSerializer(appointment, context={'request': request}).data,
            'encounter': {'id': encounter.id, 'status': encounter.status},
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel this appointment."""
        appointment = self.get_object()
        reason = request.data.get('reason', '')
        appointment.cancel(reason=reason, cancelled_by=request.user)
        return Response(AppointmentSerializer(appointment, context={'request': request}).data)

    @action(detail=True, methods=['patch'])
    def reschedule(self, request, pk=None):
        """Change the appointment date/time."""
        appointment = self.get_object()
        new_date = request.data.get('appointment_date')
        new_time = request.data.get('appointment_time')
        if not new_date or not new_time:
            return Response(
                {'error': 'appointment_date and appointment_time are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        appointment.appointment_date = new_date
        appointment.appointment_time = new_time
        appointment.save(update_fields=['appointment_date', 'appointment_time'])
        return Response(AppointmentSerializer(appointment, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Return upcoming appointments for today and tomorrow."""
        hospital = get_hospital_from_user(request.user)
        today = date.today()
        tomorrow = today + timedelta(days=1)

        qs = Appointment.objects.filter(
            hospital=hospital,
            appointment_date__gte=today,
            status__in=['SCHEDULED', 'CHECKED_IN'],
        ).select_related('patient', 'doctor').order_by('appointment_date', 'appointment_time')[:20]

        serializer = AppointmentMinimalSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def doctor_availability(request, doctor_id):
    """Return available time slots for a doctor on a given date."""
    req_date_str = request.query_params.get('date', str(date.today()))
    try:
        req_date = datetime.strptime(req_date_str, '%Y-%m-%d').date()
    except ValueError:
        return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Get existing appointments for this doctor on this date
    existing_appointments = Appointment.objects.filter(
        doctor_id=doctor_id,
        appointment_date=req_date,
    ).exclude(
        status__in=['CANCELLED', 'NO_SHOW']
    ).values_list('appointment_time', flat=True)

    existing_times = set(existing_appointments)

    # Generate 30-minute slots from 9:00 to 17:00
    from datetime import time as time_class
    slots = []
    current = time_class(9, 0)
    end = time_class(17, 0)

    while current < end:
        if current not in existing_times:
            slots.append({
                'time': current.strftime('%H:%M'),
                'available': True,
            })
        # Advance 30 minutes
        minutes = current.hour * 60 + current.minute + 30
        current = time_class(minutes // 60, minutes % 60)

    return Response({
        'doctor_id': doctor_id,
        'date': req_date_str,
        'slots': slots,
    })
