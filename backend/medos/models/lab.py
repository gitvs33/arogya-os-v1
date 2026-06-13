"""Laboratory module models."""
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


class TestPanel(models.Model):
    """Master catalog of all available lab tests and panels."""
    CATEGORY_CHOICES = [
        ('HEMATOLOGY', 'Hematology'),
        ('BIOCHEMISTRY', 'Biochemistry'),
        ('MICROBIOLOGY', 'Microbiology'),
        ('PATHOLOGY', 'Pathology'),
        ('IMMUNOLOGY', 'Immunology'),
        ('SEROLOGY', 'Serology'),
        ('TOXICOLOGY', 'Toxicology'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=300, help_text='Full name, e.g. "Complete Blood Count (CBC)"')
    short_name = models.CharField(max_length=50, blank=True, default='', help_text='Abbreviation, e.g. CBC')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='OTHER')
    description = models.TextField(blank=True, default='', help_text='What the test measures')
    standard_tat_hours = models.IntegerField(default=24, help_text='Standard turnaround time in hours')
    sample_types = models.JSONField(default=list, blank=True, help_text='Accepted sample types, e.g. ["Blood (EDTA)", "Serum"]')
    method = models.CharField(max_length=200, blank=True, default='', help_text='Analysis method, e.g. "Automated (Sysmex XN-1000)"')
    lab_location = models.CharField(max_length=200, blank=True, default='', help_text='e.g. "Main Laboratory", "Microbiology Wing"')
    is_panel = models.BooleanField(default=False, help_text='True if this contains multiple sub-tests / parameters')
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='Standard price')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='test_panels'
    )

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['short_name']),
        ]

    def __str__(self):
        return f"{self.short_name or self.name}"


