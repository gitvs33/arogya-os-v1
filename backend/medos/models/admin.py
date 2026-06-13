"""Admin / organisational models — system alerts, departments, security, etc."""
import uuid
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class AdminModule(models.Model):
    """Tracks the real-time operational status of system modules."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    STATUS_CHOICES = [
        ('Operational', 'Operational'),
        ('Degraded', 'Degraded'),
        ('Offline', 'Offline'),
    ]
    name = models.CharField(max_length=100, unique=True,
                            help_text='Machine name, e.g. emr, billing, pharmacy')
    label = models.CharField(max_length=100,
                             help_text='Human-readable name, e.g. EMR, Patient Registration')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES,
                              default='Operational')
    is_critical = models.BooleanField(default=False)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='admin_modules'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.label} ({self.status})'


class SystemAlert(models.Model):
    """System-level notifications (infrastructure, not medical alerts)."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('warning', 'Warning'),
        ('info', 'Info'),
        ('success', 'Success'),
    ]
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_alerts'
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='system_alerts'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.get_severity_display()}] {self.title}'


class UserLoginActivity(models.Model):
    """Tracks every user login for admin dashboard analytics."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='login_activities'
    )
    login_timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, default='')
    was_successful = models.BooleanField(default=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='login_activities'
    )

    class Meta:
        ordering = ['-login_timestamp']
        indexes = [
            models.Index(fields=['-login_timestamp']),
            models.Index(fields=['user', '-login_timestamp']),
        ]

    def __str__(self):
        return f'{self.user.username} @ {self.login_timestamp}'


class Department(models.Model):
    """Hospital department / ward."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20,
                            help_text='Short code, e.g. CARD, ORTH')
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    head_of_department = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='headed_departments'
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='departments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.code})'


class MasterDataEntry(models.Model):
    """Lookup table entries for dropdowns and config lists."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    category = models.CharField(
        max_length=100, db_index=True,
        help_text='e.g. specialty, encounter_type, room_type, visit_type'
    )
    key = models.CharField(max_length=100)
    value = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True,
                                help_text='Optional extra data')
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='master_data_entries'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('hospital', 'category', 'key')]
        ordering = ['category', 'display_order', 'key']
        verbose_name_plural = 'master data entries'

    def __str__(self):
        return f'{self.category}: {self.key} = {self.value}'


class SystemSetting(models.Model):
    """Key-value global application configuration."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    VALUE_TYPE_CHOICES = [
        ('string', 'String'),
        ('number', 'Number'),
        ('boolean', 'Boolean'),
        ('json', 'JSON'),
        ('email', 'Email'),
        ('url', 'URL'),
    ]
    CATEGORY_CHOICES = [
        ('general', 'General'),
        ('hospital', 'Hospital Info'),
        ('email', 'Email / SMTP'),
        ('security', 'Security'),
        ('billing', 'Billing'),
        ('appointment', 'Appointment'),
        ('notification', 'Notification'),
    ]
    key = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=200)
    value = models.JSONField(
        help_text='Stored as JSON; cast to value_type on read')
    value_type = models.CharField(
        max_length=20, choices=VALUE_TYPE_CHOICES, default='string')
    category = models.CharField(
        max_length=100, choices=CATEGORY_CHOICES, default='general')
    is_encrypted = models.BooleanField(default=False)
    description = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='system_settings'
    )

    class Meta:
        ordering = ['category', 'key']

    def __str__(self):
        return f'{self.key} = {self.value}'


