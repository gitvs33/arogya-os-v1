"""Billing views — invoices, payments, refunds, insurance claims, dashboard."""
from datetime import date

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from ..permissions import HasBillingAccess
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, F, Q, Sum
from django.db import transaction
from django.utils import timezone

from ..models import (
    Invoice, InvoiceLineItem,
    Payment, RefundRequest, InsuranceClaim,
)
from ..serializers import (
    InvoiceSerializer, InvoiceLineItemSerializer,
    PaymentSerializer, RefundRequestSerializer,
    InsuranceClaimSerializer,
    BillingDashboardSummarySerializer,
)
from ..billing.metrics import BillingMetricsAggregator
from ..billing.insights import BillingInsightsEngine
from ..billing.transactions import fetch_transaction_feed
from .base import HospitalScopedViewSet, get_hospital_from_user


class InvoiceViewSet(HospitalScopedViewSet):
    """CRUD for billing invoices."""
    queryset = Invoice.objects.select_related(
        'patient', 'encounter', 'created_by'
    ).prefetch_related('line_items')
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, HasBillingAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'invoice_type']
    search_fields = ['invoice_number', 'patient__first_name', 'patient__last_name']

    def perform_create(self, serializer):
        hospital = self.get_hospital()
        # Auto-generate invoice number
        today = date.today()
        count = Invoice.objects.filter(
            created_at__date=today, hospital=hospital
        ).count() + 1
        invoice_number = f"MEDOS-{today.strftime('%Y%m%d')}-{count:04d}"
        serializer.save(
            created_by=self.request.user,
            hospital=hospital,
            invoice_number=invoice_number
        )

    @action(detail=True, methods=['post'])
    def add_line_item(self, request, pk=None):
        """Add a line item to an existing invoice."""
        invoice = self.get_object()
        serializer = InvoiceLineItemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(invoice=invoice)
            self._recalculate_totals(invoice)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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

    @action(detail=True, methods=['post'])
    def issue(self, request, pk=None):
        """Issue (finalise) a draft invoice."""
        invoice = self.get_object()
        if invoice.status != 'DRAFT':
            return Response(
                {'error': 'Only draft invoices can be issued.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invoice.status = 'ISSUED'
        invoice.issued_at = timezone.now()
        invoice.save()
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark invoice as paid (full payment received)."""
        invoice = self.get_object()
        if invoice.status not in ['ISSUED', 'DRAFT']:
            return Response(
                {'error': 'Invoice must be issued first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invoice.status = 'PAID'
        invoice.paid_at = timezone.now()
        invoice.save()

        # Also create a receipt record
        Payment.objects.create(
            invoice=invoice,
            patient=invoice.patient,
            amount=invoice.total,
            payment_method=request.data.get('payment_method', 'CASH'),
            status='SUCCESS',
            collected_by=request.user,
        )

        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=['get'])
    def day_end_report(self, request, pk=None):
        """Generate day-end summary report for all invoices."""
        today = date.today()
        invoices_today = Invoice.objects.filter(created_at__date=today)

        total_revenue = invoices_today.aggregate(
            total=Sum('total')
        )['total'] or 0

        total_collected = Payment.objects.filter(
            transaction_time__date=today,
            status='SUCCESS'
        ).aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            'date': today,
            'total_invoices': invoices_today.count(),
            'total_revenue': float(total_revenue),
            'total_collected': float(total_collected),
            'pending': invoices_today.filter(status='ISSUED').count(),
            'drafts': invoices_today.filter(status='DRAFT').count(),
            'paid': invoices_today.filter(status='PAID').count(),
            'cancelled': invoices_today.filter(status='CANCELLED').count(),
        })


class PaymentViewSet(HospitalScopedViewSet):
    """Payment / receipt records."""
    queryset = Payment.objects.select_related('invoice', 'patient', 'collected_by')
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, HasBillingAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['invoice', 'patient', 'payment_method', 'status']
    ordering_fields = ['-transaction_time']

    def perform_create(self, serializer):
        hospital = self.get_hospital()
        today = date.today()
        count = Payment.objects.filter(
            transaction_time__date=today, hospital=hospital
        ).count() + 1
        receipt_number = f"RCT-{today.strftime('%Y%m%d')}-{count:04d}"
        serializer.save(
            collected_by=self.request.user,
            hospital=hospital,
            receipt_number=receipt_number
        )


class RefundRequestViewSet(HospitalScopedViewSet):
    """Refund request management."""
    queryset = RefundRequest.objects.select_related('invoice', 'patient')
    serializer_class = RefundRequestSerializer
    permission_classes = [IsAuthenticated, HasBillingAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'invoice', 'patient']

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        refund = self.get_object()
        if refund.status != 'PENDING_APPROVAL':
            return Response({'error': 'Refund is not pending approval.'}, status=status.HTTP_400_BAD_REQUEST)
        refund.status = 'APPROVED'
        refund.approved_by = request.user
        refund.approved_at = timezone.now()
        refund.save()
        return Response(RefundRequestSerializer(refund).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        refund = self.get_object()
        if refund.status != 'PENDING_APPROVAL':
            return Response({'error': 'Refund is not pending approval.'}, status=status.HTTP_400_BAD_REQUEST)
        refund.status = 'REJECTED'
        refund.rejection_reason = request.data.get('reason', '')
        refund.save()
        return Response(RefundRequestSerializer(refund).data)


class InsuranceClaimViewSet(HospitalScopedViewSet):
    """Insurance claims management."""
    queryset = InsuranceClaim.objects.select_related('invoice', 'patient')
    serializer_class = InsuranceClaimSerializer
    permission_classes = [IsAuthenticated, HasBillingAccess]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'provider_name', 'patient']
    ordering_fields = ['-submitted_at']

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        claim = self.get_object()
        if claim.status != 'DRAFT':
            return Response({'error': 'Claim is not a draft.'}, status=status.HTTP_400_BAD_REQUEST)
        claim.status = 'SUBMITTED'
        claim.submitted_at = timezone.now()
        claim.save()
        return Response(InsuranceClaimSerializer(claim).data)

    @action(detail=True, methods=['post'])
    def mark_settled(self, request, pk=None):
        claim = self.get_object()
        claim.status = 'SETTLED'
        claim.settled_at = timezone.now()
        claim.settled_amount = request.data.get('settled_amount', claim.settled_amount or 0)
        claim.save()
        return Response(InsuranceClaimSerializer(claim).data)


class BillingDashboardView(generics.GenericAPIView):
    """Aggregated billing KPIs for the billing dashboard.

    Delegates all metric computation to ``BillingMetricsAggregator``.
    This view is now a thin orchestration layer.
    """
    permission_classes = [IsAuthenticated, HasBillingAccess]

    def get(self, request):
        hospital = get_hospital_from_user(request.user)
        aggregator = BillingMetricsAggregator(hospital=hospital)
        data = aggregator.summary()
        serializer = BillingDashboardSummarySerializer({
            **data,
            # Ensure floats are accepted by DecimalField serializers
            'revenue_today': round(float(data['revenue_today']), 2),
            'pending_payments_total': round(float(data['pending_payments_total']), 2),
            'collected_today': round(float(data['collected_today']), 2),
            'refund_requests_total': round(float(data['refund_requests_total']), 2),
            'insurance_claims_total': round(float(data['insurance_claims_total']), 2),
            'outstanding_balance': round(float(data['outstanding_balance']), 2),
        })
        return Response(serializer.data)


class BillingTransactionsView(generics.GenericAPIView):
    """Detailed billing transactions feed."""
    permission_classes = [IsAuthenticated, HasBillingAccess]

    def get(self, request):
        hospital = get_hospital_from_user(request.user)
        limit = int(request.query_params.get('limit', 50))
        transactions = fetch_transaction_feed(hospital, limit)
        return Response(transactions)


class BillingInsightsView(generics.GenericAPIView):
    """Analytical billing insights and recommendations.

    Delegates all insight computation to ``BillingInsightsEngine``.
    This view is now a thin orchestration layer.
    """
    permission_classes = [IsAuthenticated, HasBillingAccess]

    def get(self, request):
        hospital = get_hospital_from_user(request.user)
        engine = BillingInsightsEngine(hospital=hospital)
        insights = engine.analyze()
        return Response(insights)