class TestParameter(models.Model):
    """Individual parameter / analyte within a test panel."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    panel = models.ForeignKey(
        TestPanel, on_delete=models.CASCADE,
        related_name='parameters'
    )
    group = models.CharField(max_length=100, blank=True, default='', help_text='Group heading, e.g. "Differential Count"')
    name = models.CharField(max_length=200, help_text='Parameter name, e.g. "Hemoglobin (Hb)"')
    unit = models.CharField(max_length=50, blank=True, default='', help_text='Unit of measurement, e.g. "g/dL"')
    ref_range_low = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='Lower bound of normal range')
    ref_range_high = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='Upper bound of normal range')
    critical_low = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='Critical low threshold')
    critical_high = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='Critical high threshold')
    display_order = models.IntegerField(default=0, help_text='Sorting order within the group')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='test_parameters'
    )

    class Meta:
        ordering = ['panel', 'group', 'display_order', 'name']
        indexes = [
            models.Index(fields=['panel', 'group']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"{self.name} ({self.panel.short_name or self.panel.name})"


class LabOrder(models.Model):
    """Primary unit of work — one test order per test/panel."""
    STATUS_CHOICES = [
        ('ORDERED', 'Ordered'),
        ('SAMPLE_COLLECTED', 'Sample Collected'),
        ('RECEIVED_IN_LAB', 'Received in Lab'),
        ('IN_PROGRESS', 'In Progress'),
        ('UNDER_REVIEW', 'Under Review'),
        ('COMPLETED', 'Completed'),
        ('CRITICAL', 'Critical'),
        ('CANCELLED', 'Cancelled'),
    ]
    PRIORITY_CHOICES = [
        ('ROUTINE', 'Routine'),
        ('URGENT', 'Urgent'),
        ('STAT', 'STAT'),
    ]
    VISIT_TYPE_CHOICES = [
        ('OPD', 'OPD'),
        ('IPD', 'IPD'),
        ('ER', 'Emergency'),
    ]
    SAMPLE_TYPE_CHOICES = [
        ('BLOOD_EDTA', 'Blood (EDTA)'),
        ('BLOOD_CLOT', 'Blood (Clot)'),
        ('SERUM', 'Serum'),
        ('PLASMA', 'Plasma'),
        ('URINE', 'Urine'),
        ('STOOL', 'Stool'),
        ('CSF', 'CSF'),
        ('SWAB', 'Swab'),
        ('SPUTUM', 'Sputum'),
        ('TISSUE', 'Tissue'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lab_id = models.CharField(max_length=30, unique=True, blank=True, editable=False,
                              help_text='Auto-generated, e.g. LAB-20260610-0001')
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='lab_orders'
    )
    encounter = models.ForeignKey(
        'Encounter', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='lab_orders'
    )
    test_panel = models.ForeignKey(
        TestPanel, on_delete=models.PROTECT,
        related_name='orders'
    )
    ordered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='lab_orders_placed'
    )
    department = models.CharField(max_length=100, blank=True, default='',
                                  help_text='Department requesting the test, e.g. Cardiology')
    sample_type = models.CharField(max_length=20, choices=SAMPLE_TYPE_CHOICES, blank=True, default='')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='ROUTINE')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ORDERED')
    barcode = models.CharField(max_length=30, unique=True, blank=True, null=True,
                               help_text='Accession number, e.g. BC602260001')
    visit_type = models.CharField(max_length=10, choices=VISIT_TYPE_CHOICES, blank=True, default='')
    bed_unit = models.CharField(max_length=50, blank=True, default='',
                                help_text='Bed/ward for IPD patients, e.g. ICU-05')

    # Lifecycle timestamps
    ordered_at = models.DateTimeField(auto_now_add=True)
    sample_collected_at = models.DateTimeField(null=True, blank=True)
    received_in_lab_at = models.DateTimeField(null=True, blank=True)
    analysis_completed_at = models.DateTimeField(null=True, blank=True)
    reported_at = models.DateTimeField(null=True, blank=True)

    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='lab_reviews'
    )
    tat_deadline = models.DateTimeField(null=True, blank=True,
                                        help_text='Auto-calculated from test TAT SLA')
    comments = models.TextField(blank=True, default='', help_text='Pathologist comments')
    prescription = models.ForeignKey(
        'Prescription', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='lab_orders',
        help_text='The prescription this lab order belongs to',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='lab_orders'
    )

    class Meta:
        ordering = ['-ordered_at']
        indexes = [
            models.Index(fields=['lab_id']),
            models.Index(fields=['patient', '-ordered_at']),
            models.Index(fields=['status']),
            models.Index(fields=['barcode']),
            models.Index(fields=['encounter']),
        ]

    def __str__(self):
        return f"{self.lab_id} — {self.test_panel.short_name or self.test_panel.name} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        if not self.lab_id:
            today = date.today()
            date_str = today.strftime('%Y%m%d')
            today_count = LabOrder.objects.filter(
                created_at__date=today
            ).count()
            self.lab_id = f'LAB-{date_str}-{today_count + 1:04d}'

        if not self.barcode:
            today = date.today()
            date_str = today.strftime('%y%m%d')
            today_count = LabOrder.objects.filter(
                created_at__date=today
            ).count()
            self.barcode = f'BC{date_str}{today_count + 1:05d}'

        if not self.tat_deadline and self.test_panel_id:
            tat_hours = self.test_panel.standard_tat_hours
            self.tat_deadline = timezone.now() + timedelta(hours=tat_hours)

        super().save(*args, **kwargs)


class LabParameterResult(models.Model):
    """Per-parameter result entry for a completed LabOrder."""
    RESULT_STATUS_CHOICES = [
        ('NORMAL', 'Normal'),
        ('LOW', 'Low'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
        ('PENDING', 'Pending'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        LabOrder, on_delete=models.CASCADE,
        related_name='parameter_results'
    )
    parameter = models.ForeignKey(
        TestParameter, on_delete=models.PROTECT,
        related_name='results'
    )
    result_value = models.CharField(max_length=200, blank=True, default='',
                                    help_text='Stored as string to handle qualitative results too')
    result_numeric = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True,
                                         help_text='Numeric value used for trend calculations')
    status = models.CharField(max_length=20, choices=RESULT_STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True, default='')
    entered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='lab_parameter_entries'
    )
    entered_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='lab_parameter_results'
    )

    class Meta:
        unique_together = ['order', 'parameter']
        indexes = [
            models.Index(fields=['order', 'parameter']),
            models.Index(fields=['status']),
        ]
        ordering = ['order', 'parameter__group', 'parameter__display_order']

    def __str__(self):
        param_name = self.parameter.name if self.parameter_id else '?'
        return f"{param_name}: {self.result_value or '-'} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        """Auto-compute result status from reference ranges."""
        if self.result_numeric is not None and self.parameter_id:
            param = self.parameter
            val = float(self.result_numeric)

            if param.critical_low is not None and val <= float(param.critical_low):
                self.status = 'CRITICAL'
            elif param.critical_high is not None and val >= float(param.critical_high):
                self.status = 'CRITICAL'
            elif param.ref_range_low is not None and val < float(param.ref_range_low):
                self.status = 'LOW'
            elif param.ref_range_high is not None and val > float(param.ref_range_high):
                self.status = 'HIGH'
            else:
                self.status = 'NORMAL'
        elif self.result_value and self.result_value.strip() and self.result_numeric is None:
            if self.status == 'PENDING':
                self.status = 'NORMAL'

        super().save(*args, **kwargs)


class LabDocument(models.Model):
    """Attached files / PDF reports for a lab order."""
    DOCUMENT_TYPE_CHOICES = [
        ('PDF_REPORT', 'PDF Report'),
        ('IMAGE', 'Image'),
        ('RAW_DATA', 'Raw Data'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        LabOrder, on_delete=models.CASCADE,
        related_name='documents'
    )
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPE_CHOICES, default='PDF_REPORT')
    file_url = models.URLField(help_text='URL or path to uploaded document')
    filename = models.CharField(max_length=255, blank=True, default='')
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='lab_documents'
    )

    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['order', 'document_type']),
        ]

    def __str__(self):
        return f"{self.get_document_type_display()} — {self.order.lab_id}"


class QCEntry(models.Model):
    """Quality control & audit trail for a lab order."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        LabOrder, on_delete=models.CASCADE,
        related_name='qc_entries'
    )
    action = models.CharField(max_length=200, help_text='e.g. "Sample Received", "Review Approved"')
    performed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, default='')
    instrument_id = models.CharField(max_length=100, blank=True, default='',
                                     help_text='Analyzer / machine that processed the sample')
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='lab_qc_entries'
    )

    class Meta:
        verbose_name_plural = 'QC entries'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['order', '-timestamp']),
        ]

    def __str__(self):
        return f"{self.action} — {self.order.lab_id}"


