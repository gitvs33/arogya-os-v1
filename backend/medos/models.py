import uuid
from datetime import date, timedelta
from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator

User = get_user_model()


class Patient(models.Model):
    """Patient demographic record."""
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital_patient_id = models.CharField(
        max_length=50, blank=True,
        help_text="External ID from legacy HMIS"
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, default='')
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='O')
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    address = models.TextField(blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    state = models.CharField(max_length=100, blank=True, default='')
    pincode = models.CharField(max_length=10, blank=True, default='')
    abha_id = models.CharField(
        max_length=50, blank=True, null=True,
        help_text="Ayushman Bharat Health Account ID"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='patients_created'
    )

    class Meta:
        indexes = [
            models.Index(fields=['hospital_patient_id']),
            models.Index(fields=['phone']),
            models.Index(fields=['first_name', 'last_name']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip() or str(self.id)

    @property
    def age(self):
        if not self.date_of_birth:
            return None
        today = date.today()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) <
            (self.date_of_birth.month, self.date_of_birth.day)
        )

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class Encounter(models.Model):
    """A patient encounter / consultation."""
    ENCOUNTER_TYPES = [
        ('OPD', 'Outpatient'),
        ('IPD', 'Inpatient'),
        ('EMERGENCY', 'Emergency'),
        ('TELEICU', 'TeleICU'),
        ('HOME', 'Home Visit'),
    ]
    STATUS_CHOICES = [
        ('PLANNED', 'Planned'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE,
        related_name='encounters'
    )
    encounter_type = models.CharField(
        max_length=20, choices=ENCOUNTER_TYPES, default='OPD'
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PLANNED'
    )
    doctor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='encounters'
    )
    department = models.CharField(max_length=100, blank=True, default='')
    chief_complaint = models.TextField(blank=True, default='')
    clinical_notes = models.TextField(blank=True, default='')
    diagnosis = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    scheduled_date = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['patient', '-created_at']),
            models.Index(fields=['doctor', '-created_at']),
            models.Index(fields=['status']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_encounter_type_display()} - {self.patient} - {self.created_at.date()}"


class Vitals(models.Model):
    """Clinical vitals recorded during an encounter."""
    encounter = models.ForeignKey(
        Encounter, on_delete=models.CASCADE,
        related_name='vitals'
    )
    recorded_at = models.DateTimeField(auto_now_add=True)
    recorded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True
    )

    # Vitals fields
    systolic_bp = models.IntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(30), MaxValueValidator(300)]
    )
    diastolic_bp = models.IntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(20), MaxValueValidator(200)]
    )
    heart_rate = models.IntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(20), MaxValueValidator(300)]
    )
    respiratory_rate = models.IntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(4), MaxValueValidator(100)]
    )
    temperature = models.FloatField(
        null=True, blank=True,
        help_text="Body temperature in Celsius",
        validators=[MinValueValidator(30.0), MaxValueValidator(45.0)]
    )
    oxygen_saturation = models.IntegerField(
        null=True, blank=True, verbose_name="SpO2",
        validators=[MinValueValidator(50), MaxValueValidator(100)]
    )
    weight = models.FloatField(
        null=True, blank=True,
        help_text="Weight in kg",
        validators=[MinValueValidator(0.5), MaxValueValidator(300.0)]
    )
    height = models.FloatField(
        null=True, blank=True,
        help_text="Height in cm",
        validators=[MinValueValidator(10.0), MaxValueValidator(300.0)]
    )
    blood_glucose = models.IntegerField(
        null=True, blank=True,
        help_text="Blood glucose in mg/dL",
        validators=[MinValueValidator(10), MaxValueValidator(1000)]
    )

    class Meta:
        verbose_name_plural = "Vitals"
        indexes = [
            models.Index(fields=['encounter', '-recorded_at']),
        ]
        ordering = ['-recorded_at']


class Medication(models.Model):
    """Prescribed medication."""
    encounter = models.ForeignKey(
        Encounter, on_delete=models.CASCADE,
        related_name='medications'
    )
    drug_name = models.CharField(max_length=200)
    generic_name = models.CharField(max_length=200, blank=True, default='')
    brand_name = models.CharField(max_length=200, blank=True, default='')
    dosage = models.CharField(max_length=100, help_text="e.g., 500mg")
    frequency = models.CharField(max_length=100, help_text="e.g., Twice daily")
    duration = models.CharField(max_length=100, blank=True, default='', help_text="e.g., 7 days")
    route = models.CharField(max_length=50, default='Oral')
    instructions = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    prescribed_at = models.DateTimeField(auto_now_add=True)
    prescribed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True
    )

    class Meta:
        ordering = ['-prescribed_at']

    def __str__(self):
        return f"{self.drug_name} - {self.dosage} {self.frequency}"


