"""Ward/IPD views — wards, beds, daily rounds, nursing, discharge, transfer."""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from ..permissions import HasWardAccess, HasNurseAccess, HasBillingAccess

from ..models import (
    Ward, Bed, DailyRound, NursingNote, MedicationAdministration,
    BillingAccrual, Encounter, Vitals, Medication,
)
from ..serializers.ward import (
    WardSerializer, WardMinimalSerializer,
    BedSerializer, BedCreateSerializer,
    WardBedMapSerializer,
    DailyRoundSerializer, DailyRoundCreateSerializer,
    NursingNoteSerializer,
    MedicationAdministrationSerializer,
    MedicationAdministrationCreateSerializer,
    BillingAccrualSerializer,
    DischargeReadinessSerializer, DischargeDataSerializer,
    NursingStationSerializer,
)
from ..serializers import (
    VitalsSerializer, MedicationSerializer,
)
from ..services import ward as ward_services
from .base import HospitalScopedViewSet, get_hospital_from_user


# ═══════════════════════════════════════════════════════════════════════════════
#  WARD VIEWSET
# ═══════════════════════════════════════════════════════════════════════════════


class WardViewSet(HospitalScopedViewSet):
    """CRUD for hospital wards."""
    queryset = Ward.objects.all()
    permission_classes = [IsAuthenticated, HasWardAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['ward_type', 'is_active', 'floor']
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return WardMinimalSerializer
        return WardSerializer

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())

    @action(detail=True, methods=['get'])
    def bed_map(self, request, pk=None):
        """Get the bed map for a specific ward."""
        hospital = self.get_hospital()
        ward = self.get_object()
        bed_map = ward_services.get_bed_map(hospital, ward_id=ward.id)
        if bed_map:
            return Response(WardBedMapSerializer(bed_map[0]).data)
        return Response({'detail': 'Ward not found.'}, status=status.HTTP_404_NOT_FOUND)


# ═══════════════════════════════════════════════════════════════════════════════
#  BED VIEWSET
# ═══════════════════════════════════════════════════════════════════════════════


