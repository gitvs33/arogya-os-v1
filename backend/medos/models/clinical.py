"""Clinical encounter, vitals, medication, alert, diagnosis, and care plan models."""
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
        'Patient', on_delete=models.CASCADE,
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
    department_ref = models.ForeignKey(
        'Department', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='encounters',
        help_text='Reference to the Department model for data integrity',
    )
    encounter_number = models.CharField(
        max_length=30, blank=True, unique=True, null=True,
        help_text='Auto-generated human-readable ID (e.g. ENC-20260610-00042)'
    )
    bed_number = models.CharField(
        max_length=20, blank=True, default='',
        help_text='Bed/ward assignment for IPD/ICU (e.g. ICU-05, 304-A)'
    )
    clinical_acuity = models.CharField(
        max_length=20, blank=True, default='',
        choices=[
            ('Critical', 'Critical'),
            ('Stable', 'Stable'),
            ('Observation', 'Observation'),
        ],
        help_text='Clinical status badge'
    )
    care_sub_status = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Secondary status text (e.g. "On Monitoring", "Under Care")'
    )
    location = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Hospital branch / wing / floor'
    )
    chief_complaint = models.TextField(blank=True, default='')
    clinical_notes = models.TextField(blank=True, default='')
    diagnosis = models.TextField(blank=True, default='')
    follow_up_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    scheduled_date = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='encounters'
    )

    class Meta:
        indexes = [
            models.Index(fields=['patient', '-created_at']),
            models.Index(fields=['doctor', '-created_at']),
            models.Index(fields=['status']),
        ]
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.encounter_number:
            today = date.today()
            date_str = today.strftime('%Y%m%d')
            today_count = Encounter.objects.filter(
                created_at__date=today
            ).count()
            self.encounter_number = f'ENC-{date_str}-{today_count + 1:05d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_encounter_type_display()} - {self.patient} - {self.created_at.date()}"


class Vitals(models.Model):
    """Clinical vitals recorded during an encounter."""
    encounter = models.ForeignKey(
        Encounter, on_delete=models.CASCADE,
        related_name='vitals'
    )
    is_live = models.BooleanField(
        default=False,
        help_text='True for real-time TeleICU streaming vitals, False for manually recorded'
    )
    recorded_at = models.DateTimeField(auto_now_add=True)
    recorded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True
    )

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
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='vitals_set'
    )

    class Meta:
        verbose_name_plural = "Vitals"
        indexes = [
            models.Index(fields=['encounter', '-recorded_at']),
        ]
        ordering = ['-recorded_at']


