"""Auth & Profile models."""
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


class Role(models.Model):
    """Staff role with permission scopes."""
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True, default='')
    permissions = models.JSONField(
        default=dict, blank=True,
        help_text='Permission scopes, e.g. {"patients": ["read", "write"]}'
    )
    is_active = models.BooleanField(default=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True, related_name='roles'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        unique_together = ['name', 'hospital']

    def __str__(self):
        return self.name


class HospitalUserProfile(models.Model):
    """Extended profile for hospital staff."""
    user = models.OneToOneField(
        User, on_delete=models.CASCADE,
        related_name='hospital_profile'
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='staff_profiles'
    )
    employee_id = models.CharField(
        max_length=50, unique=True, blank=True, null=True,
        help_text='Hospital employee ID'
    )
    role = models.ForeignKey(
        Role, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='profiles'
    )
    department = models.CharField(max_length=100, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    designation = models.CharField(max_length=100, blank=True, default='')
    must_change_password = models.BooleanField(default=True,
        help_text='User must reset password on next login')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee_id']),
        ]

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.employee_id or 'no ID'})"

    def get_role_snapshot_hash(self):
        """Generate SHA-256 hash of current user + role for offline signing."""
        role_name = self.role.name if self.role else 'none'
        perms_json = json.dumps(self.role.permissions, sort_keys=True) if self.role else '{}'
        raw = f"{self.user.id}:{role_name}:{perms_json}"
        return hashlib.sha256(raw.encode()).hexdigest()