class BedViewSet(HospitalScopedViewSet):
    """CRUD for beds within wards."""
    queryset = Bed.objects.select_related(
        'ward', 'current_encounter__patient',
    ).all()
    permission_classes = [IsAuthenticated, HasWardAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['ward', 'status', 'ward__ward_type']
    search_fields = ['bed_number']

    def get_serializer_class(self):
        if self.action == 'create':
            return BedCreateSerializer
        return BedSerializer

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assign a patient (encounter) to this bed."""
        encounter_id = request.data.get('encounter_id')
        if not encounter_id:
            return Response(
                {'detail': 'encounter_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        hospital = self.get_hospital()
        try:
            bed = ward_services.assign_bed(encounter_id, pk, hospital)
            return Response(BedSerializer(bed).data, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        """Release this bed (used during discharge/transfer)."""
        hospital = self.get_hospital()
        try:
            bed, encounter = ward_services.release_bed(pk, hospital)
            return Response({'detail': f'Bed {bed.bed_number} released.'})
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ═══════════════════════════════════════════════════════════════════════════════
#  DAILY ROUND VIEWSET
# ═══════════════════════════════════════════════════════════════════════════════


class DailyRoundViewSet(HospitalScopedViewSet):
    """Manage daily rounds for admitted patients."""
    queryset = DailyRound.objects.select_related(
        'encounter__patient', 'conducted_by', 'prescription',
    ).all()
    permission_classes = [IsAuthenticated, HasWardAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'round_date', 'encounter']
    ordering = ['-round_date', '-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return DailyRoundCreateSerializer
        return DailyRoundSerializer

    def perform_create(self, serializer):
        round_obj, created = ward_services.get_or_create_daily_round(
            encounter_id=serializer.validated_data['encounter'].id,
            hospital=self.get_hospital(),
            conducted_by=self.request.user,
        )
        # Add notes if provided
        if serializer.validated_data.get('notes'):
            round_obj.notes = serializer.validated_data['notes']
            round_obj.save(update_fields=['notes'])
        return Response(DailyRoundSerializer(round_obj).data)

    @action(detail=True, methods=['post'])
    def finalise(self, request, pk=None):
        """Submit a daily round — creates prescription, updates queues."""
        hospital = self.get_hospital()
        try:
            round_obj = ward_services.finalise_round(
                round_id=pk,
                hospital=hospital,
                prescription_data=request.data.get('prescription'),
                notes=request.data.get('notes'),
            )
            return Response(DailyRoundSerializer(round_obj).data)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ═══════════════════════════════════════════════════════════════════════════════
#  BED MAP — Global
# ═══════════════════════════════════════════════════════════════════════════════


class BedMapViewSet(viewsets.ViewSet):
    """Read-only view of the entire hospital bed map."""
    permission_classes = [IsAuthenticated, HasWardAccess]

    def list(self, request):
        """Get the bed map for all wards."""
        hospital = get_hospital_from_user(request.user)
        ward_id = request.query_params.get('ward_id')
        bed_map = ward_services.get_bed_map(hospital, ward_id=ward_id)
        return Response(WardBedMapSerializer(bed_map, many=True).data)


# ═══════════════════════════════════════════════════════════════════════════════
#  DISCHARGE
# ═══════════════════════════════════════════════════════════════════════════════


class DischargeViewSet(viewsets.ViewSet):
    """Discharge workflow — readiness check and execution."""
    permission_classes = [IsAuthenticated, HasWardAccess]

    @action(detail=False, methods=['get'])
    def readiness(self, request):
        """Check if a patient can be discharged."""
        encounter_id = request.query_params.get('encounter_id')
        if not encounter_id:
            return Response(
                {'detail': 'encounter_id query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        hospital = get_hospital_from_user(request.user)
        readiness = ward_services.get_discharge_readiness(encounter_id, hospital)
        return Response(DischargeReadinessSerializer(readiness).data)

    @action(detail=False, methods=['post'])
    def execute(self, request):
        """Execute discharge for a patient."""
        encounter_id = request.data.get('encounter_id')
        if not encounter_id:
            return Response(
                {'detail': 'encounter_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        hospital = get_hospital_from_user(request.user)
        discharge_serializer = DischargeDataSerializer(data=request.data)
        if not discharge_serializer.is_valid():
            return Response(discharge_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            encounter = ward_services.discharge_patient(
                encounter_id=encounter_id,
                hospital=hospital,
                discharged_by=request.user,
                discharge_data=discharge_serializer.validated_data,
            )
            from ..serializers import EncounterSerializer
            return Response(EncounterSerializer(encounter).data)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ═══════════════════════════════════════════════════════════════════════════════
#  TRANSFER
# ═══════════════════════════════════════════════════════════════════════════════


class TransferViewSet(viewsets.ViewSet):
    """Transfer a patient between wards/beds."""
    permission_classes = [IsAuthenticated, HasWardAccess]

    @action(detail=False, methods=['post'])
    def patient(self, request):
        """Transfer a patient from current bed to destination bed."""
        encounter_id = request.data.get('encounter_id')
        destination_bed_id = request.data.get('destination_bed_id')
        reason = request.data.get('reason', '')

        if not encounter_id or not destination_bed_id:
            return Response(
                {'detail': 'encounter_id and destination_bed_id are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        hospital = get_hospital_from_user(request.user)
        try:
            bed = ward_services.transfer_patient(
                encounter_id=encounter_id,
                destination_bed_id=destination_bed_id,
                hospital=hospital,
                requested_by=request.user,
                reason=reason,
            )
            return Response(BedSerializer(bed).data)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ═══════════════════════════════════════════════════════════════════════════════
#  NURSING STATION
# ═══════════════════════════════════════════════════════════════════════════════


class NursingStationViewSet(viewsets.ViewSet):
    """Nursing station view — tasks, vitals due, alerts."""
    permission_classes = [IsAuthenticated, HasNurseAccess]

    def list(self, request):
        """Get the nursing station overview for the hospital/ward."""
        hospital = get_hospital_from_user(request.user)
        ward_id = request.query_params.get('ward_id')
        data = ward_services.get_nursing_station(hospital, ward_id=ward_id)
        return Response(NursingStationSerializer(data).data)

    @action(detail=False, methods=['post'])
    def record_vitals(self, request):
        """Record vitals from the nursing station."""
        encounter_id = request.data.get('encounter_id')
        if not encounter_id:
            return Response(
                {'detail': 'encounter_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        hospital = get_hospital_from_user(request.user)
        try:
            encounter = Encounter.objects.get(id=encounter_id, hospital=hospital)
        except Encounter.DoesNotExist:
            return Response({'detail': 'Encounter not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = VitalsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(encounter=encounter, recorded_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ═══════════════════════════════════════════════════════════════════════════════
#  NURSING NOTES
# ═══════════════════════════════════════════════════════════════════════════════


class NursingNoteViewSet(HospitalScopedViewSet):
    """CRUD for nursing notes on admitted patients."""
    queryset = NursingNote.objects.select_related(
        'encounter__patient', 'recorded_by',
    ).all()
    permission_classes = [IsAuthenticated, HasNurseAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['encounter']
    ordering = ['-created_at']
    serializer_class = NursingNoteSerializer

    def perform_create(self, serializer):
        encounter_id = serializer.validated_data['encounter'].id
        hospital = self.get_hospital()
        note = ward_services.create_nursing_note(
            encounter_id=encounter_id,
            hospital=hospital,
            recorded_by=self.request.user,
            note_text=serializer.validated_data['note'],
        )
        return Response(NursingNoteSerializer(note).data)


# ═══════════════════════════════════════════════════════════════════════════════
#  MEDICATION ADMINISTRATION (Nurse gives meds)
# ═══════════════════════════════════════════════════════════════════════════════


class MedicationAdministrationViewSet(HospitalScopedViewSet):
    """Record medications administered by nurses."""
    queryset = MedicationAdministration.objects.select_related(
        'encounter__patient', 'medication', 'administered_by',
    ).all()
    permission_classes = [IsAuthenticated, HasNurseAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['encounter', 'medication']
    ordering = ['-administered_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return MedicationAdministrationCreateSerializer
        return MedicationAdministrationSerializer

    def perform_create(self, serializer):
        encounter_id = serializer.validated_data['encounter'].id
        medication_id = serializer.validated_data['medication'].id
        hospital = self.get_hospital()
        try:
            admin_record = ward_services.administer_medication(
                encounter_id=encounter_id,
                medication_id=medication_id,
                hospital=hospital,
                administered_by=self.request.user,
                data=serializer.validated_data,
            )
            return Response(
                MedicationAdministrationSerializer(admin_record).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ═══════════════════════════════════════════════════════════════════════════════
#  BILLING ACCRUAL
# ═══════════════════════════════════════════════════════════════════════════════


class BillingAccrualViewSet(HospitalScopedViewSet):
    """View billing accruals for an encounter."""
    queryset = BillingAccrual.objects.all()
    permission_classes = [IsAuthenticated, HasBillingAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['encounter', 'accrual_type', 'is_invoiced', 'date']
    ordering = ['-date']
    serializer_class = BillingAccrualSerializer
