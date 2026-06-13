"""Patient demographic and insurance models."""
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


class Patient(models.Model):
    """Patient demographic record."""
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    MARITAL_STATUS_CHOICES = [
        ('SINGLE', 'Single'),
        ('MARRIED', 'Married'),
        ('DIVORCED', 'Divorced'),
        ('WIDOWED', 'Widowed'),
        ('OTHER', 'Other'),
    ]
    IDENTIFICATION_TYPE_CHOICES = [
        ('AADHAAR', 'Aadhaar'),
        ('PAN', 'PAN Card'),
        ('VOTER_ID', 'Voter ID'),
        ('PASSPORT', 'Passport'),
        ('DRIVING_LICENSE', 'Driving License'),
        ('OTHER', 'Other'),
    ]
    REGISTRATION_STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('COMPLETED', 'Completed'),
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

    # Registration wizard state (Step tracking)
    registration_status = models.CharField(
        max_length=20, choices=REGISTRATION_STATUS_CHOICES,
        default='DRAFT',
        help_text='Wizard state: Draft until all steps completed'
    )

    # Emergency Contact (Step 1)
    emergency_contact_name = models.CharField(
        max_length=200, blank=True, default=''
    )
    emergency_contact_relationship = models.CharField(
        max_length=100, blank=True, default=''
    )
    emergency_contact_phone = models.CharField(
        max_length=20, blank=True, default=''
    )
    emergency_contact_alternate_phone = models.CharField(
        max_length=20, blank=True, default=''
    )

    # Additional Basic Info (Step 1)
    marital_status = models.CharField(
        max_length=20, choices=MARITAL_STATUS_CHOICES,
        blank=True, default=''
    )
    nationality = models.CharField(
        max_length=100, blank=True, default=''
    )

    # Identification (Step 3)
    aadhaar_number = models.CharField(
        max_length=20, unique=True, null=True, blank=True,
        help_text='Aadhaar number (12 digits)'
    )
    pan_number = models.CharField(
        max_length=20, unique=True, null=True, blank=True,
        help_text='PAN card number'
    )
    identification_type = models.CharField(
        max_length=30, choices=IDENTIFICATION_TYPE_CHOICES,
        blank=True, default='',
        help_text='Type of government ID'
    )
    identification_number = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Government ID number'
    )

    # Address (Step 2 — structured)
    address = models.TextField(blank=True, default='')
    address_line1 = models.CharField(
        max_length=255, blank=True, default=''
    )
    address_line2 = models.CharField(
        max_length=255, blank=True, default=''
    )
    city = models.CharField(max_length=100, blank=True, default='')
    state = models.CharField(max_length=100, blank=True, default='')
    pincode = models.CharField(max_length=10, blank=True, default='')
    country = models.CharField(
        max_length=100, blank=True, default='India'
    )

    abha_id = models.CharField(
        max_length=50, blank=True, null=True,
        help_text="Ayushman Bharat Health Account ID"
    )
    blood_group = models.CharField(
        max_length=3, blank=True, default='',
        choices=[
            ('A+', 'A+'), ('A-', 'A-'),
            ('B+', 'B+'), ('B-', 'B-'),
            ('AB+', 'AB+'), ('AB-', 'AB-'),
            ('O+', 'O+'), ('O-', 'O-'),
        ],
        help_text='Blood group / type'
    )
    profile_picture = models.URLField(
        blank=True, default='',
        help_text='URL to patient profile photo'
    )
    insurance_provider = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Insurance / TPA provider name'
    )
    insurance_id = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Insurance / TPA policy number'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='patients_created'
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='patients'
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


class PatientInsurance(models.Model):
    """Insurance / TPA policy linked to a patient (Step 4 of registration)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE,
        related_name='insurance_policies'
    )
    provider_name = models.CharField(
        max_length=200,
        help_text='Insurance provider / TPA name'
    )
    policy_number = models.CharField(
        max_length=100,
        help_text='Policy number'
    )
    valid_upto = models.DateField(
        null=True, blank=True,
        help_text='Policy valid until date'
    )
    coverage_amount = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True,
        help_text='Coverage amount'
    )
    is_primary = models.BooleanField(
        default=False,
        help_text='Primary insurance policy'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='patient_insurances'
    )

    class Meta:
        indexes = [
            models.Index(fields=['patient', 'provider_name']),
        ]
        ordering = ['-is_primary', '-created_at']

    def __str__(self):
        return f"{self.provider_name} ({self.policy_number})"


class Allergy(models.Model):
    """Patient allergy / adverse reaction."""
    SEVERITY_CHOICES = [
        ('MILD', 'Mild'),
        ('MODERATE', 'Moderate'),
        ('SEVERE', 'Severe'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE,
        related_name='allergies'
    )
    allergen = models.CharField(max_length=200)
    reaction = models.TextField(blank=True, default='')
    severity = models.CharField(
        max_length=20, choices=SEVERITY_CHOICES, default='MILD'
    )
    onset_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    noted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='allergies'
    )

    class Meta:
        verbose_name_plural = 'Allergies'
        indexes = [
            models.Index(fields=['patient', 'allergen']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.allergen} ({self.get_severity_display()})"


class PatientDocument(models.Model):
    """Clinical document / attachment linked to a patient."""
    DOCUMENT_TYPES = [
        ('LAB_REPORT', 'Lab Report'),
        ('IMAGING_REPORT', 'Imaging Report'),
        ('PRESCRIPTION', 'Prescription'),
        ('CONSENT_FORM', 'Consent Form'),
        ('DISCHARGE_SUMMARY', 'Discharge Summary'),
        ('REFERRAL', 'Referral Letter'),
        ('VACCINATION', 'Vaccination Record'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE,
        related_name='documents'
    )
    encounter = models.ForeignKey(
        'Encounter', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='documents'
    )
    document_type = models.CharField(
        max_length=30, choices=DOCUMENT_TYPES, default='OTHER'
    )
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, default='')
    file_url = models.URLField(
        help_text='URL or path to uploaded document'
    )
    notes = models.TextField(blank=True, default='')
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_documents'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='patient_documents'
    )

    class Meta:
        indexes = [
            models.Index(fields=['patient', 'document_type']),
            models.Index(fields=['encounter']),
            models.Index(fields=['-uploaded_at']),
        ]
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.get_document_type_display()}: {self.title}"