class Prescription(models.Model):
    """A grouped set of medications + lab orders ordered together.

    This is the unit of work for pharmacy/lab queues. Doctors create a
    Prescription (DRAFT), review it, then submit (ORDERED). After submission,
    amendments create a new version with superseded_by pointing to the old one.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft — only visible to the ordering doctor'),
        ('ORDERED', 'Ordered — visible to pharmacy/lab'),
        ('IN_PROGRESS', 'In Progress — pharmacy/lab has started'),
        ('DISPENSED', 'Dispensed — all items fulfilled'),
        ('CANCELLED', 'Cancelled — entire prescription voided'),
        ('AMENDED', 'Amended — superseded by a newer version'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    encounter = models.ForeignKey(
        Encounter, on_delete=models.CASCADE,
        related_name='prescriptions',
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='DRAFT',
    )
    version = models.PositiveIntegerField(default=1,
        help_text='Auto-increments per encounter on each amendment')
    superseded_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='supersedes',
        help_text='Newer version that replaces this one (null if latest)',
    )
    ordered_at = models.DateTimeField(auto_now_add=True)
    ordered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='prescriptions_ordered',
    )
    cancellation_reason = models.TextField(blank=True, default='',
        help_text='Required when status is CANCELLED or AMENDED')
    pharmacy_notes = models.TextField(blank=True, default='',
        help_text='Optional note from pharmacist')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='prescriptions',
    )

    class Meta:
        ordering = ['-ordered_at']
        indexes = [
            models.Index(fields=['encounter', '-version']),
            models.Index(fields=['status', 'hospital']),
        ]

    def __str__(self):
        return f"Rx #{self.pk.hex[:8]} v{self.version} ({self.get_status_display()})"

    def submit(self):
        """Transition DRAFT → ORDERED."""
        if self.status != 'DRAFT':
            raise ValueError(f'Cannot submit Prescription in {self.status} state')
        self.status = 'ORDERED'
        self.save(update_fields=['status'])

    def cancel(self, reason):
        """Cancel entire prescription with a reason."""
        if self.status in ('DISPENSED', 'CANCELLED'):
            raise ValueError(f'Cannot cancel Prescription in {self.status} state')
        self.status = 'CANCELLED'
        self.cancellation_reason = reason
        self.save(update_fields=['status', 'cancellation_reason'])
        # Deactivate all associated medications
        self.medications.update(is_active=False)


class Medication(models.Model):
    """Prescribed medication."""
    encounter = models.ForeignKey(
        Encounter, on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='medications'
    )
    drug_name = models.CharField(max_length=200)
    generic_name = models.CharField(max_length=200, blank=True, default='')
    brand_name = models.CharField(max_length=200, blank=True, default='')
    dosage = models.CharField(max_length=100, help_text="e.g., 500mg")
    frequency = models.CharField(max_length=100, help_text="e.g., Twice daily")
    duration = models.CharField(max_length=100, blank=True, default='', help_text="e.g., 7 days")
    route = models.CharField(max_length=50, default='Oral')
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1,
        help_text='How many units / tablets / ml to dispense')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0,
        help_text='Price per unit from DrugInventory')
    instructions = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    cancellation_reason = models.TextField(blank=True, default='',
        help_text='Reason if this specific medication is cancelled')
    prescription = models.ForeignKey(
        'Prescription', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='medications',
        help_text='The prescription this medication belongs to',
    )
    prescribed_at = models.DateTimeField(auto_now_add=True)
    prescribed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='medications'
    )

    class Meta:
        ordering = ['-prescribed_at']

    def __str__(self):
        return f"{self.drug_name} - {self.dosage} {self.frequency}"


class ClinicalNote(models.Model):
    """AI-generated clinical note from Sarvam speech-to-text + LLM."""
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('CONFIRMED', 'Confirmed'),
        ('DISCARDED', 'Discarded'),
    ]

    encounter = models.ForeignKey(
        Encounter, on_delete=models.CASCADE,
        related_name='ai_notes',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    specialty = models.CharField(max_length=100, blank=True, default='')
    transcript = models.TextField(blank=True, default='')
    structured_note = models.JSONField(default=dict, blank=True)
    note_text = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='DRAFT',
    )
    audio_duration_secs = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='clinical_notes'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'ClinicalNote #{self.id} — {self.specialty} ({self.status})'


class LabResult(models.Model):
    """Lab investigation / test result linked to an encounter."""
    STATUS_CHOICES = [
        ('ORDERED', 'Ordered'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('REVIEWED', 'Reviewed'),
    ]
    CATEGORY_CHOICES = [
        ('HEMATOLOGY', 'Hematology'),
        ('BIOCHEMISTRY', 'Biochemistry'),
        ('MICROBIOLOGY', 'Microbiology'),
        ('PATHOLOGY', 'Pathology'),
        ('RADIOLOGY', 'Radiology'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    encounter = models.ForeignKey(
        Encounter, on_delete=models.CASCADE,
        related_name='lab_results'
    )
    test_name = models.CharField(max_length=200, db_index=True)
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default='OTHER'
    )
    result_value = models.TextField(blank=True, default='')
    reference_range = models.CharField(max_length=200, blank=True, default='')
    unit = models.CharField(max_length=50, blank=True, default='')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='ORDERED'
    )
    notes = models.TextField(blank=True, default='')
    ordered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='lab_orders'
    )
    ordered_at = models.DateTimeField(auto_now_add=True)
    resulted_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='lab_results'
    )

    class Meta:
        indexes = [
            models.Index(fields=['encounter', '-ordered_at']),
            models.Index(fields=['test_name']),
            models.Index(fields=['status']),
        ]
        ordering = ['-ordered_at']

    def __str__(self):
        return f"{self.test_name} — {self.get_status_display()}"


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
        'Patient', on_delete=models.CASCADE,
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
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='medical_alerts'
    )

    class Meta:
        indexes = [
            models.Index(fields=['alert_type', 'status']),
            models.Index(fields=['patient']),
            models.Index(fields=['-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_severity_display()}] {self.message[:60]}"


class Diagnosis(models.Model):
    """Structured diagnosis / problem list entry (ICD-10 coded)."""
    DIAGNOSIS_STATUS = [
        ('ACTIVE', 'Active'),
        ('RESOLVED', 'Resolved'),
        ('INACTIVE', 'Inactive'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='diagnoses'
    )
    encounter = models.ForeignKey(
        Encounter, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='diagnoses'
    )
    icd10_code = models.CharField(
        max_length=20, blank=True, default='',
        help_text='ICD-10 code (e.g. I10, J45.0)'
    )
    condition_name = models.CharField(max_length=300)
    onset_date = models.DateField(null=True, blank=True)
    resolved_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=DIAGNOSIS_STATUS, default='ACTIVE'
    )
    notes = models.TextField(blank=True, default='')
    diagnosed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='diagnoses'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Diagnoses'
        indexes = [
            models.Index(fields=['patient', 'status']),
            models.Index(fields=['icd10_code']),
            models.Index(fields=['hospital']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.icd10_code} — {self.condition_name} ({self.get_status_display()})"


class ServiceOrder(models.Model):
    """Physician order for a lab test, imaging, or procedure."""
    CATEGORY_CHOICES = [
        ('LAB', 'Lab Test'),
        ('IMAGING', 'Imaging'),
        ('PROCEDURE', 'Procedure'),
    ]
    STATUS_CHOICES = [
        ('ORDERED', 'Ordered'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='orders'
    )
    encounter = models.ForeignKey(
        Encounter, on_delete=models.CASCADE,
        related_name='orders'
    )
    order_name = models.CharField(
        max_length=300,
        help_text='Name of test / imaging / procedure'
    )
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default='LAB'
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='ORDERED'
    )
    clinical_notes = models.TextField(blank=True, default='')
    ordered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='service_orders'
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='service_orders'
    )
    ordered_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['patient', '-ordered_at']),
            models.Index(fields=['encounter']),
            models.Index(fields=['status']),
            models.Index(fields=['hospital']),
        ]
        ordering = ['-ordered_at']

    def __str__(self):
        return f"{self.order_name} ({self.get_status_display()})"


class ImagingResult(models.Model):
    """Structured imaging / cardiology report (ECHO, ECG, X-ray, MRI, etc.)."""
    MODALITY_CHOICES = [
        ('XRAY', 'X-Ray'),
        ('CT', 'CT Scan'),
        ('MRI', 'MRI'),
        ('USG', 'Ultrasound'),
        ('ECHO', 'Echocardiogram'),
        ('ECG', 'Electrocardiogram'),
        ('TMT', 'Treadmill Test'),
        ('MAMMO', 'Mammography'),
        ('PET', 'PET Scan'),
        ('OTHER', 'Other'),
    ]
    STATUS_CHOICES = [
        ('ORDERED', 'Ordered'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('REVIEWED', 'Reviewed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='imaging_results'
    )
    encounter = models.ForeignKey(
        Encounter, on_delete=models.CASCADE,
        related_name='imaging_results'
    )
    modality = models.CharField(
        max_length=10, choices=MODALITY_CHOICES, default='XRAY'
    )
    title = models.CharField(max_length=300)
    findings = models.TextField(blank=True, default='')
    impression = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='ORDERED'
    )
    report_file = models.URLField(
        blank=True, default='',
        help_text='URL to uploaded report PDF/image'
    )
    ordered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='imaging_orders'
    )
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='imaging_reviews'
    )
    ordered_at = models.DateTimeField(auto_now_add=True)
    resulted_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='imaging_results'
    )

    class Meta:
        indexes = [
            models.Index(fields=['patient', '-ordered_at']),
            models.Index(fields=['encounter']),
            models.Index(fields=['modality']),
        ]
        ordering = ['-ordered_at']

    def __str__(self):
        return f"{self.get_modality_display()} — {self.title} ({self.get_status_display()})"


class CarePlan(models.Model):
    """Structured care plan / treatment plan for a patient."""
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('ON_HOLD', 'On Hold'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='care_plans'
    )
    encounter = models.ForeignKey(
        Encounter, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='care_plans'
    )
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, default='')
    goals = models.JSONField(
        blank=True, default=list,
        help_text='List of treatment goals'
    )
    interventions = models.JSONField(
        blank=True, default=list,
        help_text='List of planned interventions'
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='ACTIVE'
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='care_plans'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='care_plans'
    )

    class Meta:
        indexes = [
            models.Index(fields=['patient', 'status']),
            models.Index(fields=['-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"
