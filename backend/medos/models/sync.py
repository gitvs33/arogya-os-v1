"""Sync, reconciliation, and drug interaction models."""
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
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='sync_entries'
    )

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
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='reconciliation_logs'
    )

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
