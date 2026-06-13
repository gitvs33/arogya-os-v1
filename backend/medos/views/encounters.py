"""Encounter views — CRUD, orders, daily copy, billing accrual, invoice generation."""
from datetime import date, timedelta
from decimal import Decimal

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from ..permissions import HasEncountersAccess
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Sum, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from ..models import (
    Encounter, Vitals, Medication, Prescription,
    LabOrder, Dispensation,
    DrugInventory, TestPanel, Invoice, InvoiceLineItem,
)
from ..serializers import (
    EncounterSerializer, EncounterCreateSerializer,
    VitalsSerializer, MedicationSerializer,
    PrescriptionSerializer,
)
from ..serializers.lab import LabOrderCreateSerializer, LabOrderListSerializer
from ..serializers.pharmacy import DispensationSerializer
from ..serializers.billing import InvoiceSerializer, InvoiceLineItemSerializer
from .base import HospitalScopedViewSet, get_hospital_from_user


class EncounterViewSet(HospitalScopedViewSet):
    """CRUD for patient encounters + clinical order management."""
    queryset = Encounter.objects.select_related(
        'patient', 'doctor'
    ).prefetch_related('vitals', 'medications')
    permission_classes = [IsAuthenticated, HasEncountersAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'encounter_type', 'department',
                        'location', 'clinical_acuity', 'bed_number',
                        'doctor']
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
        serializer.save(doctor=self.request.user, hospital=self.get_hospital())

    # ── Filter Options ──────────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def filter_options(self, request):
        """Return allowed filter values for the frontend dropdowns."""
        hospital = self.get_hospital()
        qs = self.filter_queryset(self.get_queryset())

        # Departments — distinct values from encounters in this hospital
        departments = (
            qs.filter(department__isnull=False)
            .exclude(department='')
            .values_list('department', flat=True)
            .distinct()
            .order_by('department')
        )

        # Doctors — users who have encounters or are staff with doctor profile
        from ..models import HospitalUserProfile, Role
        doctor_role = Role.objects.filter(
            name__iexact='Doctor', hospital=hospital
        ).first()
        doctor_ids = set()
        if doctor_role:
            profile_ids = HospitalUserProfile.objects.filter(
                role=doctor_role
            ).values_list('user_id', flat=True)
            doctor_ids.update(profile_ids)
        # Also include any user referenced as doctor on encounters
        encounter_doctor_ids = (
            qs.exclude(doctor__isnull=True)
            .values_list('doctor_id', flat=True)
            .distinct()
        )
        doctor_ids.update(encounter_doctor_ids)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        doctors = User.objects.filter(id__in=doctor_ids).values(
            'id', 'first_name', 'last_name', 'email'
        )

        return Response({
            'encounter_types': [
                {'value': k, 'label': v}
                for k, v in Encounter._meta.get_field('encounter_type').choices
            ],
            'statuses': [
                {'value': k, 'label': v}
                for k, v in Encounter._meta.get_field('status').choices
            ],
            'clinical_acuties': [
                {'value': k, 'label': v}
                for k, v in Encounter._meta.get_field('clinical_acuity').choices
            ],
            'departments': sorted(departments),
            'doctors': [
                {
                    'id': str(d['id']),
                    'name': f"{d['first_name'] or ''} {d['last_name'] or ''}".strip() or d['email'],
                }
                for d in doctors
            ],
        })

    # ── Clinical Actions ────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def add_vitals(self, request, pk=None):
        """Record vitals and set encounter to IN_PROGRESS."""
        encounter = self.get_object()
        serializer = VitalsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(encounter=encounter, recorded_by=request.user)
            if encounter.status == 'PLANNED':
                encounter.status = 'IN_PROGRESS'
                encounter.save(update_fields=['status'])
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # ── Prescription Management ─────────────────────────────────────────

    def _get_or_create_draft_prescription(self, encounter, user):
        """Get the current DRAFT Prescription for this encounter, or create one."""
        draft = Prescription.objects.filter(
            encounter=encounter, status='DRAFT',
            ordered_by=user,
        ).first()
        if draft:
            return draft
        latest = Prescription.objects.filter(
            encounter=encounter,
        ).order_by('-version').first()
        next_version = (latest.version + 1) if latest else 1
        return Prescription.objects.create(
            encounter=encounter,
            version=next_version,
            ordered_by=user,
            hospital=encounter.hospital,
        )

    @action(detail=True, methods=['post'])
    def add_medication(self, request, pk=None):
        """Add a medication — auto-groups into a DRAFT Prescription."""
        encounter = self.get_object()
        serializer = MedicationSerializer(data=request.data)
        if serializer.is_valid():
            with transaction.atomic():
                rx = self._get_or_create_draft_prescription(encounter, request.user)
                med = serializer.save(
                    encounter=encounter,
                    prescription=rx,
                    prescribed_by=request.user,
                    hospital=encounter.hospital,
                )
                Dispensation.objects.create(
                    medication=med,
                    encounter=encounter,
                    patient=encounter.patient,
                    hospital=encounter.hospital,
                    drug_name=med.drug_name,
                    dosage=med.dosage,
                    quantity_dispensed=med.quantity,
                    status='PENDING',
                )
            return Response(MedicationSerializer(med).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_lab_order(self, request, pk=None):
        """Order a lab test — auto-groups into a DRAFT Prescription."""
        encounter = self.get_object()
        data = dict(request.data)
        data['patient'] = str(encounter.patient.id)
        data['encounter'] = str(encounter.id)
        serializer = LabOrderCreateSerializer(
            data=data,
            context={'request': request},
        )
        if serializer.is_valid():
            with transaction.atomic():
                rx = self._get_or_create_draft_prescription(encounter, request.user)
                order = serializer.save(
                    patient=encounter.patient,
                    encounter=encounter,
                    prescription=rx,
                    hospital=encounter.hospital,
                    status='ORDERED',
                )
            return Response(LabOrderListSerializer(order).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # ── Prescription Workflow (Submit / Amend / Cancel) ─────────────────

    @action(detail=True, methods=['get'])
    def prescriptions(self, request, pk=None):
        """List all Prescriptions for this encounter (latest first)."""
        encounter = self.get_object()
        rx_list = Prescription.objects.filter(
            encounter=encounter
        ).prefetch_related(
            'medications', 'lab_orders'
        ).order_by('-version')
        return Response(
            PrescriptionSerializer(rx_list, many=True, context={'request': request}).data
        )

    @action(detail=True, methods=['post'])
    def submit_prescription(self, request, pk=None):
        """Submit a DRAFT Prescription → ORDERED (visible to pharmacy/lab)."""
        encounter = self.get_object()
        rx_id = request.data.get('prescription_id')
        if not rx_id:
            return Response({'detail': 'prescription_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        rx = get_object_or_404(Prescription, id=rx_id, encounter=encounter, status='DRAFT')
        rx.submit()
        return Response({'detail': f'Prescription {rx.pk.hex[:8]} submitted to pharmacy/lab.'})

    @action(detail=True, methods=['post'])
    def cancel_prescription(self, request, pk=None):
        """Cancel an entire prescription with a reason."""
        encounter = self.get_object()
        rx_id = request.data.get('prescription_id')
        reason = request.data.get('reason', '')
        if not rx_id:
            return Response({'detail': 'prescription_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not reason:
            return Response({'detail': 'Cancellation reason is required.'}, status=status.HTTP_400_BAD_REQUEST)
        rx = get_object_or_404(Prescription, id=rx_id, encounter=encounter)
        rx.cancel(reason)
        return Response({'detail': f'Prescription {rx.pk.hex[:8]} cancelled: {reason}'})

    @action(detail=True, methods=['post'])
    def cancel_medication(self, request, pk=None):
        """Cancel a single medication within a prescription."""
        encounter = self.get_object()
        med_id = request.data.get('medication_id')
        reason = request.data.get('reason', '')
        if not med_id:
            return Response({'detail': 'medication_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not reason:
            return Response({'detail': 'Cancellation reason is required.'}, status=status.HTTP_400_BAD_REQUEST)
        med = get_object_or_404(Medication, id=med_id, encounter=encounter)
        med.is_active = False
        med.cancellation_reason = reason
        med.save(update_fields=['is_active', 'cancellation_reason'])
        Dispensation.objects.filter(medication=med, status='PENDING').update(status='CANCELLED')
        return Response({'detail': f'Medication {med.drug_name} cancelled: {reason}'})

    @action(detail=True, methods=['post'])
    def amend_prescription(self, request, pk=None):
        """Amend a submitted Prescription — creates a new version (v2+).

        The old Prescription gets status=AMENDED, superseded_by=new version.
        Pharmacy sees the old one as "replaced" and new one as active.
        """
        encounter = self.get_object()
        rx_id = request.data.get('prescription_id')
        if not rx_id:
            return Response({'detail': 'prescription_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        rx = get_object_or_404(Prescription, id=rx_id, encounter=encounter)

        if rx.status in ('DRAFT', 'CANCELLED', 'DISPENSED'):
            return Response(
                {'detail': f'Cannot amend Prescription in {rx.status} state'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            new_version = Prescription.objects.create(
                encounter=encounter,
                status='DRAFT',
                version=rx.version + 1,
                ordered_by=request.user,
                hospital=encounter.hospital,
                pharmacy_notes=rx.pharmacy_notes,
            )
            rx.status = 'AMENDED'
            rx.superseded_by = new_version
            rx.save(update_fields=['status', 'superseded_by'])

            # Copy active medications
            for med in Medication.objects.filter(prescription=rx, is_active=True):
                Medication.objects.create(
                    encounter=encounter,
                    prescription=new_version,
                    drug_name=med.drug_name,
                    generic_name=med.generic_name,
                    brand_name=med.brand_name,
                    dosage=med.dosage,
                    frequency=med.frequency,
                    duration=med.duration,
                    route=med.route,
                    quantity=med.quantity,
                    unit_price=med.unit_price,
                    instructions=med.instructions,
                    is_active=True,
                    prescribed_by=request.user,
                    hospital=encounter.hospital,
                )

            # Copy lab orders
            for order in LabOrder.objects.filter(prescription=rx):
                LabOrder.objects.create(
                    patient=encounter.patient,
                    encounter=encounter,
                    prescription=new_version,
                    test_panel=order.test_panel,
                    priority=order.priority,
                    status='ORDERED',
                    ordered_by=request.user,
                    hospital=encounter.hospital,
                )

        # Notify pharmacy and lab queues
        hospital_id = str(encounter.hospital_id) if encounter.hospital_id else None
        if hospital_id:
            notify_pharmacy_queue(hospital_id, {
                'action': 'amended',
                'prescription_id': str(rx.id),
                'new_version_id': str(new_version.id),
                'status': rx.status,
                'version': rx.version,
            })
            notify_lab_queue(hospital_id, {
                'action': 'amended',
                'prescription_id': str(rx.id),
                'new_version_id': str(new_version.id),
                'status': rx.status,
            })

        return Response(
            PrescriptionSerializer(new_version, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ── Daily Copy ──────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def copy_previous_orders(self, request, pk=None):
        """Copy Medications + LabOrders from the most recent previous day.

        The "hybrid" daily-rounds workflow: doctor copies yesterday's orders,
        tweaks what's different, and submits.
        """
        encounter = self.get_object()
        hospital = encounter.hospital
        today = timezone.now().date()

        # Find the most recent distinct date (before today) that has orders
        last_med_date = (
            Medication.objects.filter(encounter=encounter)
            .dates('prescribed_at', 'day')
        )
        last_lab_date = (
            LabOrder.objects.filter(encounter=encounter)
            .dates('created_at', 'day')
        )

        all_dates = sorted(set(
            d for d in list(last_med_date) + list(last_lab_date)
            if d < today
        ), reverse=True)

        if not all_dates:
            return Response(
                {'detail': 'No previous orders to copy.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        source_date = all_dates[0]

        # We'll return the newly created records
        new_medications = []
        new_lab_orders = []

        with transaction.atomic():
            rx = self._get_or_create_draft_prescription(encounter, request.user)
            # Copy medications from source_date
            prev_meds = Medication.objects.filter(
                encounter=encounter,
                prescribed_at__date=source_date,
            )
            for pm in prev_meds:
                new_med = Medication.objects.create(
                    encounter=encounter,
                    prescription=rx,
                    drug_name=pm.drug_name,
                    generic_name=pm.generic_name,
                    brand_name=pm.brand_name,
                    dosage=pm.dosage,
                    frequency=pm.frequency,
                    duration=pm.duration,
                    route=pm.route,
                    quantity=pm.quantity,
                    unit_price=pm.unit_price,
                    instructions=pm.instructions,
                    is_active=True,
                    prescribed_by=request.user,
                    hospital=hospital,
                )
                new_medications.append(new_med)
                Dispensation.objects.create(
                    medication=new_med,
                    encounter=encounter,
                    patient=encounter.patient,
                    hospital=hospital,
                    drug_name=new_med.drug_name,
                    dosage=new_med.dosage,
                    quantity_dispensed=new_med.quantity,
                    status='PENDING',
                )

            # Copy lab orders from source_date
            prev_orders = LabOrder.objects.filter(
                encounter=encounter,
                created_at__date=source_date,
            )
            for po in prev_orders:
                new_order = LabOrder.objects.create(
                    patient=encounter.patient,
                    encounter=encounter,
                    prescription=rx,
                    test_panel=po.test_panel,
                    priority=po.priority,
                    status='ORDERED',
                    ordered_by=request.user,
                    hospital=hospital,
                )
                new_lab_orders.append(new_order)

        return Response({
            'source_date': str(source_date),
            'medications': MedicationSerializer(new_medications, many=True).data,
            'lab_orders': LabOrderListSerializer(new_lab_orders, many=True).data,
        })

    # ── AI Scribe Auto-Extract ──────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def extract_orders(self, request, pk=None):
        """Parse the latest AI Scribe clinical note and extract medications + lab orders.

        Request body:
            confirm (bool): If true, actually create Medication/LabOrder records.
                             If false (default), return what was found for review.

        Returns:
            medications: list of extracted medication dicts
            lab_orders: list of extracted lab test dicts
            note_text: the source note that was parsed
        """
        encounter = self.get_object()
        confirm = request.data.get('confirm', False)

        # Get the latest confirmed clinical note
        from ..models import ClinicalNote
        note = ClinicalNote.objects.filter(
            encounter=encounter, status='CONFIRMED'
        ).order_by('-created_at').first()

        if not note:
            note = ClinicalNote.objects.filter(
                encounter=encounter
            ).order_by('-created_at').first()

        if not note:
            return Response(
                {'detail': 'No clinical notes found for this encounter. Use AI Scribe first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        note_text = note.note_text or note.transcript or ''
        if not note_text.strip():
            return Response(
                {'detail': 'Clinical note is empty.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from ..extraction import extract_medications, extract_lab_tests, create_medications, create_lab_orders

        # Run extraction
        meds = extract_medications(note_text, encounter, encounter.hospital)
        labs = extract_lab_tests(note_text, encounter, encounter.hospital)

        if confirm:
            # Auto-group into a DRAFT Prescription
            rx = self._get_or_create_draft_prescription(encounter, request.user)
            created_meds = create_medications(
                meds, encounter, encounter.hospital,
                created_by=request.user,
            )
            # Link created meds to the prescription
            for m in created_meds:
                m.prescription = rx
                m.save(update_fields=['prescription'])
            created_labs = create_lab_orders(
                labs, encounter, encounter.hospital,
                ordered_by=request.user,
            )
            # Link created labs to the prescription
            for l in created_labs:
                l.prescription = rx
                l.save(update_fields=['prescription'])
            return Response({
                'extracted': True,
                'medications': meds,
                'lab_orders': labs,
                'created_medication_count': len(created_meds),
                'created_lab_order_count': len(created_labs),
                'created_medication_ids': [str(m.id) for m in created_meds],
                'created_lab_order_ids': [str(l.id) for l in created_labs],
            })

        return Response({
            'extracted': False,
            'medications': meds,
            'lab_orders': labs,
            'note_text': note_text[:2000],
        })

    # ── Billing Accrual ─────────────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def accrued_items(self, request, pk=None):
        """All billable items grouped by day with running total.

        Used by the billing queue to show what's accrued for admitted patients.
        """
        encounter = self.get_object()
        hospital = encounter.hospital

        # Medications with prices
        meds = Medication.objects.filter(encounter=encounter, is_active=True)
        med_total = sum(
            (m.unit_price or 0) * (m.quantity or 1)
            for m in meds
        )

        # Lab orders with prices from TestPanel
        lab_orders = LabOrder.objects.filter(encounter=encounter).select_related('test_panel')
        lab_total = Decimal('0')
        for lo in lab_orders:
            price = Decimal('0')
            if lo.test_panel and lo.test_panel.price:
                price = lo.test_panel.price
            lab_total += price

        # Group by day
        meds_by_day = {}
        for m in meds:
            day = m.prescribed_at.date().isoformat()
            meds_by_day.setdefault(day, []).append({
                'type': 'medication',
                'drug_name': m.drug_name,
                'dosage': m.dosage,
                'quantity': float(m.quantity or 1),
                'unit_price': float(m.unit_price or 0),
                'total': float((m.unit_price or 0) * (m.quantity or 1)),
            })

        labs_by_day = {}
        for lo in lab_orders:
            day = lo.created_at.date().isoformat()
            price = float(lo.test_panel.price) if lo.test_panel and lo.test_panel.price else 0
            labs_by_day.setdefault(day, []).append({
                'type': 'lab',
                'test_name': lo.test_panel.short_name or lo.test_panel.name if lo.test_panel else 'Unknown',
                'price': price,
            })

        all_days = sorted(set(list(meds_by_day.keys()) + list(labs_by_day.keys())))
        items_by_day = []
        running_total = Decimal('0')
        for day in all_days:
            day_items = (meds_by_day.get(day, []) + labs_by_day.get(day, []))
            day_total = sum(
                item.get('total', item.get('price', 0))
                for item in day_items
            )
            running_total += Decimal(str(day_total))
            items_by_day.append({
                'date': day,
                'items': day_items,
                'day_total': day_total,
                'running_total': float(running_total),
            })

        # Bed charges (IPD only)
        bed_charges = None
        if encounter.encounter_type == 'IPD' and encounter.created_at:
            days_admitted = (timezone.now().date() - encounter.created_at.date()).days
            if days_admitted < 1:
                days_admitted = 1
            # Default bed rate — configurable per hospital via settings
            bed_rate = Decimal('2000')  # TODO: pull from HospitalSettings
            total_bed_charges = bed_rate * days_admitted
            bed_charges = {
                'rate_per_day': float(bed_rate),
                'days': days_admitted,
                'total': float(total_bed_charges),
            }
            running_total += total_bed_charges

        invoice_info = None
        existing_invoice = Invoice.objects.filter(encounter=encounter).first()
        if existing_invoice:
            invoice_info = {
                'id': existing_invoice.id,
                'invoice_number': existing_invoice.invoice_number,
                'status': existing_invoice.status,
                'total': float(existing_invoice.total),
            }

        return Response({
            'encounter_id': encounter.id,
            'patient_name': str(encounter.patient),
            'encounter_type': encounter.encounter_type,
            'status': encounter.status,
            'days': items_by_day,
            'medications_total': float(med_total),
            'lab_total': float(lab_total),
            'bed_charges': bed_charges,
            'grand_total': float(running_total),
            'existing_invoice': invoice_info,
        })

    # ── Invoice Generation ──────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def generate_invoice(self, request, pk=None):
        """One-click: collect all billable items → create Invoice + line items."""
        encounter = self.get_object()
        hospital = encounter.hospital

        # Prevent double-invoicing
        if Invoice.objects.filter(encounter=encounter).exclude(
            status='CANCELLED'
        ).exists():
            return Response(
                {'detail': 'Invoice already exists for this encounter.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Determine invoice type from encounter type
        invoice_type_map = {
            'OPD': 'OPD',
            'IPD': 'IPD',
            'TELEICU': 'TELEICU',
            'EMERGENCY': 'OPD',
            'HOME': 'WALKIN',
        }
        invoice_type = invoice_type_map.get(encounter.encounter_type, 'OPD')

        with transaction.atomic():
            # Compute line items
            line_items_data = []

            # 1. Consultation fee (OPD only)
            if encounter.encounter_type in ('OPD', 'EMERGENCY'):
                # TODO: pull from department-rate settings
                line_items_data.append({
                    'description': f'{encounter.encounter_type} Consultation',
                    'quantity': 1,
                    'unit_price': Decimal('500'),
                })

            # 2. Medications
            meds = Medication.objects.filter(
                encounter=encounter, is_active=True
            )
            for m in meds:
                price = m.unit_price or Decimal('0')
                qty = m.quantity or 1
                line_items_data.append({
                    'description': f'{m.drug_name} {m.dosage} x {qty}',
                    'quantity': qty,
                    'unit_price': price,
                })

            # 3. Lab orders
            lab_orders = LabOrder.objects.filter(encounter=encounter).select_related('test_panel')
            for lo in lab_orders:
                price = lo.test_panel.price if lo.test_panel and lo.test_panel.price else Decimal('0')
                desc = f'{lo.test_panel.short_name or lo.test_panel.name}' if lo.test_panel else 'Lab Test'
                line_items_data.append({
                    'description': desc,
                    'quantity': 1,
                    'unit_price': price,
                })

            # 4. Bed charges (IPD only)
            bed_charge_total = Decimal('0')
            if encounter.encounter_type == 'IPD':
                days = (timezone.now().date() - encounter.created_at.date()).days
                if days < 1:
                    days = 1
                bed_rate = Decimal('2000')  # TODO: configurable
                bed_charge_total = bed_rate * days
                line_items_data.append({
                    'description': f'Bed Charge ({days} day{"s" if days > 1 else ""})',
                    'quantity': days,
                    'unit_price': bed_rate,
                })

            # Calculate totals
            subtotal = sum(
                li['unit_price'] * li['quantity']
                for li in line_items_data
            )
            # TODO: pull tax rate from BillingSettings
            tax_rate = Decimal('0.18')
            tax = (subtotal * tax_rate).quantize(Decimal('0.01'))
            total = subtotal + tax

            # Generate invoice number
            today_str = timezone.now().strftime('%Y%m%d')
            invoice_count = Invoice.objects.filter(
                created_at__date=timezone.now().date()
            ).count() + 1
            invoice_number = f'INV-{today_str}-{invoice_count:04d}'

            invoice = Invoice.objects.create(
                patient=encounter.patient,
                encounter=encounter,
                invoice_type=invoice_type,
                invoice_number=invoice_number,
                status='DRAFT',
                subtotal=subtotal,
                tax=tax,
                tax_percent=float(tax_rate * 100),
                total=total,
                department=encounter.department or '',
                hospital=hospital,
            )

            for li in line_items_data:
                InvoiceLineItem.objects.create(
                    invoice=invoice,
                    description=li['description'],
                    quantity=li['quantity'],
                    unit_price=li['unit_price'],
                    total_price=li['unit_price'] * li['quantity'],
                    hospital=hospital,
                )

        return Response(
            InvoiceSerializer(invoice).data,
            status=status.HTTP_201_CREATED,
        )

    # ── Complete Encounter ──────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark encounter as COMPLETED."""
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
