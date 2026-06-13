"""TeleICU and tele-consultation models."""
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


class ICUWard(models.Model):
    """ICU ward / unit (e.g. Cardiac ICU, Neuro ICU)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, help_text='Ward name, e.g. Cardiac ICU')
    total_beds = models.IntegerField(default=0, help_text='Total number of beds in this ward')
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='icu_wards'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def available_beds(self):
        return self.beds.filter(status='AVAILABLE').count()

    @property
    def occupied_beds(self):
        return self.beds.filter(status='OCCUPIED').count()


class ICUBed(models.Model):
    """Individual bed in an ICU ward with camera feed and device info."""
    BED_STATUS_CHOICES = [
        ('AVAILABLE', 'Available'),
        ('OCCUPIED', 'Occupied'),
        ('MAINTENANCE', 'Maintenance'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ward = models.ForeignKey(
        ICUWard, on_delete=models.CASCADE,
        related_name='beds'
    )
    bed_number = models.CharField(
        max_length=20, help_text='Bed identifier, e.g. Bed-01'
    )
    status = models.CharField(
        max_length=20, choices=BED_STATUS_CHOICES, default='AVAILABLE'
    )
    camera_feed_url = models.URLField(
        blank=True, default='',
        help_text='RTSP / WebRTC URL for live camera feed'
    )
    device_ip = models.CharField(
        max_length=45, blank=True, default='',
        help_text='IP address of bedside monitor / hub'
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='icu_beds'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['ward', 'bed_number']
        indexes = [
            models.Index(fields=['ward', 'status']),
        ]
        ordering = ['ward__name', 'bed_number']

    def __str__(self):
        return f"{self.ward.name} — {self.bed_number}"


class TeleICUSession(models.Model):
    """Tracks an active ICU stay for a patient encounter."""
    ACUITY_CHOICES = [
        ('CRITICAL', 'Critical'),
        ('UNSTABLE', 'Unstable'),
        ('STABLE', 'Stable'),
    ]
    SUPPORT_CHOICES = [
        ('VENTILATOR', 'On Ventilator'),
        ('OXYGEN', 'On Oxygen'),
        ('ROOM_AIR', 'Room Air'),
        ('BIPAP', 'On BiPAP'),
        ('CPAP', 'On CPAP'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    encounter = models.OneToOneField(
        'Encounter', on_delete=models.CASCADE,
        related_name='teleicu_session'
    )
    bed = models.ForeignKey(
        ICUBed, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sessions'
    )
    acuity_status = models.CharField(
        max_length=20, choices=ACUITY_CHOICES, default='STABLE'
    )
    support_type = models.CharField(
        max_length=20, choices=SUPPORT_CHOICES, blank=True, default=''
    )
    is_active = models.BooleanField(default=True)
    admitted_at = models.DateTimeField(auto_now_add=True)
    discharged_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='teleicu_sessions'
    )

    class Meta:
        indexes = [
            models.Index(fields=['is_active', 'acuity_status']),
            models.Index(fields=['bed']),
        ]
        ordering = ['-admitted_at']

    def __str__(self):
        return f"ICU {self.get_acuity_status_display()} — {self.encounter.patient}"

    @property
    def patient(self):
        return self.encounter.patient


class TeleConsultSession(models.Model):
    """Tele-consultation session (video or audio call)."""
    CALL_TYPE_CHOICES = [
        ('VIDEO', 'Video Call'),
        ('AUDIO', 'Audio Call'),
    ]
    CONSULT_STATUS_CHOICES = [
        ('SCHEDULED', 'Scheduled'),
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='tele_consults'
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='tele_consults'
    )
    encounter = models.ForeignKey(
        'Encounter', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tele_consults'
    )
    specialty = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Specialty requested, e.g. Cardiology'
    )
    call_type = models.CharField(
        max_length=10, choices=CALL_TYPE_CHOICES, default='VIDEO'
    )
    status = models.CharField(
        max_length=20, choices=CONSULT_STATUS_CHOICES, default='SCHEDULED'
    )
    meeting_link = models.URLField(
        blank=True, default='',
        help_text='WebRTC / Zoom / Jitsi meeting link'
    )
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='teleconsult_sessions'
    )

    class Meta:
        indexes = [
            models.Index(fields=['status', 'specialty']),
            models.Index(fields=['patient', '-created_at']),
            models.Index(fields=['doctor', '-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_call_type_display()} — {self.specialty or 'General'} ({self.get_status_display()})"
