from rest_framework import serializers
from .settings_models import (
    HospitalProfile,
    BillingSettings,
    PharmacySettings,
    LaboratorySettings,
    TeleICUSettings,
    NotificationSettings,
    IntegrationSetting,
    Webhook,
    DataPolicySettings,
    LocalizationSettings,
    Template,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Settings serializers
#
# Each serializer maps camelCase field names (matching the frontend’s TypeScript
# interfaces) to snake_case model fields using DRF's built-in ``source=``.
# No manual to_internal_value / to_representation remapping needed.
# ═══════════════════════════════════════════════════════════════════════════════


# ── 1. Hospital Profile ─────────────────────────────────────────────────────


class HospitalProfileSerializer(serializers.ModelSerializer):
    registrationNumber = serializers.CharField(
        source='registration_number', required=False, default=''
    )
    contactEmail = serializers.CharField(
        source='contact_email', required=False, default=''
    )
    contactPhone = serializers.CharField(
        source='contact_phone', required=False, default=''
    )
    logoUrl = serializers.URLField(
        source='logo_url', required=False, allow_blank=True, default=''
    )

    class Meta:
        model = HospitalProfile
        fields = [
            'id', 'name', 'address', 'registrationNumber',
            'contactEmail', 'contactPhone', 'logoUrl', 'facilities',
        ]
        read_only_fields = ['id']


# ── 2. Module-Specific Settings ──────────────────────────────────────────────


class BillingSettingsSerializer(serializers.ModelSerializer):
    taxInclusion = serializers.BooleanField(source='tax_inclusive', required=False)
    automaticInvoiceGeneration = serializers.BooleanField(
        source='auto_invoice_generation', required=False
    )
    allowPartialPayments = serializers.BooleanField(
        source='allow_partial_payments', required=False
    )
    requireApprovalForDiscounts = serializers.BooleanField(
        source='require_discount_approval', required=False
    )
    defaultPaymentTerms = serializers.IntegerField(
        source='default_payment_terms_days', required=False
    )
    defaultTaxRate = serializers.FloatField(
        source='default_tax_rate', required=False
    )
    acceptablePaymentMethods = serializers.JSONField(
        source='acceptable_payment_methods', required=False
    )

    class Meta:
        model = BillingSettings
        fields = [
            'id', 'taxInclusion', 'automaticInvoiceGeneration',
            'allowPartialPayments', 'requireApprovalForDiscounts',
            'defaultPaymentTerms', 'defaultTaxRate',
            'acceptablePaymentMethods',
        ]
        read_only_fields = ['id']


class PharmacySettingsSerializer(serializers.ModelSerializer):
    autoReorderAlerts = serializers.BooleanField(
        source='auto_reorder_alerts', required=False
    )
    strictExpiryEnforcement = serializers.BooleanField(
        source='strict_expiry_enforcement', required=False
    )
    requirePrescriptionForAll = serializers.BooleanField(
        source='require_prescription_for_dispense', required=False
    )
    defaultExpiryWarningDays = serializers.IntegerField(
        source='default_expiry_warning_days', required=False
    )
    minStockThresholdPercent = serializers.FloatField(
        source='minimum_stock_threshold_percent', required=False
    )

    class Meta:
        model = PharmacySettings
        fields = [
            'id', 'autoReorderAlerts', 'strictExpiryEnforcement',
            'requirePrescriptionForAll', 'defaultExpiryWarningDays',
            'minStockThresholdPercent',
        ]
        read_only_fields = ['id']


class LaboratorySettingsSerializer(serializers.ModelSerializer):
    autoApproveNormalResults = serializers.BooleanField(
        source='auto_approve_normal_results', required=False
    )
    criticalValueSmsAlerts = serializers.BooleanField(
        source='critical_value_sms_alerts', required=False
    )
    enableExternalPortalAccess = serializers.BooleanField(
        source='enable_external_portal', required=False
    )
    defaultTurnaroundTimeHours = serializers.IntegerField(
        source='default_turnaround_time_hours', required=False
    )
    qualityControlCheckFreq = serializers.IntegerField(
        source='qc_check_frequency_per_week', required=False
    )

    class Meta:
        model = LaboratorySettings
        fields = [
            'id', 'autoApproveNormalResults', 'criticalValueSmsAlerts',
            'enableExternalPortalAccess', 'defaultTurnaroundTimeHours',
            'qualityControlCheckFreq',
        ]
        read_only_fields = ['id']


class TeleICUSettingsSerializer(serializers.ModelSerializer):
    autoRecordVideoConsults = serializers.BooleanField(
        source='auto_record_consults', required=False
    )
    enableContinuousBedsideMonitoringSync = serializers.BooleanField(
        source='continuous_monitoring_sync', required=False
    )
    alertEscalationToOnCallDoctor = serializers.BooleanField(
        source='alert_escalation_to_oncall', required=False
    )
    defaultVitalsRefreshRate = serializers.IntegerField(
        source='vitals_refresh_rate_seconds', required=False
    )
    highHeartRateAlertThreshold = serializers.IntegerField(
        source='high_heart_rate_threshold', required=False
    )
    lowSpO2AlertThreshold = serializers.IntegerField(
        source='low_spo2_threshold', required=False
    )
    defaultCameraQuality = serializers.CharField(
        source='default_camera_quality', required=False
    )

    class Meta:
        model = TeleICUSettings
        fields = [
            'id', 'autoRecordVideoConsults',
            'enableContinuousBedsideMonitoringSync',
            'alertEscalationToOnCallDoctor', 'defaultVitalsRefreshRate',
            'highHeartRateAlertThreshold', 'lowSpO2AlertThreshold',
            'defaultCameraQuality',
        ]
        read_only_fields = ['id']


# ── 3. Notifications & Integrations ──────────────────────────────────────────


class NotificationSettingsSerializer(serializers.ModelSerializer):
    smsGatewayApiKey = serializers.CharField(
        source='sms_gateway_api_key', required=False, default=''
    )
    emailSmtpServer = serializers.CharField(
        source='email_smtp_server', required=False, default=''
    )
    emailSmtpPort = serializers.IntegerField(
        source='email_smtp_port', required=False
    )
    emailUsername = serializers.CharField(
        source='email_username', required=False, default=''
    )
    emailPassword = serializers.CharField(
        source='email_password', required=False, default='',
        write_only=True
    )
    sendSmsOnAppointmentBooking = serializers.BooleanField(
        source='send_sms_on_booking', required=False
    )
    sendEmailOnDischarge = serializers.BooleanField(
        source='send_email_on_discharge', required=False
    )
    sendSmsForCriticalLabResults = serializers.BooleanField(
        source='send_sms_for_critical_labs', required=False
    )
    sendEmailForDailyReports = serializers.BooleanField(
        source='send_email_for_daily_reports', required=False
    )

    class Meta:
        model = NotificationSettings
        fields = [
            'id', 'smsGatewayApiKey', 'emailSmtpServer', 'emailSmtpPort',
            'emailUsername', 'emailPassword',
            'sendSmsOnAppointmentBooking', 'sendEmailOnDischarge',
            'sendSmsForCriticalLabResults', 'sendEmailForDailyReports',
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data.pop('email_password', None)
        return data


class IntegrationSettingSerializer(serializers.ModelSerializer):
    clientId = serializers.CharField(
        source='client_id', required=False, default=''
    )
    clientSecret = serializers.CharField(
        source='client_secret', required=False, default='', write_only=True
    )

    class Meta:
        model = IntegrationSetting
        fields = [
            'id', 'name', 'connected', 'clientId', 'clientSecret',
            'description',
        ]
        read_only_fields = ['id', 'name', 'description']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data.pop('clientSecret', None)
        return data


# ── Webhooks ─────────────────────────────────────────────────────────────────


class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = ['id', 'url', 'secret', 'events', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'secret': {'write_only': True},
        }


# ── 4. Data & Localization ───────────────────────────────────────────────────


class DataPolicySettingsSerializer(serializers.ModelSerializer):
    clinicalRecordsRetentionYears = serializers.IntegerField(
        source='clinical_retention_years', required=False
    )
    financialRecordsRetentionYears = serializers.IntegerField(
        source='financial_retention_years', required=False
    )
    autoArchiveInactivePatients = serializers.BooleanField(
        source='auto_archive_inactive_patients', required=False
    )
    anonymizeDataForResearch = serializers.BooleanField(
        source='anonymize_research_data', required=False
    )
    enableDailySnapshots = serializers.BooleanField(
        source='enable_daily_snapshots', required=False
    )

    class Meta:
        model = DataPolicySettings
        fields = [
            'id', 'clinicalRecordsRetentionYears',
            'financialRecordsRetentionYears',
            'autoArchiveInactivePatients', 'anonymizeDataForResearch',
            'enableDailySnapshots',
        ]
        read_only_fields = ['id']


class LocalizationSettingsSerializer(serializers.ModelSerializer):
    defaultLanguage = serializers.CharField(
        source='default_language', required=False, default='English'
    )
    defaultCurrency = serializers.CharField(
        source='default_currency', required=False, default='INR'
    )
    dateFormat = serializers.CharField(
        source='date_format', required=False, default='DD/MM/YYYY'
    )
    timeFormat = serializers.CharField(
        source='time_format', required=False, default='12-hour'
    )
    enableMultiCurrency = serializers.BooleanField(
        source='multi_currency_support', required=False
    )

    class Meta:
        model = LocalizationSettings
        fields = [
            'id', 'defaultLanguage', 'timezone', 'defaultCurrency',
            'dateFormat', 'timeFormat', 'enableMultiCurrency',
        ]
        read_only_fields = ['id']

    def to_internal_value(self, data):
        """Accept both camelCase AND snake_case keys (the frontend sends both)."""
        remap = {
            'defaultLanguage': 'default_language',
            'defaultCurrency': 'default_currency',
            'dateFormat': 'date_format',
            'timeFormat': 'time_format',
            'enableMultiCurrency': 'multi_currency_support',
        }
        for camel, snake in remap.items():
            if camel in data and snake not in data:
                data[snake] = data.pop(camel)
        return super().to_internal_value(data)


# ── 5. Templates ─────────────────────────────────────────────────────────────


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = ['id', 'name', 'category', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']