class LabInventory(models.Model):
    """Reagents, consumables, and equipment tracking."""
    ITEM_TYPE_CHOICES = [
        ('REAGENT', 'Reagent'),
        ('CONSUMABLE', 'Consumable'),
        ('EQUIPMENT', 'Equipment'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item_name = models.CharField(max_length=300, help_text='e.g. "EDTA Tubes", "Reagent Kit CBC"')
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES, default='REAGENT')
    current_stock = models.IntegerField(default=0, help_text='Current quantity in stock')
    min_stock_threshold = models.IntegerField(default=0, help_text='Alert when stock falls below this')
    unit = models.CharField(max_length=50, blank=True, default='', help_text='e.g. boxes, vials, units')
    expiry_date = models.DateField(null=True, blank=True)
    batch_number = models.CharField(max_length=100, blank=True, default='')
    location = models.CharField(max_length=200, blank=True, default='', help_text='Storage location (e.g. "Fridge 3, Shelf B")')
    last_restocked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='lab_inventory'
    )

    class Meta:
        verbose_name_plural = 'Lab inventory'
        ordering = ['item_name']
        indexes = [
            models.Index(fields=['item_type']),
            models.Index(fields=['current_stock']),
        ]

    def __str__(self):
        return f"{self.item_name} ({self.current_stock} {self.unit})"

    @property
    def is_low_stock(self):
        return self.min_stock_threshold > 0 and self.current_stock <= self.min_stock_threshold


class LabAlert(models.Model):
    """Critical alert triggered when a LabParameterResult is CRITICAL."""
    SEVERITY_CHOICES = [
        ('CRITICAL', 'Critical'),
        ('WARNING', 'Warning'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        LabOrder, on_delete=models.CASCADE,
        related_name='alerts'
    )
    parameter_result = models.ForeignKey(
        LabParameterResult, on_delete=models.CASCADE,
        related_name='alerts', null=True, blank=True
    )
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='lab_alerts'
    )
    alert_message = models.CharField(max_length=500, help_text='e.g. "CBC - Low Hemoglobin"')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='CRITICAL')
    is_acknowledged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='lab_alerts'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order', 'is_acknowledged']),
            models.Index(fields=['patient', '-created_at']),
            models.Index(fields=['severity']),
        ]

    def __str__(self):
        return f"[{self.get_severity_display()}] {self.alert_message}"
