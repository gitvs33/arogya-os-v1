"""Patient views — CRUD and registration wizard."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from ..timeline.engine import TimelineEngine
from ..models import Patient, PatientInsurance, Encounter, Vitals, Medication, LabOrder, LabResult, ImagingResult, MedicalAlert, Diagnosis, Allergy, PatientDocument, CarePlan
from ..serializers import (
    PatientSerializer,
    PatientMinimalSerializer,
    PatientInsuranceSerializer,
    PatientRegistrationSerializer,
    EncounterSerializer,
    MedicalAlertSerializer,
    InvoiceSerializer,
)
from .base import HospitalScopedViewSet, get_hospital_from_user


class PatientViewSet(HospitalScopedViewSet):
    """CRUD for patient records."""
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['gender', 'is_active', 'city']
    search_fields = ['first_name', 'last_name', 'phone', 'hospital_patient_id', 'abha_id']
    ordering_fields = ['created_at', 'first_name', 'last_name']

    def get_serializer_class(self):
        if self.action == 'list':
            return PatientMinimalSerializer
        return PatientSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, hospital=self.get_hospital())

    # ── Registration Wizard Actions ────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        """Validate all mandatory fields and mark registration as Completed."""
        patient = self.get_object()
        missing = []
        if not patient.first_name:
            missing.append('first_name')
        if not patient.date_of_birth:
            missing.append('date_of_birth')
        if not patient.gender:
            missing.append('gender')
        if not patient.phone:
            missing.append('phone')
        if not patient.address:
            missing.append('address')
        if not patient.emergency_contact:
            missing.append('emergency_contact')

        if missing:
            return Response(
                {'error': 'Registration incomplete', 'missing_fields': missing},
                status=status.HTTP_400_BAD_REQUEST,
            )

        patient.registration_status = 'Completed'
        patient.save(update_fields=['registration_status'])
        return Response({'status': 'completed', 'patient_id': patient.id})

    @action(detail=False, methods=['post'])
    def register_with_encounter(self, request):
        """Create patient and encounter in one step.

        Accepts either:
        - ``{patient: ..., encounter: ...}`` (nested — serializer creates both)
        - ``{patient: ...}`` (patient only — no encounter created)

        The response always includes an ``encounter`` key — if one was
        created by the serializer it is returned; otherwise ``null``.
        """
        serializer = PatientRegistrationSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            result = serializer.save(created_by=request.user)
            patient = result['patient']
            encounter = result.get('encounter')

        return Response({
            'patient': PatientSerializer(patient, context={'request': request}).data,
            'encounter': {
                'id': encounter.id,
                'encounter_type': encounter.encounter_type,
                'status': encounter.status,
            } if encounter else None,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def check_exists(self, request):
        """Check if a patient already exists by phone or ABHA ID."""
        phone = request.data.get('phone')
        abha_id = request.data.get('abha_id')
        hospital = self.get_hospital()
        query = Q(hospital=hospital)
        if phone:
            query &= Q(phone=phone)
        if abha_id:
            query &= Q(abha_id=abha_id)

        if not query:
            return Response(
                {'error': 'Provide phone or abha_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = Patient.objects.filter(query).first()
        if existing:
            return Response({
                'exists': True,
                'patient': PatientMinimalSerializer(existing).data,
            })
        return Response({'exists': False})

    @action(detail=False, methods=['post'])
    def verify_aadhaar(self, request):
        """Simulate Aadhaar verification (Step 2 of registration)."""
        aadhaar = request.data.get('aadhaar', '')
        if len(aadhaar) != 12 or not aadhaar.isdigit():
            return Response(
                {'error': 'Invalid Aadhaar number'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({
            'verified': True,
            'name': 'Verified User',
            'aadhaar_last4': aadhaar[-4:],
        })

    @action(detail=True, methods=['get'])
    def encounters(self, request, pk=None):
        patient = self.get_object()
        encounters = patient.encounters.all()
        serializer = EncounterSerializer(encounters, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def alerts(self, request, pk=None):
        patient = self.get_object()
        alerts = patient.alerts.all()
        serializer = MedicalAlertSerializer(alerts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def invoices(self, request, pk=None):
        patient = self.get_object()
        invoices = patient.invoices.all()
        serializer = InvoiceSerializer(invoices, many=True)
        return Response(serializer.data)

    # ── Timeline ───────────────────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """Return an aggregated timeline of all clinical events for a patient.

        Combines encounters, vitals, medications, imaging, labs, and alerts
        into a single chronologically-sorted stream of events.
        """
        patient = self.get_object()
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))

        engine = TimelineEngine()
        result = engine.get_timeline(patient.id, page=page, page_size=page_size)

        return Response({
            'count': result.count,
            'page': result.page,
            'page_size': result.page_size,
            'results': [
                {
                    'id': e.id,
                    'type': e.type,
                    'title': e.title,
                    'description': e.description,
                    'timestamp': e.timestamp,
                    'data': e.data,
                }
                for e in result.results
            ],
        })


class PatientInsuranceViewSet(HospitalScopedViewSet):
    """CRUD for patient insurance policies (Step 4 of registration)."""
    queryset = PatientInsurance.objects.select_related('patient')
    serializer_class = PatientInsuranceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['patient', 'provider_name', 'is_primary']