class WorkflowDefinition(models.Model):
    """Defines a state machine workflow for a module (e.g. approval chains)."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    name = models.CharField(max_length=100)
    module = models.CharField(
        max_length=100,
        help_text='Target module, e.g. billing, pharmacy, lab')
    description = models.TextField(blank=True, default='')
    initial_state = models.CharField(max_length=100)
    states = models.JSONField(
        help_text='List of state objects: [{"name": "...", "label": "..."}]')
    transitions = models.JSONField(
        help_text='List of transition objects: '
                  '[{"from": "...", "to": "...", "action": "..."}]')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='workflow_definitions'
    )

    class Meta:
        unique_together = [('hospital', 'module', 'name')]
        ordering = ['module', 'name']

    def __str__(self):
        return f'{self.module}: {self.name}'


class DeviceIntegration(models.Model):
    """External hardware / device integration configuration."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    AUTH_CHOICES = [
        ('api_key', 'API Key'),
        ('basic', 'Basic Auth'),
        ('oauth', 'OAuth 2.0'),
        ('none', 'No Auth'),
    ]
    name = models.CharField(max_length=100)
    device_type = models.CharField(
        max_length=100,
        help_text='e.g. biometric_scanner, lab_machine, bedside_monitor')
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    port = models.IntegerField(blank=True, null=True)
    api_endpoint = models.URLField(blank=True, default='')
    auth_type = models.CharField(
        max_length=20, choices=AUTH_CHOICES, default='none')
    credentials = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='device_integrations'
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.device_type})'


class SecurityPolicy(models.Model):
    """Security configuration entries (password, 2FA, session, IP whitelist)."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    POLICY_TYPE_CHOICES = [
        ('password_policy', 'Password Policy'),
        ('two_factor', 'Two-Factor Authentication'),
        ('session', 'Session Timeout'),
        ('ip_whitelist', 'IP Whitelist'),
        ('login_attempts', 'Login Attempts Limit'),
    ]
    policy_type = models.CharField(
        max_length=50, unique=True, choices=POLICY_TYPE_CHOICES)
    settings = models.JSONField(
        default=dict,
        help_text='Policy-specific settings as JSON')
    is_enforced = models.BooleanField(default=True)
    description = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='security_policies'
    )

    class Meta:
        ordering = ['policy_type']

    def __str__(self):
        return f'{self.get_policy_type_display()}'


class BackupRecord(models.Model):
    """Tracks database backup operations."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    STATUS_CHOICES = [
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    TYPE_CHOICES = [
        ('MANUAL', 'Manual'),
        ('SCHEDULED', 'Scheduled'),
    ]
    backup_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='IN_PROGRESS')
    file_url = models.URLField(blank=True, default='')
    file_size_mb = models.FloatField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    triggered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    notes = models.TextField(blank=True, default='')
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='backup_records'
    )

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f'Backup {self.id} [{self.status}] @ {self.started_at}'


class LicenseInfo(models.Model):
    """Software license and subscription details."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    EDITION_CHOICES = [
        ('Community', 'Community'),
        ('Professional', 'Professional'),
        ('Enterprise', 'Enterprise'),
    ]
    edition = models.CharField(
        max_length=50, choices=EDITION_CHOICES, default='Enterprise')
    license_key = models.CharField(max_length=200, blank=True, default='')
    valid_from = models.DateField()
    valid_till = models.DateField()
    registered_modules = models.IntegerField(default=0)
    total_modules = models.IntegerField(default=0)
    active_users = models.IntegerField(default=0)
    user_limit = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='license_infos'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'license info'
        ordering = ['-valid_till']

    def __str__(self):
        return f'{self.edition} (till {self.valid_till})'


class StorageMetrics(models.Model):
    """Tracks database storage usage over time."""
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)
    storage_used_gb = models.FloatField(help_text='Used storage in GB')
    storage_total_gb = models.FloatField(help_text='Total capacity in GB')
    database_status = models.CharField(
        max_length=50, default='Healthy',
        help_text='e.g. Healthy, Degraded, Critical')
    last_backup = models.DateTimeField(null=True, blank=True)
    next_backup = models.DateTimeField(null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='storage_metrics'
    )

    class Meta:
        verbose_name_plural = 'storage metrics'
        ordering = ['-recorded_at']

    def __str__(self):
        pct = round(
            (self.storage_used_gb / self.storage_total_gb * 100)
            if self.storage_total_gb > 0 else 0, 1
        )
        return f'{pct}% used ({self.database_status})'
