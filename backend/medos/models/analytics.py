"""Analytics, reporting, and activity log models."""
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


class SystemActivityLog(models.Model):
    """Unified chronological activity log for TeleICU events."""
    EVENT_TYPE_CHOICES = [
        ('VITALS_UPDATE', 'Vitals Update'),
        ('VENT_SETTINGS', 'Vent Settings'),
        ('LAB_REPORT', 'Lab Report'),
        ('MEDICATION', 'Medication'),
        ('ALERT', 'Alert'),
        ('CONSULT', 'Consultation'),
        ('ADMISSION', 'Admission'),
        ('DISCHARGE', 'Discharge'),
        ('SYSTEM', 'System Event'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        null=True, blank=True, related_name='activity_logs'
    )
    encounter = models.ForeignKey(
        'Encounter', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='activity_logs'
    )
    event_type = models.CharField(
        max_length=30, choices=EVENT_TYPE_CHOICES, default='SYSTEM'
    )
    description = models.TextField(blank=True, default='')
    author_name = models.CharField(
        max_length=200, blank=True, default='System',
        help_text='Display name of the person/system that triggered the event'
    )
    metadata = models.JSONField(
        default=dict, blank=True,
        help_text='Additional structured data about the event'
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='activity_logs'
    )

    class Meta:
        indexes = [
            models.Index(fields=['patient', '-timestamp']),
            models.Index(fields=['event_type']),
            models.Index(fields=['-timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.get_event_type_display()}] {self.description[:60]}"


class ReportDefinition(models.Model):
    """Master list of available report types (template catalog)."""
    CATEGORY_CHOICES = [
        ('BILLING', 'Billing'),
        ('EMR', 'EMR'),
        ('PHARMACY', 'Pharmacy'),
        ('LABORATORY', 'Laboratory'),
        ('OPERATIONS', 'Operations'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, help_text='e.g., "Daily Revenue Report", "Weekly Clinical Summary"')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    description = models.TextField(blank=True, default='')
    supported_formats = models.JSONField(default=list, blank=True, help_text='e.g. ["pdf", "excel", "csv"]')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return self.name


class GeneratedReport(models.Model):
    """Tracks reports that have been generated (Powers Recent Reports table)."""
    FORMAT_CHOICES = [
        ('PDF', 'PDF'),
        ('EXCEL', 'Excel'),
        ('CSV', 'CSV'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_definition = models.ForeignKey(
        ReportDefinition, on_delete=models.CASCADE,
        related_name='generated_reports'
    )
    generated_on = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    parameters_used = models.JSONField(default=dict, blank=True, help_text='Date range, filters applied')
    format_type = models.CharField(max_length=10, choices=FORMAT_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    file_url = models.URLField(blank=True, default='', help_text='Link to S3/Storage')
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='generated_reports'
    )

    class Meta:
        ordering = ['-generated_on']

    def __str__(self):
        return f"{self.report_definition.name} ({self.get_format_type_display()}) — {self.get_status_display()}"


class ScheduledReport(models.Model):
    """Tracks automated report subscriptions (Powers Scheduled Reports widget)."""
    FREQUENCY_CHOICES = [
        ('DAILY', 'Daily'),
        ('WEEKLY', 'Weekly'),
        ('MONTHLY', 'Monthly'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_definition = models.ForeignKey(
        ReportDefinition, on_delete=models.CASCADE,
        related_name='scheduled_reports'
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='scheduled_reports'
    )
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    schedule_time = models.TimeField(help_text='e.g. 09:00:00')
    recipients = models.JSONField(default=list, blank=True, help_text='List of email addresses')
    is_active = models.BooleanField(default=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='scheduled_reports'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.report_definition.name} — {self.get_frequency_display()} ({'Active' if self.is_active else 'Inactive'})"


class SavedDashboardView(models.Model):
    """Allows users to save their filter presets."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='saved_dashboard_views'
    )
    view_name = models.CharField(max_length=200)
    filters = models.JSONField(default=dict, blank=True, help_text='Saved state of date range, locations, departments, etc.')
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='saved_dashboard_views'
    )

    class Meta:
        ordering = ['-is_pinned', '-updated_at']
        unique_together = ['user', 'view_name']

    def __str__(self):
        return f"{self.view_name} ({'Pinned' if self.is_pinned else 'Unpinned'})"


class AIInsight(models.Model):
    """Pre-computed insights generated by background AI/Analytics jobs."""
    INSIGHT_TYPES = [
        ('REVENUE', 'Revenue'),
        ('OCCUPANCY', 'Occupancy'),
        ('LAB_BACKLOG', 'Lab Backlog'),
        ('READMISSION_RISK', 'Readmission Risk'),
        ('BILLING_ANOMALY', 'Billing Anomaly'),
        ('TAT_BREACH', 'TAT Breach'),
        ('UTILIZATION', 'Utilization'),
    ]
    SEVERITY_CHOICES = [
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('CRITICAL', 'Critical'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    insight_type = models.CharField(max_length=30, choices=INSIGHT_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='INFO')
    metadata = models.JSONField(default=dict, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='ai_insights'
    )

    class Meta:
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['insight_type']),
            models.Index(fields=['severity']),
            models.Index(fields=['-generated_at']),
        ]

    def __str__(self):
        return f"[{self.get_severity_display()}] {self.title}"