class SyncEntry(models.Model):
    """CRDT sync entry for offline-first replication."""
    MODEL_CHOICES = [
        ('patient', 'Patient'),
        ('encounter', 'Encounter'),
        ('vitals', 'Vitals'),
        ('medication', 'Medication'),
    ]

    record_id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    model_name = models.CharField(max_length=50, choices=MODEL_CHOICES)
    jsonb_snapshot = models.JSONField(
        help_text="Y.js CRDT document stored as JSON"
    )
    version = models.IntegerField(default=1, help_text="Document schema version")
    source = models.CharField(
        max_length=20, default='online',
        choices=[('online', 'Online'), ('offline', 'Offline')]
    )
    role_snapshot_hash = models.CharField(
        max_length=64, blank=True, default='',
        help_text="SHA-256 hash of user's role at time of write"
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Sync entries"
        indexes = [
            models.Index(fields=['model_name']),
            models.Index(fields=['-created_at']),
        ]
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.model_name}:{self.record_id} v{self.version}"


class ReconciliationLog(models.Model):
    """Log of reconciliation outcomes from CRDT -> normalized tables."""
    STATUS_CHOICES = [
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('CONFLICT', 'Conflict'),
    ]

    sync_entry = models.ForeignKey(
        SyncEntry, on_delete=models.CASCADE,
        related_name='reconciliation_logs'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    error_message = models.TextField(blank=True, default='')
    reconcoled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-reconcoled_at']

    def __str__(self):
        return f"{self.sync_entry} -> {self.status}"


class DrugInteraction(models.Model):
    """Cached drug-drug interaction data."""
    SEVERITY_CHOICES = [
        ('minor', 'Minor'),
        ('moderate', 'Moderate'),
        ('major', 'Major'),
        ('contraindicated', 'Contraindicated'),
    ]

    drug_a = models.CharField(max_length=200, db_index=True)
    drug_b = models.CharField(max_length=200, db_index=True)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    description = models.TextField(blank=True, default='')
    mechanism = models.TextField(blank=True, default='')
    recommendation = models.TextField(blank=True, default='')
    source = models.CharField(max_length=50, blank=True, default='')
    cached_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['drug_a', 'drug_b']
        indexes = [
            models.Index(fields=['drug_a', 'drug_b']),
            models.Index(fields=['severity']),
        ]

    def __str__(self):
        return f"{self.drug_a} x {self.drug_b} ({self.severity})"


class Invoice(models.Model):
    """Billing invoice."""
    INVOICE_TYPES = [
        ('OPD', 'OPD Consultation'),
        ('PHARMACY', 'Pharmacy'),
        ('LAB', 'Lab Test'),
        ('IPD', 'Inpatient'),
    ]
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ISSUED', 'Issued'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE,
        related_name='invoices'
    )
    encounter = models.ForeignKey(
        Encounter, on_delete=models.SET_NULL, null=True, blank=True,
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
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True
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

    def __str__(self):
        return f"{self.description} x {self.quantity}"


class MedicalAlert(models.Model):
    """Clinical alert (threshold breach, DDI warning, etc.)."""
    ALERT_TYPES = [
        ('VITALS', 'Vitals Threshold'),
        ('DDI', 'Drug Interaction'),
        ('RISK', 'Risk Level Change'),
        ('SYSTEM', 'System Alert'),
    ]
    SEVERITY_CHOICES = [
        ('INFO', 'Informational'),
        ('WARNING', 'Warning'),
        ('CRITICAL', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('ACKNOWLEDGED', 'Acknowledged'),
        ('RESOLVED', 'Resolved'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE,
        related_name='alerts', null=True, blank=True
    )
    encounter = models.ForeignKey(
        Encounter, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='alerts'
    )
    message = models.TextField()
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='acknowledged_alerts'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['alert_type', 'status']),
            models.Index(fields=['patient']),
            models.Index(fields=['-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_severity_display()}] {self.message[:60]}"
