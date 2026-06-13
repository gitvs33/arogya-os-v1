"""Settings models — per-hospital singleton configuration + CRUD entries."""
import uuid
from django.db import models


# ═══════════════════════════════════════════════════════════════════════════════
# Abstract base for per-hospital singleton settings
# ═══════════════════════════════════════════════════════════════════════════════


class SingletonSettingsBase(models.Model):
    """Abstract base for per-hospital singleton settings.

    Provides the common ``id``, ``created_at`` and ``updated_at`` columns.
    Each concrete model adds its own ``hospital`` OneToOneField (with a
    distinct ``related_name``) and domain-specific fields.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    def __str__(self):
        return self._meta.verbose_name.title()


# ── 1. Hospital Profile ─────────────────────────────────────────────────────


class HospitalProfile(SingletonSettingsBase):
    """Core hospital identity information.

    Now linked to a Hospital instead of being a singleton.
    """
    hospital = models.OneToOneField(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True, related_name='profile'
    )
    name = models.CharField(max_length=255, blank=True, default='')
    address = models.TextField(blank=True, default='')
    contact_email = models.EmailField(blank=True, default='')
    contact_phone = models.CharField(max_length=50, blank=True, default='')
    registration_number = models.CharField(max_length=100, blank=True, default='')
    logo_url = models.URLField(blank=True, default='')
    facilities = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name_plural = 'hospital profiles'

    def __str__(self):
        return self.name or 'Hospital Profile'


# ── 2. Module-Specific Settings ──────────────────────────────────────────────


class BillingSettings(SingletonSettingsBase):
    """Billing / invoicing configuration."""
    hospital = models.OneToOneField(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True, related_name='billing_settings'
    )
    tax_inclusive = models.BooleanField(default=False)
    auto_invoice_generation = models.BooleanField(default=False)
    allow_partial_payments = models.BooleanField(default=False)
    require_discount_approval = models.BooleanField(default=True)
    default_payment_terms_days = models.IntegerField(default=30)
    default_tax_rate = models.FloatField(default=0.0)
    acceptable_payment_methods = models.JSONField(
        default=list, blank=True
    )

    class Meta:
        verbose_name_plural = 'billing settings'

    def __str__(self):
        return 'Billing Settings'


class PharmacySettings(SingletonSettingsBase):
    """Pharmacy / inventory configuration."""
    hospital = models.OneToOneField(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True, related_name='pharmacy_settings'
    )
    auto_reorder_alerts = models.BooleanField(default=True)
    strict_expiry_enforcement = models.BooleanField(default=True)
    require_prescription_for_dispense = models.BooleanField(default=False)
    default_expiry_warning_days = models.IntegerField(default=60)
    minimum_stock_threshold_percent = models.FloatField(default=20.0)

    class Meta:
        verbose_name_plural = 'pharmacy settings'

    def __str__(self):
        return 'Pharmacy Settings'


class LaboratorySettings(SingletonSettingsBase):
    """Laboratory module configuration."""
    hospital = models.OneToOneField(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True, related_name='laboratory_settings'
    )
    auto_approve_normal_results = models.BooleanField(default=False)
    critical_value_sms_alerts = models.BooleanField(default=True)
    enable_external_portal = models.BooleanField(default=False)
    default_turnaround_time_hours = models.IntegerField(default=24)
    qc_check_frequency_per_week = models.IntegerField(default=1)

    class Meta:
        verbose_name_plural = 'laboratory settings'

    def __str__(self):
        return 'Laboratory Settings'


class TeleICUSettings(SingletonSettingsBase):
    """TeleICU / remote monitoring configuration."""
    hospital = models.OneToOneField(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True, related_name='teleicu_settings'
    )
    auto_record_consults = models.BooleanField(default=False)
    continuous_monitoring_sync = models.BooleanField(default=False)
    alert_escalation_to_oncall = models.BooleanField(default=True)
    vitals_refresh_rate_seconds = models.IntegerField(default=5)
    high_heart_rate_threshold = models.IntegerField(default=120)
    low_spo2_threshold = models.IntegerField(default=90)
    default_camera_quality = models.CharField(
        max_length=10, default='720p',
        choices=[('720p', '720p'), ('1080p', '1080p'), ('4K', '4K')]
    )

    class Meta:
        verbose_name_plural = 'teleicu settings'

    def __str__(self):
        return 'TeleICU Settings'


# ── 3. Notifications & Integrations ──────────────────────────────────────────


class NotificationSettings(SingletonSettingsBase):
    """SMS / Email gateway configuration and event triggers."""
    hospital = models.OneToOneField(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True, related_name='notification_settings'
    )
    sms_gateway_api_key = models.CharField(max_length=500, blank=True, default='')
    email_smtp_server = models.CharField(max_length=255, blank=True, default='')
    email_smtp_port = models.IntegerField(default=587)
    email_username = models.CharField(max_length=255, blank=True, default='')
    email_password = models.CharField(max_length=500, blank=True, default='')
    send_sms_on_booking = models.BooleanField(default=False)
    send_email_on_discharge = models.BooleanField(default=False)
    send_sms_for_critical_labs = models.BooleanField(default=False)
    send_email_for_daily_reports = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = 'notification settings'

    def __str__(self):
        return 'Notification Settings'


class IntegrationSetting(models.Model):
    """Per-integration connection configuration (PACS, LIS, NDHM, TPA, Payment)."""
    INTEGRATION_TYPES = [
        ('pacs', 'PACS'),
        ('lis', 'LIS'),
        ('ndhm', 'NDHM'),
        ('tpa', 'TPA'),
        ('payment', 'Payment Gateway'),
    ]

    id = models.CharField(
        primary_key=True, max_length=20, choices=INTEGRATION_TYPES
    )
    name = models.CharField(max_length=100, blank=True, default='')
    description = models.TextField(blank=True, default='')
    connected = models.BooleanField(default=False)
    client_id = models.CharField(max_length=500, blank=True, default='')
    client_secret = models.CharField(max_length=500, blank=True, default='')
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='integration_settings'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.get_id_display()} ({"connected" if self.connected else "disconnected"})'


class Webhook(models.Model):
    """Registered webhook endpoints."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    url = models.URLField()
    secret = models.CharField(max_length=500, blank=True, default='')
    events = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=20, default='active',
        choices=[('active', 'Active'), ('inactive', 'Inactive'), ('failing', 'Failing')]
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='webhooks'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.url


