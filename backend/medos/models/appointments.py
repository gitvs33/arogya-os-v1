"""Appointment / scheduling models."""
import uuid
from datetime import date

from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Appointment(models.Model):
    """A scheduled patient appointment."""
    STATUS_CHOICES = [
        ('SCHEDULED', 'Scheduled'),
        ('CHECKED_IN', 'Checked In'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
        ('NO_SHOW', 'No Show'),
    ]
    APPOINTMENT_TYPES = [
        ('OPD', 'OPD Consultation'),
        ('FOLLOW_UP', 'Follow-up'),
        ('EMERGENCY', 'Emergency'),
        ('REVIEW', 'Review'),
        ('PROCEDURE', 'Procedure'),
        ('TELEMEDICINE', 'Telemedicine'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='appointments'
    )
    doctor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='doctor_appointments'
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_appointments'
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        related_name='appointments'
    )

    appointment_type = models.CharField(
        max_length=20, choices=APPOINTMENT_TYPES, default='OPD'
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='SCHEDULED'
    )

    appointment_date = models.DateField()
    appointment_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(default=15)

    department = models.CharField(max_length=100, blank=True, default='')
    reason = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')

    # Link to encounter once the appointment is started
    encounter = models.ForeignKey(
        'Encounter', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='source_appointment'
    )

    cancellation_reason = models.TextField(blank=True, default='')
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cancelled_appointments'
    )

    checked_in_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['appointment_date', 'doctor']),
            models.Index(fields=['patient', '-appointment_date']),
            models.Index(fields=['status']),
            models.Index(fields=['hospital', 'appointment_date']),
        ]
        ordering = ['appointment_date', 'appointment_time']

    def __str__(self):
        return f"{self.get_appointment_type_display()} - {self.patient} - {self.appointment_date}"

    def check_in(self):
        """Mark the appointment as checked in."""
        self.status = 'CHECKED_IN'
        self.checked_in_at = timezone.now()
        self.save(update_fields=['status', 'checked_in_at'])

    def start(self):
        """Start the appointment and create an encounter."""
        from .clinical import Encounter
        self.status = 'IN_PROGRESS'
        self.save(update_fields=['status'])

        encounter = Encounter.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.hospital,
            encounter_type=self.appointment_type,
            department=self.department,
            status='IN_PROGRESS',
            chief_complaint=self.reason,
            created_at=timezone.now(),
        )
        self.encounter = encounter
        self.save(update_fields=['encounter'])
        return encounter

    def cancel(self, reason='', cancelled_by=None):
        """Cancel the appointment."""
        self.status = 'CANCELLED'
        self.cancellation_reason = reason
        self.cancelled_at = timezone.now()
        self.cancelled_by = cancelled_by
        self.save(update_fields=[
            'status', 'cancellation_reason', 'cancelled_at', 'cancelled_by'
        ])
