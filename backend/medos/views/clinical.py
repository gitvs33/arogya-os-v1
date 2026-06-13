"""Clinical views — alerts, lab results, allergies, diagnoses, orders, imaging, documents, care plans."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from django.utils import timezone

from ..models import (
    MedicalAlert, LabResult, Allergy,
    Diagnosis, ServiceOrder, ImagingResult,
    PatientDocument, CarePlan,
)
from ..serializers import (
    MedicalAlertSerializer, LabResultSerializer,
    AllergySerializer, DiagnosisSerializer,
    ServiceOrderSerializer, ImagingResultSerializer,
    PatientDocumentSerializer, CarePlanSerializer,
)
from .base import HospitalScopedViewSet, HospitalScopedReadOnlyViewSet, get_hospital_from_user


class MedicalAlertViewSet(HospitalScopedReadOnlyViewSet):
    """View and manage medical alerts."""
    queryset = MedicalAlert.objects.select_related('patient', 'encounter')
    serializer_class = MedicalAlertSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['alert_type', 'severity', 'status', 'patient']
    ordering_fields = ['-created_at']

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        alert.status = 'ACKNOWLEDGED'
        alert.acknowledged_at = timezone.now()
        alert.acknowledged_by = request.user
        alert.save()
        return Response(MedicalAlertSerializer(alert).data)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.status = 'RESOLVED'
        alert.resolved_at = timezone.now()
        alert.save()
        return Response(MedicalAlertSerializer(alert).data)


class LabResultViewSet(HospitalScopedReadOnlyViewSet):
    """Read-only view of lab results."""
    queryset = LabResult.objects.select_related('patient', 'encounter')
    serializer_class = LabResultSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['patient', 'test_name', 'status']
    ordering_fields = ['-created_at']


class AllergyViewSet(HospitalScopedViewSet):
    """Patient allergies."""
    queryset = Allergy.objects.select_related('patient')
    serializer_class = AllergySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['patient', 'severity', 'allergen']
    search_fields = ['allergen']


class DiagnosisViewSet(HospitalScopedViewSet):
    """Patient diagnoses."""
    queryset = Diagnosis.objects.select_related('patient', 'encounter')
    serializer_class = DiagnosisSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['patient', 'encounter']
    search_fields = ['condition_name', 'icd10_code']


class ServiceOrderViewSet(HospitalScopedViewSet):
    """Service orders (procedures, referrals, investigations)."""
    queryset = ServiceOrder.objects.select_related('patient', 'encounter', 'ordered_by')
    serializer_class = ServiceOrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['patient', 'encounter', 'status', 'category']
    ordering_fields = ['-ordered_at']

    def perform_create(self, serializer):
        serializer.save(ordered_by=self.request.user, hospital=self.get_hospital())

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        order = self.get_object()
        order.status = 'COMPLETED'
        order.completed_at = timezone.now()
        order.save()
        return Response(ServiceOrderSerializer(order).data)


class ImagingResultViewSet(HospitalScopedViewSet):
    """Imaging studies and reports."""
    queryset = ImagingResult.objects.select_related('patient', 'encounter')
    serializer_class = ImagingResultSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['patient', 'status', 'modality']
    ordering_fields = ['-created_at']


class PatientDocumentViewSet(HospitalScopedViewSet):
    """Patient-attached documents."""
    queryset = PatientDocument.objects.select_related('patient', 'uploaded_by')
    serializer_class = PatientDocumentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['patient', 'document_type']

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user, hospital=self.get_hospital())


class CarePlanViewSet(HospitalScopedViewSet):
    """Patient care plans."""
    queryset = CarePlan.objects.select_related('patient', 'created_by')
    serializer_class = CarePlanSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['patient', 'status']
    ordering_fields = ['-created_at']