# ── 4. Data & Localization ───────────────────────────────────────────────────


class DataPolicySettings(SingletonSettingsBase):
    """Data retention, archiving, and export policies."""
    hospital = models.OneToOneField(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True, related_name='data_policy_settings'
    )
    clinical_retention_years = models.IntegerField(default=10)
    financial_retention_years = models.IntegerField(default=7)
    auto_archive_inactive_patients = models.BooleanField(default=False)
    anonymize_research_data = models.BooleanField(default=False)
    enable_daily_snapshots = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = 'data policy settings'

    def __str__(self):
        return 'Data Policy Settings'


class LocalizationSettings(SingletonSettingsBase):
    """Language, timezone, currency, and format preferences."""
    hospital = models.OneToOneField(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True, related_name='localization_settings'
    )
    default_language = models.CharField(max_length=50, default='English')
    timezone = models.CharField(max_length=100, default='Asia/Kolkata')
    default_currency = models.CharField(max_length=10, default='INR')
    date_format = models.CharField(max_length=20, default='DD/MM/YYYY')
    time_format = models.CharField(max_length=20, default='12-hour')
    multi_currency_support = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = 'localization settings'

    def __str__(self):
        return 'Localization Settings'


# ── 5. Templates ─────────────────────────────────────────────────────────────


class Template(models.Model):
    """Print / email template for generated documents."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    category = models.CharField(
        max_length=50,
        choices=[
            ('invoices', 'Invoices'),
            ('prescriptions', 'Prescriptions'),
            ('discharge_summaries', 'Discharge Summaries'),
            ('lab_reports', 'Lab Reports'),
        ]
    )
    content = models.TextField(blank=True, default='')
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='templates'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return f'{self.name} ({self.get_category_display()})'
