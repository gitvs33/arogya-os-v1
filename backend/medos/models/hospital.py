"""Hospital (tenant) model — the organisational root."""
import uuid
from django.db import models


class Hospital(models.Model):
    """The core tenant — each hospital is a separate organisation.

    MedOS super admin (your company) creates these via Django admin.
    Hospital admins then manage their own staff inside the OS.
    """
    class Plan(models.TextChoices):
        BASIC = 'basic', 'Basic'
        PROFESSIONAL = 'professional', 'Professional'
        ENTERPRISE = 'enterprise', 'Enterprise'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text='Hospital / organisation name')
    slug = models.SlugField(unique=True, help_text='Used in subdomain, e.g. citycare.medos.com')

    # Contact
    address = models.TextField(blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    logo_url = models.URLField(blank=True, default='')
    registration_number = models.CharField(max_length=100, blank=True, default='')

    # Subscription
    plan = models.CharField(max_length=20, choices=Plan.choices, default=Plan.BASIC)
    is_active = models.BooleanField(default=True, help_text='Deactivated = subscription expired / disabled')
    subscription_expires_at = models.DateTimeField(null=True, blank=True)

    # Legacy migration helpers
    license_key = models.CharField(max_length=200, blank=True, default='')
    user_limit = models.IntegerField(default=0, help_text='Max allowed users (0 = unlimited)')

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True  # explicit — this project owns the medos_hospital table
        ordering = ['name']
        verbose_name_plural = 'hospitals'

    def __str__(self) -> str:
        return self.name

    @property
    def is_expired(self) -> bool:
        if self.subscription_expires_at is None:
            return False
        from django.utils import timezone
        return timezone.now() > self.subscription_expires_at
