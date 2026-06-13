"""Invoice, payment, refund, insurance claim, and billing dashboard serializers."""
from rest_framework import serializers
from ..models import Invoice, InvoiceLineItem, Payment, RefundRequest, InsuranceClaim


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = ['id', 'description', 'quantity', 'unit_price', 'total_price']
        read_only_fields = ['id']


class InvoiceSerializer(serializers.ModelSerializer):
    line_items = InvoiceLineItemSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'patient', 'patient_name', 'encounter',
            'invoice_type', 'invoice_number', 'status',
            'subtotal', 'tax', 'tax_percent', 'total',
            'department', 'due_date',
            'line_items', 'created_at', 'issued_at', 'paid_at',
            'created_by',
        ]
        read_only_fields = ['id', 'invoice_number', 'created_at', 'created_by']


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id', 'receipt_number', 'invoice', 'patient', 'amount',
            'payment_method', 'status', 'transaction_time', 'notes',
            'collected_by',
        ]
        read_only_fields = ['id', 'transaction_time', 'receipt_number']


class RefundRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefundRequest
        fields = [
            'id', 'refund_number', 'invoice', 'patient', 'amount',
            'reason', 'status', 'requested_at', 'approved_at',
            'approved_by', 'notes',
        ]
        read_only_fields = ['id', 'refund_number', 'requested_at']


class InsuranceClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsuranceClaim
        fields = [
            'id', 'claim_number', 'invoice', 'patient',
            'insurance_provider', 'claimed_amount', 'approved_amount',
            'status', 'submitted_at', 'decided_at', 'notes',
        ]
        read_only_fields = ['id', 'claim_number', 'submitted_at']


class BillingDashboardSummarySerializer(serializers.Serializer):
    """Aggregated billing dashboard analytics."""
    revenue_today = serializers.DecimalField(max_digits=14, decimal_places=2)
    revenue_vs_yesterday_pct = serializers.FloatField()
    pending_payments_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    pending_invoices_count = serializers.IntegerField()
    collected_today = serializers.DecimalField(max_digits=14, decimal_places=2)
    collection_vs_yesterday_pct = serializers.FloatField()
    refund_requests_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    refund_pending_approval_count = serializers.IntegerField()
    insurance_claims_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    insurance_claims_pending_count = serializers.IntegerField()
    outstanding_balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    outstanding_invoices_count = serializers.IntegerField()
    revenue_vs_collection_30d = serializers.ListField()
    department_revenue_today = serializers.ListField()
    ageing = serializers.DictField()
