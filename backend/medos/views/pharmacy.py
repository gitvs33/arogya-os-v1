"""Pharmacy views — drug catalogue, inventory management, dispensing."""
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from ..permissions import HasPharmacyAccess, HasWardAccess
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from django.db.models import F

from ..models import Drug, DrugInventory, Dispensation, Prescription, Medication
from ..serializers import (
    DrugSerializer,
    DrugMinimalSerializer,
    DrugInventorySerializer,
    DispensationSerializer,
    DispensationCreateSerializer,
)
from ..pharmacy import services as pharmacy_services
from .base import HospitalScopedViewSet, get_hospital_from_user


class DrugViewSet(HospitalScopedViewSet):
    """CRUD for the drug master catalogue."""
    queryset = Drug.objects.all()
    serializer_class = DrugSerializer
    permission_classes = [IsAuthenticated, HasPharmacyAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'dosage_form', 'is_controlled']
    search_fields = ['name', 'generic_name', 'brand_names']

    def get_serializer_class(self):
        if self.action == 'list':
            return DrugMinimalSerializer
        return DrugSerializer

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())


class DrugInventoryViewSet(HospitalScopedViewSet):
    """CRUD for pharmacy drug stock."""
    queryset = DrugInventory.objects.select_related('drug').all()
    serializer_class = DrugInventorySerializer
    permission_classes = [IsAuthenticated, HasPharmacyAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['drug', 'is_active']
    search_fields = ['drug__name', 'batch_number']

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Return items where stock is at or below reorder level."""
        qs = DrugInventory.objects.filter(
            hospital=self.get_hospital(),
            quantity__lte=F('reorder_level'),
            is_active=True,
        ).select_related('drug')
        serializer = DrugInventorySerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """Return items expiring within 30 days."""
        from datetime import date, timedelta
        threshold = date.today() + timedelta(days=30)
        qs = DrugInventory.objects.filter(
            hospital=self.get_hospital(),
            expiry_date__lte=threshold,
            is_active=True,
        ).select_related('drug')
        serializer = DrugInventorySerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)


class DispensationViewSet(HospitalScopedViewSet):
    """Record medications dispensed to patients."""
    queryset = Dispensation.objects.select_related(
        'patient', 'medication', 'inventory_item__drug'
    ).all()
    permission_classes = [IsAuthenticated, HasPharmacyAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'patient', 'encounter']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return DispensationCreateSerializer
        return DispensationSerializer

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())

    @action(detail=True, methods=['post'])
    def dispense(self, request, pk=None):
        """Mark a dispensation record as dispensed (decrement inventory)."""
        dispensation = self.get_object()
        if dispensation.status == 'DISPENSED':
            return Response(
                {'error': 'Already dispensed'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            dispensation.dispense(request.user)
        return Response(
            DispensationSerializer(dispensation, context={'request': request}).data
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a pending dispensation."""
        dispensation = self.get_object()
        if dispensation.status == 'DISPENSED':
            return Response(
                {'error': 'Cannot cancel a completed dispensation. Create a return instead.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dispensation.status = 'CANCELLED'
        dispensation.save(update_fields=['status'])
        return Response(
            DispensationSerializer(dispensation, context={'request': request}).data
        )


# ── Pharmacy Queue (Prescription-based) ────────────────────────────────

class PharmacyQueueViewSet(viewsets.ViewSet):
    """Prescription-based pharmacy queue — grouped, prioritised."""
    permission_classes = [IsAuthenticated, HasPharmacyAccess]

    def list(self, request):
        """Get the pharmacy queue grouped by encounter type."""
        hospital = get_hospital_from_user(request.user)
        queue = pharmacy_services.get_pharmacy_queue(hospital)
        return Response(queue)

    @action(detail=False, methods=['post'])
    def mark_in_progress(self, request):
        """Mark a prescription as being worked on."""
        rx_id = request.data.get('prescription_id')
        if not rx_id:
            return Response({'detail': 'prescription_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        hospital = get_hospital_from_user(request.user)
        try:
            rx = pharmacy_services.mark_prescription_in_progress(rx_id, hospital)
            return Response({'detail': f'Prescription {rx.pk.hex[:8]} is now in progress.'})
        except Prescription.DoesNotExist:
            return Response({'detail': 'Prescription not found or not in ORDERED state.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def dispense_medication(self, request):
        """Dispense a single medication."""
        med_id = request.data.get('medication_id')
        if not med_id:
            return Response({'detail': 'medication_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        hospital = get_hospital_from_user(request.user)
        try:
            disp = pharmacy_services.dispense_medication(med_id, hospital, request.user)
            return Response(DispensationSerializer(disp, context={'request': request}).data)
        except (Medication.DoesNotExist, ValueError) as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def dispense_prescription(self, request):
        """Dispense all active medications in a prescription."""
        rx_id = request.data.get('prescription_id')
        if not rx_id:
            return Response({'detail': 'prescription_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        hospital = get_hospital_from_user(request.user)
        try:
            disp_records = pharmacy_services.dispense_prescription(rx_id, hospital, request.user)
            return Response({
                'detail': f'Dispensed {len(disp_records)} medications.',
                'dispensations': DispensationSerializer(disp_records, many=True, context={'request': request}).data,
            })
        except (Prescription.DoesNotExist, ValueError) as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


