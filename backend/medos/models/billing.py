"""Billing and payment models."""
import uuid
import hashlib
import json
from datetime import date, timedelta
from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator

User = get_user_model()


class Invoice(models.Model):
    """Billing invoice."""
    INVOICE_TYPES = [
        ('OPD', 'OPD Consultation'),
        ('PHARMACY', 'Pharmacy'),
        ('LAB', 'Lab Test'),
        ('IPD', 'Inpatient'),
        ('WALKIN', 'Walk-in Service'),
        ('TELEICU', 'TeleICU'),
    ]
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ISSUED', 'Issued'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='invoices'
    )
    encounter = models.ForeignKey(
        'Encounter', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices'
    )
    invoice_type = models.CharField(max_length=20, choices=INVOICE_TYPES)
    invoice_number = models.CharField(max_length=50, unique=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='DRAFT'
    )
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=18.00,
        help_text="GST percentage"
    )
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    department = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Department for revenue grouping (e.g. Cardiology)'
    )
    due_date = models.DateField(
        null=True, blank=True,
        help_text='Payment due date for ageing calculations'
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='invoices'
    )

    class Meta:
        indexes = [
            models.Index(fields=['invoice_number']),
            models.Index(fields=['patient', '-created_at']),
            models.Index(fields=['status']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.invoice_number} - {self.patient} - {self.total}"


class InvoiceLineItem(models.Model):
    """Individual line item on an invoice."""
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE,
        related_name='line_items'
    )
    description = models.CharField(max_length=200)
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='invoice_line_items'
    )

    def __str__(self):
        return f"{self.description} x {self.quantity}"


class Payment(models.Model):
    """Payment / receipt against an invoice."""
    PAYMENT_METHODS = [
        ('CASH', 'Cash'),
        ('CARD', 'Card'),
        ('UPI', 'UPI'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('CHEQUE', 'Cheque'),
        ('INSURANCE', 'Insurance'),
    ]
    STATUS_CHOICES = [
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('PENDING', 'Pending'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    receipt_number = models.CharField(max_length=50, unique=True)
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE,
        related_name='payments'
    )
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='payments'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(
        max_length=20, choices=PAYMENT_METHODS, default='CASH'
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='SUCCESS'
    )
    transaction_time = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, default='')
    collected_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='payments'
    )

    class Meta:
        indexes = [
            models.Index(fields=['receipt_number']),
            models.Index(fields=['invoice', '-transaction_time']),
            models.Index(fields=['patient', '-transaction_time']),
            models.Index(fields=['status']),
        ]
        ordering = ['-transaction_time']

    def __str__(self):
        return f"{self.receipt_number} — ₹{self.amount} ({self.get_status_display()})"


class RefundRequest(models.Model):
    """Request for refund against an invoice or payment."""
    STATUS_CHOICES = [
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    refund_number = models.CharField(max_length=50, unique=True)
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE,
        related_name='refund_requests'
    )
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='refund_requests'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDING_APPROVAL'
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_refunds'
    )
    notes = models.TextField(blank=True, default='')
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='refund_requests'
    )

    class Meta:
        indexes = [
            models.Index(fields=['refund_number']),
            models.Index(fields=['invoice']),
            models.Index(fields=['status']),
        ]
        ordering = ['-requested_at']

    def __str__(self):
        return f"{self.refund_number} — ₹{self.amount} ({self.get_status_display()})"


class InsuranceClaim(models.Model):
    """Insurance claim against an invoice."""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('DENIED', 'Denied'),
        ('PARTIALLY_APPROVED', 'Partially Approved'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    claim_number = models.CharField(max_length=50, unique=True)
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE,
        related_name='insurance_claims'
    )
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='insurance_claims'
    )
    insurance_provider = models.CharField(max_length=200)
    claimed_amount = models.DecimalField(max_digits=10, decimal_places=2)
    approved_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDING'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='insurance_claims'
    )

    class Meta:
        indexes = [
            models.Index(fields=['claim_number']),
            models.Index(fields=['invoice']),
            models.Index(fields=['status']),
        ]
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.claim_number} — ₹{self.claimed_amount} ({self.get_status_display()})"
