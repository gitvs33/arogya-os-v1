"""Ward / IPD models — wards, beds, daily rounds, nursing notes, medication administration."""
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator

User = get_user_model()


class Ward(models.Model):
    """A hospital ward (e.g. General Ward 3A, Surgical Ward, Maternity Ward)."""
    WARD_TYPE_CHOICES = [
        ('general', 'General'),
        ('surgical', 'Surgical'),
        ('maternity', 'Maternity'),
        ('paediatric', 'Paediatric'),
        ('orthopaedic', 'Orthopaedic'),
        ('private', 'Private'),
        ('semi_private', 'Semi-Private'),
        ('icu', 'ICU'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        related_name='wards',
    )
    name = models.CharField(max_length=100, help_text='e.g. General Ward 3A')
    ward_type = models.CharField(
        max_length=20, choices=WARD_TYPE_CHOICES, default='general',
    )
    bed_charge_per_day = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('2000.00'),
        help_text='Daily bed charge in INR',
    )
    floor = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Floor / wing / building',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'medos_ward'
        ordering = ['name']
        indexes = [
            models.Index(fields=['hospital', 'is_active']),
            models.Index(fields=['ward_type']),
        ]

    def __str__(self):
        return self.name

    @property
    def total_beds(self):
        return self.beds.count()

    @property
    def available_beds(self):
        return self.beds.filter(status=Bed.Status.AVAILABLE).count()

    @property
    def occupied_beds(self):
        return self.beds.filter(status=Bed.Status.OCCUPIED).count()

    @property
    def reserved_beds(self):
        return self.beds.filter(status=Bed.Status.RESERVED).count()


class Bed(models.Model):
    """An individual bed within a ward."""
    class Status(models.TextChoices):
        AVAILABLE = 'available', 'Available'
        OCCUPIED = 'occupied', 'Occupied'
        RESERVED = 'reserved', 'Reserved'
        MAINTENANCE = 'maintenance', 'Maintenance'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        related_name='beds',
    )
    ward = models.ForeignKey(
        Ward, on_delete=models.CASCADE,
        related_name='beds',
    )
    bed_number = models.CharField(
        max_length=20, help_text='e.g. 3A-01',
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.AVAILABLE,
    )
    current_encounter = models.OneToOneField(
        'Encounter',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_bed',
        help_text='The currently admitted patient encounter',
    )
    notes = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Optional notes (e.g. needs repair, reserved for VIP)',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'medos_bed'
        unique_together = ['ward', 'bed_number']
        indexes = [
            models.Index(fields=['ward', 'status']),
            models.Index(fields=['hospital', 'status']),
        ]
        ordering = ['ward__name', 'bed_number']

    def __str__(self):
        return f"{self.ward.name} — {self.bed_number}"

    @property
    def patient_name(self):
        if self.current_encounter and self.current_encounter.patient:
            return str(self.current_encounter.patient)
        return ''

    @property
    def days_occupied(self):
        if self.current_encounter and self.current_encounter.created_at:
            delta = timezone.now().date() - self.current_encounter.created_at.date()
            return max(delta.days, 1)
        return 0


class DailyRound(models.Model):
    """A doctor's daily round / order set for a patient.

    One round per patient per day (non-ICU). ICU allows multiple rounds
    per day, handled at the service layer.
    """
    ROUND_STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('finalised', 'Finalised'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        related_name='daily_rounds',
    )
    encounter = models.ForeignKey(
        'Encounter', on_delete=models.CASCADE,
        related_name='daily_rounds',
    )
    round_date = models.DateField(default=timezone.localdate)
    conducted_by = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='daily_rounds',
    )
    prescription = models.OneToOneField(
        'Prescription',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='daily_round',
        help_text='The prescription submitted for this round',
    )
    notes = models.TextField(
        blank=True, default='',
        help_text='Doctor\'s notes for this round',
    )
    status = models.CharField(
        max_length=20, choices=ROUND_STATUS_CHOICES, default='draft',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'medos_dailyround'
        unique_together = ['encounter', 'round_date']
        ordering = ['-round_date', '-created_at']
        indexes = [
            models.Index(fields=['encounter', '-round_date']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"Round {self.round_date} — {self.encounter} ({self.get_status_display()})"

    def finalise(self, prescription_instance=None):
        """Transition draft → finalised and link the prescription."""
        self.status = 'finalised'
        if prescription_instance:
            self.prescription = prescription_instance
        self.save(update_fields=['status', 'prescription'])


class NursingNote(models.Model):
    """A nursing note recorded for an admitted patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        related_name='nursing_notes',
    )
    encounter = models.ForeignKey(
        'Encounter', on_delete=models.CASCADE,
        related_name='nursing_notes',
    )
    recorded_by = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='nursing_notes',
    )
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'medos_nursingnote'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['encounter', '-created_at']),
        ]

    def __str__(self):
        return f"Nursing note by {self.recorded_by.get_full_name() or self.recorded_by.username} — {self.created_at.strftime('%d-%b %H:%M')}"


class MedicationAdministration(models.Model):
    """Records when a nurse actually administers a medication to a patient.

    Different from Dispensation (pharmacy gave it to the ward).
    This is the bedside confirmation: nurse → patient.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        related_name='medication_administrations',
    )
    encounter = models.ForeignKey(
        'Encounter', on_delete=models.CASCADE,
        related_name='medication_administrations',
    )
    medication = models.ForeignKey(
        'Medication', on_delete=models.CASCADE,
        related_name='administrations',
    )
    administered_by = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='medication_administrations',
    )
    administered_at = models.DateTimeField(default=timezone.now)
    dose_given = models.CharField(
        max_length=100, help_text='Actual dose given (e.g. 500mg, 1 tablet)',
    )
    route = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Route administered (Oral, IV, IM, etc.)',
    )
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'medos_medicationadministration'
        ordering = ['-administered_at']
        indexes = [
            models.Index(fields=['encounter', '-administered_at']),
            models.Index(fields=['medication']),
        ]

    def __str__(self):
        return f"{self.medication.drug_name} ({self.dose_given}) — {self.administered_at.strftime('%d-%b %H:%M')}"


class BillingAccrual(models.Model):
    """Daily automatic billing accrual for admitted patients.

    Created by Celery task at midnight for:
    - Bed charges (per ward rate)
    - Other recurring charges defined by the hospital
    """
    ACCRUAL_TYPE_CHOICES = [
        ('bed_charge', 'Bed Charge'),
        ('nursing_charge', 'Nursing Charge'),
        ('miscellaneous', 'Miscellaneous'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        related_name='billing_accruals',
    )
    encounter = models.ForeignKey(
        'Encounter', on_delete=models.CASCADE,
        related_name='billing_accruals',
    )
    accrual_type = models.CharField(
        max_length=30, choices=ACCRUAL_TYPE_CHOICES, default='bed_charge',
    )
    description = models.CharField(max_length=255)
    date = models.DateField(
        help_text='The date this charge applies to',
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    is_invoiced = models.BooleanField(
        default=False,
        help_text='Has this been included in an invoice yet?',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'medos_billingaccrual'
        unique_together = ['encounter', 'accrual_type', 'date']
        ordering = ['-date']
        indexes = [
            models.Index(fields=['encounter', 'is_invoiced']),
            models.Index(fields=['hospital', 'date']),
        ]

    def __str__(self):
        return f"{self.get_accrual_type_display()} — {self.description} — ₹{self.amount} ({self.date})"
