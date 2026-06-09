from datetime import date
from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    Patient, Encounter, Vitals, Medication, SyncEntry,
    DrugInteraction, Invoice, InvoiceLineItem, MedicalAlert
)
from .serializers import (
    PatientSerializer, PatientMinimalSerializer,
    EncounterSerializer, EncounterCreateSerializer,
    VitalsSerializer, MedicationSerializer,
    SyncEntrySerializer, SyncPushSerializer,
    DrugInteractionSerializer, DDIQuerySerializer,
    InvoiceSerializer, InvoiceLineItemSerializer,
    MedicalAlertSerializer, DashboardStatsSerializer,
)


class PatientViewSet(viewsets.ModelViewSet):
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
        serializer.save(created_by=self.request.user)

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


class EncounterViewSet(viewsets.ModelViewSet):
    """CRUD for patient encounters."""
    queryset = Encounter.objects.select_related(
        'patient', 'doctor'
    ).prefetch_related('vitals', 'medications')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'encounter_type', 'department']
    search_fields = [
        'patient__first_name', 'patient__last_name',
        'chief_complaint', 'diagnosis',
    ]
    ordering_fields = ['created_at', 'scheduled_date']

    def get_serializer_class(self):
        if self.action == 'create':
            return EncounterCreateSerializer
        return EncounterSerializer

    def perform_create(self, serializer):
        serializer.save(doctor=self.request.user)

    @action(detail=True, methods=['post'])
    def add_vitals(self, request, pk=None):
        encounter = self.get_object()
        serializer = VitalsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(encounter=encounter, recorded_by=request.user)
            encounter.status = 'IN_PROGRESS'
            encounter.save(update_fields=['status'])
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_medication(self, request, pk=None):
        encounter = self.get_object()
        serializer = MedicationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(encounter=encounter, prescribed_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        encounter = self.get_object()
        encounter.status = 'COMPLETED'
        encounter.completed_at = timezone.now()
        if 'diagnosis' in request.data:
            encounter.diagnosis = request.data['diagnosis']
        if 'clinical_notes' in request.data:
            encounter.clinical_notes = request.data['clinical_notes']
        encounter.save()
        serializer = EncounterSerializer(encounter)
        return Response(serializer.data)


class SyncViewSet(viewsets.ViewSet):
    """Sync operations for offline-first CRDT replication."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Pull sync entries since a given timestamp."""
        since = request.query_params.get('since')
        model_name = request.query_params.get('model_name')
        queryset = SyncEntry.objects.all()
        if since:
            queryset = queryset.filter(updated_at__gte=since)
        if model_name:
            queryset = queryset.filter(model_name=model_name)
        queryset = queryset.order_by('-updated_at')[:100]
        serializer = SyncEntrySerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def push(self, request):
        """Push offline sync entries."""
        serializer = SyncPushSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        entries = []
        with transaction.atomic():
            for entry_data in serializer.validated_data['entries']:
                entry, created = SyncEntry.objects.update_or_create(
                    record_id=entry_data.get('record_id'),
                    defaults={
                        'model_name': entry_data['model_name'],
                        'jsonb_snapshot': entry_data['jsonb_snapshot'],
                        'version': entry_data.get('version', 1),
                        'source': 'offline',
                        'role_snapshot_hash': entry_data.get('role_snapshot_hash', ''),
                        'created_by': request.user,
                    }
                )
                entries.append(entry)

        return Response(
            SyncEntrySerializer(entries, many=True).data,
            status=status.HTTP_201_CREATED
        )


class DDIViewSet(viewsets.ReadOnlyModelViewSet):
    """Drug-Drug Interaction lookup."""
    queryset = DrugInteraction.objects.all()
    serializer_class = DrugInteractionSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['drug_a', 'drug_b']

    @action(detail=False, methods=['post'])
    def check(self, request):
        """Check interactions between a list of drugs."""
        serializer = DDIQuerySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        drugs = serializer.validated_data['drugs']
        interactions = DrugInteraction.objects.filter(
            Q(drug_a__in=drugs) & Q(drug_b__in=drugs)
        ).exclude(drug_a=F('drug_b'))
        result = DrugInteractionSerializer(interactions, many=True)
        return Response({
            'drugs': drugs,
            'interactions': result.data,
            'total_interactions': len(result.data),
        })


class InvoiceViewSet(viewsets.ModelViewSet):
    """CRUD for billing invoices."""
    queryset = Invoice.objects.select_related(
        'patient', 'encounter', 'created_by'
    ).prefetch_related('line_items')
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'invoice_type']
    search_fields = ['invoice_number', 'patient__first_name', 'patient__last_name']
    ordering_fields = ['-created_at']

    def perform_create(self, serializer):
        # Auto-generate invoice number
        today = date.today()
        count = Invoice.objects.filter(
            created_at__date=today
        ).count() + 1
        invoice_number = f"MEDOS-{today.strftime('%Y%m%d')}-{count:04d}"
        serializer.save(
            created_by=self.request.user,
            invoice_number=invoice_number
        )

    @action(detail=True, methods=['post'])
    def add_line_item(self, request, pk=None):
        invoice = self.get_object()
        serializer = InvoiceLineItemSerializer(data=request.data)
        if serializer.is_valid():
            line_item = serializer.save(invoice=invoice)
            # Recalculate invoice totals
            self._recalculate_totals(invoice)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def issue(self, request, pk=None):
        invoice = self.get_object()
        invoice.status = 'ISSUED'
        invoice.issued_at = timezone.now()
        invoice.save()
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        invoice.status = 'PAID'
        invoice.paid_at = timezone.now()
        invoice.save()
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=False, methods=['get'])
    def day_end_report(self, request):
        """Generate day-end revenue report."""
        today = date.today()
        invoices = Invoice.objects.filter(
            created_at__date=today
        ).exclude(status='CANCELLED')

        report = {
            'date': today.isoformat(),
            'total_invoices': invoices.count(),
            'total_revenue': str(sum(inv.total for inv in invoices)),
            'by_type': invoices.values('invoice_type').annotate(
                count=Count('id'),
                total=models.Sum('total')
            ),
            'by_doctor': invoices.filter(
                encounter__doctor__isnull=False
            ).values(
                'encounter__doctor__username'
            ).annotate(
                count=Count('id'),
                total=models.Sum('total')
            ),
        }
        return Response(report)

    def _recalculate_totals(self, invoice):
        """Recalculate invoice subtotal, tax, and total."""
        line_items = invoice.line_items.all()
        subtotal = sum(item.total_price for item in line_items)
        tax = subtotal * (invoice.tax_percent / 100)
        total = subtotal + tax
        Invoice.objects.filter(id=invoice.id).update(
            subtotal=subtotal,
            tax=tax,
            total=total,
        )


class MedicalAlertViewSet(viewsets.ReadOnlyModelViewSet):
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


class DashboardView(generics.GenericAPIView):
    """Dashboard statistics."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        data = {
            'total_patients': Patient.objects.count(),
            'today_encounters': Encounter.objects.filter(
                created_at__date=today
            ).count(),
            'active_alerts': MedicalAlert.objects.filter(
                status='ACTIVE'
            ).count(),
            'pending_invoices': Invoice.objects.filter(
                status='DRAFT'
            ).count(),
        }
        return Response(DashboardStatsSerializer(data).data)
