"""
Django admin configuration — multi-tenant aware.

MedOS superusers see ALL hospitals' data (set ``is_superuser=True``).
Hospital-specific admins (``is_staff=True`` but not superuser) automatically
see only their own hospital's data via ``HospitalScopedAdminMixin``.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.http import HttpResponseRedirect
from django.urls import reverse
from .models import (
    ClinicalNote, Patient, PatientInsurance, Encounter, Vitals, Medication,
    SyncEntry, ReconciliationLog, DrugInteraction, Invoice, InvoiceLineItem,
    MedicalAlert, Role, HospitalUserProfile, LabResult,
    Allergy, Diagnosis, ServiceOrder, ImagingResult,
    PatientDocument, CarePlan,
    Payment, RefundRequest, InsuranceClaim,
    ICUWard, ICUBed, TeleICUSession, TeleConsultSession, SystemActivityLog,
    TestPanel, TestParameter, LabOrder, LabParameterResult,
    LabDocument, QCEntry, LabInventory, LabAlert,
)
from .models import (
    Hospital, AdminModule, BackupRecord, Department, DeviceIntegration,
    LicenseInfo, MasterDataEntry, SecurityPolicy, StorageMetrics,
    SystemAlert, SystemSetting, UserLoginActivity, WorkflowDefinition,
)
from .settings_models import (
    HospitalProfile, BillingSettings, PharmacySettings,
    LaboratorySettings, TeleICUSettings, NotificationSettings,
    IntegrationSetting, Webhook, DataPolicySettings,
    LocalizationSettings, Template,
)

User = get_user_model()

# ── Admin branding ───────────────────────────────────────────
admin.site.site_header = 'MedOS Operations'
admin.site.site_title = 'MedOS Admin'
admin.site.index_title = 'Hospital Management'

# Unregister Group — we use our own Role model
admin.site.unregister(Group)


# ═══════════════════════════════════════════════════════════════════════════════
#  HOSPITAL-SCOPING MIXIN
# ═══════════════════════════════════════════════════════════════════════════════


def get_user_hospital(request):
    """Return the Hospital for a non-superuser staff member, or None."""
    if not request.user.is_authenticated:
        return None
    if request.user.is_superuser:
        return None  # superuser sees all
    profile = getattr(request.user, 'hospital_profile', None)
    return profile.hospital if profile else None


class HospitalScopedAdminMixin:
    """Mixin that auto-filters queryset by hospital for non-superusers.

    Usage::

        @admin.register(Patient)
        class PatientAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
            ...

    Superusers see everything.  Hospital staff see only their hospital's rows.
    """

    # Override in subclass to point to the correct hospital FK lookup.
    # Can be a direct field name like ``'hospital'`` or a relation like
    # ``'encounter__hospital'``.
    hospital_field = 'hospital'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        hospital = get_user_hospital(request)
        if hospital is not None:
            qs = qs.filter(**{self.hospital_field: hospital})
        return qs

    def has_change_permission(self, request, obj=None):
        """Hospital-staff can only change objects belonging to their hospital."""
        if obj is None:
            return super().has_change_permission(request, obj)
        hospital = get_user_hospital(request)
        if hospital is not None:
            obj_hospital = getattr(obj, self.hospital_field.split('__')[0], None)
            if isinstance(obj_hospital, property):
                return super().has_change_permission(request, obj)
            if obj_hospital and obj_hospital.pk != hospital.pk:
                return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if obj is None:
            return super().has_delete_permission(request, obj)
        hospital = get_user_hospital(request)
        if hospital is not None:
            obj_hospital = getattr(obj, self.hospital_field.split('__')[0], None)
            if obj_hospital and obj_hospital.pk != hospital.pk:
                return False
        return super().has_delete_permission(request, obj)

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        hospital = get_user_hospital(request)
        if hospital is not None and 'hospital' in form.base_fields:
            form.base_fields['hospital'].initial = hospital
            form.base_fields['hospital'].disabled = True
        return form

    def save_model(self, request, obj, form, change):
        hospital = get_user_hospital(request)
        if hospital is not None and hasattr(obj, 'hospital_id') and not obj.hospital_id:
            obj.hospital = hospital
        super().save_model(request, obj, form, change)

    def get_list_display(self, request):
        """Append hospital column for superusers."""
        fields = list(super().get_list_display(request))
        if request.user.is_superuser and 'hospital' not in fields and \
           hasattr(self.model, 'hospital'):
            # Check it's actually a FK, not some other field
            field = self.model._meta.get_field('hospital')
            if field.is_relation:
                fields.append('hospital')
        return fields

    def get_list_filter(self, request):
        filters = list(super().get_list_filter(request))
        if request.user.is_superuser and \
           'hospital' not in filters and \
           hasattr(self.model, 'hospital'):
            field = self.model._meta.get_field('hospital')
            if field.is_relation:
                filters.append('hospital')
        return filters


# ═══════════════════════════════════════════════════════════════════════════════
#  HOSPITAL ADMIN  (MedOS team manages tenants here)
# ═══════════════════════════════════════════════════════════════════════════════


class HospitalUserInline(admin.TabularInline):
    model = HospitalUserProfile
    extra = 0
    fields = ['user', 'employee_id', 'role', 'department', 'designation', 'is_active']
    autocomplete_fields = ['user', 'role']
    readonly_fields = ['is_active']
    can_delete = False
    verbose_name = 'Staff Member'
    verbose_name_plural = 'Staff Members'


class HospitalRoleInline(admin.TabularInline):
    model = Role
    extra = 0
    fields = ['name', 'is_active', 'created_at']
    readonly_fields = ['created_at']
    can_delete = False
    verbose_name = 'Role'
    verbose_name_plural = 'Roles'


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'slug', 'plan', 'is_active', 'user_limit',
        'subscription_expires_at', 'created_at'
    ]
    list_filter = ['plan', 'is_active']
    search_fields = ['name', 'slug', 'email']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['id', 'created_at', 'updated_at']
    fieldsets = [
        (None, {
            'fields': ['name', 'slug', 'is_active']
        }),
        ('Contact', {
            'fields': ['address', 'phone', 'email', 'logo_url', 'registration_number']
        }),
        ('Subscription', {
            'fields': ['plan', 'subscription_expires_at', 'license_key', 'user_limit']
        }),
        ('Metadata', {
            'fields': ['id', 'created_at', 'updated_at'],
            'classes': ['collapse']
        }),
    ]
    inlines = [HospitalUserInline, HospitalRoleInline]

    actions = ['activate_hospitals', 'deactivate_hospitals', 'extend_subscription']

    @admin.action(description='Activate selected hospitals')
    def activate_hospitals(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} hospital(s) activated.')

    @admin.action(description='Deactivate selected hospitals')
    def deactivate_hospitals(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} hospital(s) deactivated.')

    @admin.action(description='Extend subscription by 1 year')
    def extend_subscription(self, request, queryset):
        from datetime import timedelta
        from django.utils import timezone
        for h in queryset:
            if h.subscription_expires_at:
                h.subscription_expires_at += timedelta(days=365)
            else:
                h.subscription_expires_at = timezone.now() + timedelta(days=365)
            h.save(update_fields=['subscription_expires_at'])
        self.message_user(request, f'{queryset.count()} subscription(s) extended.')


# ═══════════════════════════════════════════════════════════════════════════════
#  PATIENT / ENCOUNTER
# ═══════════════════════════════════════════════════════════════════════════════


@admin.register(Patient)
class PatientAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['full_name', 'phone', 'gender', 'age', 'city', 'is_active', 'created_at']
    list_filter = ['gender', 'is_active', 'city']
    search_fields = ['first_name', 'last_name', 'phone', 'hospital_patient_id']
    date_hierarchy = 'created_at'
    hospital_field = 'hospital'

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)
        if request.user.is_superuser:
            return fieldsets
        # Hide hospital from non-superusers
        return [
            (title, {
                'fields': [f for f in opts['fields'] if f != 'hospital'],
                'classes': opts.get('classes', []),
            })
            for title, opts in fieldsets
        ] if obj else fieldsets


@admin.register(Encounter)
class EncounterAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['patient', 'encounter_type', 'status', 'doctor', 'department', 'created_at']
    list_filter = ['status', 'encounter_type', 'department']
    search_fields = ['patient__first_name', 'patient__last_name', 'chief_complaint']
    date_hierarchy = 'created_at'
    hospital_field = 'hospital'


class VitalsInline(admin.TabularInline):
    model = Vitals
    extra = 0


class MedicationInline(admin.TabularInline):
    model = Medication
    extra = 0


# ── Patient Summary Models ────────────────────────────────────────────────────


@admin.register(Allergy)
class AllergyAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['allergen', 'patient', 'severity', 'is_active', 'created_at']
    list_filter = ['severity', 'is_active']
    search_fields = ['allergen', 'patient__first_name', 'patient__last_name']


@admin.register(Diagnosis)
class DiagnosisAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['condition_name', 'icd10_code', 'patient', 'status', 'onset_date']
    list_filter = ['status']
    search_fields = ['condition_name', 'icd10_code', 'patient__first_name']
    hospital_field = 'hospital'


class ServiceOrderInline(admin.TabularInline):
    model = ServiceOrder
    extra = 0
    fields = ['order_name', 'category', 'status', 'ordered_by', 'ordered_at']


@admin.register(ServiceOrder)
class ServiceOrderAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['order_name', 'patient', 'encounter', 'category', 'status', 'ordered_at']
    list_filter = ['category', 'status']
    search_fields = ['order_name', 'patient__first_name', 'patient__last_name']
    date_hierarchy = 'ordered_at'


@admin.register(ImagingResult)
class ImagingResultAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['title', 'modality', 'patient', 'status', 'ordered_by', 'ordered_at']
    list_filter = ['modality', 'status']
    search_fields = ['title', 'findings', 'patient__first_name']
    date_hierarchy = 'ordered_at'


@admin.register(PatientDocument)
class PatientDocumentAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['title', 'document_type', 'patient', 'encounter', 'uploaded_by', 'uploaded_at']
    list_filter = ['document_type']
    search_fields = ['title', 'patient__first_name', 'patient__last_name']
    date_hierarchy = 'uploaded_at'


@admin.register(CarePlan)
class CarePlanAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['title', 'patient', 'status', 'start_date', 'end_date', 'created_at']
    list_filter = ['status']
    search_fields = ['title', 'patient__first_name', 'patient__last_name']
    date_hierarchy = 'created_at'


# ── Patient Insurance ──────────────────────────────────────────────────────────


@admin.register(PatientInsurance)
class PatientInsuranceAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['patient', 'provider_name', 'policy_number', 'valid_upto', 'is_primary']
    list_filter = ['provider_name', 'is_primary']
    search_fields = ['patient__first_name', 'patient__last_name', 'policy_number']
    date_hierarchy = 'created_at'


# ═══════════════════════════════════════════════════════════════════════════════
#  BILLING
# ═══════════════════════════════════════════════════════════════════════════════


@admin.register(Invoice)
class InvoiceAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['invoice_number', 'patient', 'invoice_type', 'status', 'total', 'created_at']
    list_filter = ['status', 'invoice_type']
    search_fields = ['invoice_number', 'patient__first_name']
    date_hierarchy = 'created_at'


class InvoiceLineItemInline(admin.TabularInline):
    model = InvoiceLineItem
    extra = 1


@admin.register(Payment)
class PaymentAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['receipt_number', 'invoice', 'amount', 'payment_method', 'status', 'transaction_time']
    list_filter = ['payment_method', 'status']
    search_fields = ['receipt_number', 'invoice__invoice_number']
    date_hierarchy = 'transaction_time'


@admin.register(RefundRequest)
class RefundRequestAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['refund_number', 'invoice', 'amount', 'status', 'requested_at', 'approved_by']
    list_filter = ['status']
    search_fields = ['refund_number', 'invoice__invoice_number']
    date_hierarchy = 'requested_at'


@admin.register(InsuranceClaim)
class InsuranceClaimAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['claim_number', 'invoice', 'insurance_provider', 'claimed_amount', 'status', 'submitted_at']
    list_filter = ['status', 'insurance_provider']
    search_fields = ['claim_number', 'insurance_provider', 'invoice__invoice_number']
    date_hierarchy = 'submitted_at'


# ═══════════════════════════════════════════════════════════════════════════════
#  CLINICAL / LAB
# ═══════════════════════════════════════════════════════════════════════════════


@admin.register(LabResult)
class LabResultAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['test_name', 'encounter', 'category', 'status', 'ordered_by', 'ordered_at']
    list_filter = ['status', 'category']
    search_fields = ['test_name', 'encounter__id', 'encounter__patient__first_name']
    date_hierarchy = 'ordered_at'


@admin.register(MedicalAlert)
class MedicalAlertAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['alert_type', 'severity', 'status', 'patient', 'message', 'created_at']
    list_filter = ['alert_type', 'severity', 'status']
    search_fields = ['message']


@admin.register(ClinicalNote)
class ClinicalNoteAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['id', 'encounter', 'specialty', 'status', 'created_by', 'created_at']
    list_filter = ['status', 'specialty']
    search_fields = ['encounter__id', 'transcript']
    hospital_field = 'hospital'


# ── Laboratory ────────────────────────────────────────────────────


@admin.register(TestPanel)
class TestPanelAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'short_name', 'category', 'is_panel', 'standard_tat_hours', 'is_active']
    list_filter = ['category', 'is_panel', 'is_active']
    search_fields = ['name', 'short_name']


@admin.register(TestParameter)
class TestParameterAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'panel', 'group', 'unit', 'ref_range_low', 'ref_range_high', 'display_order']
    list_filter = ['panel', 'group']
    search_fields = ['name', 'panel__name']


@admin.register(LabOrder)
class LabOrderAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['lab_id', 'patient', 'test_panel', 'status', 'priority', 'ordered_by', 'ordered_at']
    list_filter = ['status', 'priority', 'sample_type']
    search_fields = ['lab_id', 'barcode', 'patient__first_name', 'patient__last_name']
    date_hierarchy = 'ordered_at'
    readonly_fields = ['lab_id', 'barcode', 'ordered_at']


@admin.register(LabParameterResult)
class LabParameterResultAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['order', 'parameter', 'result_value', 'status', 'entered_by', 'entered_at']
    list_filter = ['status']
    search_fields = ['order__lab_id', 'parameter__name']
    date_hierarchy = 'entered_at'


@admin.register(LabDocument)
class LabDocumentAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['order', 'document_type', 'filename', 'uploaded_by', 'uploaded_at']
    list_filter = ['document_type']


@admin.register(QCEntry)
class QCEntryAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['order', 'action', 'performed_by', 'timestamp', 'instrument_id']
    list_filter = ['action']
    search_fields = ['order__lab_id', 'action']
    date_hierarchy = 'timestamp'


@admin.register(LabInventory)
class LabInventoryAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['item_name', 'item_type', 'current_stock', 'min_stock_threshold', 'expiry_date', 'is_low_stock']
    list_filter = ['item_type']
    search_fields = ['item_name']


@admin.register(LabAlert)
class LabAlertAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['alert_message', 'patient', 'severity', 'is_acknowledged', 'created_at']
    list_filter = ['severity', 'is_acknowledged']
    search_fields = ['alert_message', 'patient__first_name', 'patient__last_name']
    date_hierarchy = 'created_at'


# ═══════════════════════════════════════════════════════════════════════════════
#  TELEICU
# ═══════════════════════════════════════════════════════════════════════════════


@admin.register(ICUWard)
class ICUWardAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'total_beds', 'available_beds', 'occupied_beds']
    search_fields = ['name']


@admin.register(ICUBed)
class ICUBedAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['bed_number', 'ward', 'status', 'device_ip']
    list_filter = ['ward', 'status']
    search_fields = ['bed_number', 'ward__name']


@admin.register(TeleICUSession)
class TeleICUSessionAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['encounter', 'acuity_status', 'support_type', 'bed', 'is_active', 'admitted_at']
    list_filter = ['is_active', 'acuity_status', 'support_type']
    search_fields = ['encounter__patient__first_name', 'encounter__patient__last_name']


@admin.register(TeleConsultSession)
class TeleConsultSessionAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['patient', 'doctor', 'specialty', 'call_type', 'status', 'started_at']
    list_filter = ['status', 'specialty', 'call_type']
    search_fields = ['patient__first_name', 'doctor__username', 'specialty']
    date_hierarchy = 'started_at'


@admin.register(SystemActivityLog)
class SystemActivityLogAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['event_type', 'description', 'patient', 'author_name', 'timestamp']
    list_filter = ['event_type']
    search_fields = ['description', 'patient__first_name', 'patient__last_name']
    date_hierarchy = 'timestamp'


# ═══════════════════════════════════════════════════════════════════════════════
#  ROLE / USER
# ═══════════════════════════════════════════════════════════════════════════════


@admin.register(Role)
class RoleAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'hospital', 'is_active', 'created_at']
    list_filter = ['is_active', 'hospital']
    search_fields = ['name']

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        hospital = get_user_hospital(request)
        if hospital is not None:
            qs = qs.filter(hospital=hospital)
        return qs

    def save_model(self, request, obj, form, change):
        if not change:
            hospital = get_user_hospital(request)
            if hospital is not None:
                obj.hospital = hospital
        super().save_model(request, obj, form, change)


class HospitalUserProfileInline(admin.StackedInline):
    model = HospitalUserProfile
    can_delete = False
    verbose_name_plural = 'Hospital Profile'

    def get_readonly_fields(self, request, obj=None):
        if request.user.is_superuser:
            return ['hospital']
        return []

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Limit role dropdown to user's hospital for non-superusers."""
        if db_field.name == 'role':
            hospital = get_user_hospital(request)
            if hospital is not None:
                kwargs['queryset'] = Role.objects.filter(hospital=hospital)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


class CustomUserAdmin(BaseUserAdmin):
    inlines = [HospitalUserProfileInline]
    list_display = BaseUserAdmin.list_display + ('get_hospital',)

    @admin.display(description='Hospital')
    def get_hospital(self, obj):
        profile = getattr(obj, 'hospital_profile', None)
        return profile.hospital.name if profile and profile.hospital else '-'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        hospital = get_user_hospital(request)
        if hospital is not None:
            qs = qs.filter(hospital_profile__hospital=hospital)
        return qs


# Unregister default UserAdmin, re-register
try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass
admin.site.register(User, CustomUserAdmin)

# HospitalUserProfile — not directly needed since it's an inline on User & Hospital
# but register it for direct access by superusers
@admin.register(HospitalUserProfile)
class HospitalUserProfileAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['user', 'employee_id', 'role', 'hospital', 'department', 'is_active']
    list_filter = ['is_active', 'department']
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'employee_id']
    raw_id_fields = ['user', 'role']
    hospital_field = 'hospital'


# ═══════════════════════════════════════════════════════════════════════════════
#  SYNC / DRUG INTERACTIONS (global)
# ═══════════════════════════════════════════════════════════════════════════════


@admin.register(SyncEntry)
class SyncEntryAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['record_id', 'model_name', 'version', 'source', 'created_by', 'created_at']
    list_filter = ['model_name', 'source', 'version']
    date_hierarchy = 'created_at'


@admin.register(DrugInteraction)
class DrugInteractionAdmin(admin.ModelAdmin):
    """Global reference data — no hospital scoping."""
    list_display = ['drug_a', 'drug_b', 'severity', 'source']
    list_filter = ['severity', 'source']
    search_fields = ['drug_a', 'drug_b']


# ═══════════════════════════════════════════════════════════════════════════════
#  ADMIN PANEL MODELS
# ═══════════════════════════════════════════════════════════════════════════════


@admin.register(AdminModule)
class AdminModuleAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'label', 'status', 'is_critical', 'updated_at']
    list_filter = ['status', 'is_critical']
    search_fields = ['name', 'label']


@admin.register(SystemAlert)
class SystemAlertAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['severity', 'title', 'is_resolved', 'created_at']
    list_filter = ['severity', 'is_resolved']
    search_fields = ['title', 'description']
    date_hierarchy = 'created_at'


@admin.register(UserLoginActivity)
class UserLoginActivityAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['user', 'login_timestamp', 'ip_address', 'was_successful']
    list_filter = ['was_successful']
    search_fields = ['user__username', 'ip_address']
    date_hierarchy = 'login_timestamp'
    raw_id_fields = ['user']
    hospital_field = 'user__hospital_profile__hospital'


@admin.register(Department)
class DepartmentAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active', 'head_of_department', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'code']


@admin.register(MasterDataEntry)
class MasterDataEntryAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['category', 'key', 'value', 'is_active', 'display_order']
    list_filter = ['category', 'is_active']
    search_fields = ['category', 'key', 'value']
    list_editable = ['display_order']


@admin.register(SystemSetting)
class SystemSettingAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['key', 'label', 'value_type', 'category', 'is_encrypted', 'updated_at']
    list_filter = ['category', 'value_type', 'is_encrypted']
    search_fields = ['key', 'label']


@admin.register(WorkflowDefinition)
class WorkflowDefinitionAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'module', 'initial_state', 'is_active', 'created_at']
    list_filter = ['module', 'is_active']
    search_fields = ['name', 'module', 'description']


@admin.register(DeviceIntegration)
class DeviceIntegrationAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'device_type', 'ip_address', 'is_active', 'last_heartbeat']
    list_filter = ['device_type', 'is_active', 'auth_type']
    search_fields = ['name', 'device_type', 'ip_address']


@admin.register(SecurityPolicy)
class SecurityPolicyAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['policy_type', 'is_enforced', 'updated_at']
    list_filter = ['policy_type', 'is_enforced']


@admin.register(BackupRecord)
class BackupRecordAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['id', 'backup_type', 'status', 'file_size_mb', 'started_at', 'completed_at']
    list_filter = ['status', 'backup_type']
    date_hierarchy = 'started_at'


@admin.register(LicenseInfo)
class LicenseInfoAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['edition', 'valid_from', 'valid_till', 'is_active', 'user_limit']
    list_filter = ['edition', 'is_active']


@admin.register(StorageMetrics)
class StorageMetricsAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['storage_used_gb', 'storage_total_gb', 'database_status', 'recorded_at']
    list_filter = ['database_status']
    date_hierarchy = 'recorded_at'


# ═══════════════════════════════════════════════════════════════════════════════
#  SETTINGS MODELS  (per-hospital singletons)
# ═══════════════════════════════════════════════════════════════════════════════


@admin.register(HospitalProfile)
class HospitalProfileAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'contact_email', 'contact_phone', 'registration_number']


@admin.register(BillingSettings)
class BillingSettingsAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['tax_inclusive', 'default_payment_terms_days', 'default_tax_rate']


@admin.register(PharmacySettings)
class PharmacySettingsAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['auto_reorder_alerts', 'strict_expiry_enforcement', 'default_expiry_warning_days']


@admin.register(LaboratorySettings)
class LaboratorySettingsAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['auto_approve_normal_results', 'default_turnaround_time_hours', 'qc_check_frequency_per_week']


@admin.register(TeleICUSettings)
class TeleICUSettingsAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['auto_record_consults', 'vitals_refresh_rate_seconds', 'default_camera_quality']


@admin.register(NotificationSettings)
class NotificationSettingsAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['email_smtp_server', 'email_smtp_port', 'send_sms_on_booking']


@admin.register(IntegrationSetting)
class IntegrationSettingAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['id', 'name', 'connected']
    list_filter = ['connected']
    hospital_field = 'hospital'


@admin.register(Webhook)
class WebhookAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['url', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['url']
    hospital_field = 'hospital'


@admin.register(DataPolicySettings)
class DataPolicySettingsAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['clinical_retention_years', 'financial_retention_years', 'auto_archive_inactive_patients']


@admin.register(LocalizationSettings)
class LocalizationSettingsAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['default_language', 'timezone', 'default_currency']


@admin.register(Template)
class TemplateAdmin(HospitalScopedAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'category', 'created_at']
    list_filter = ['category']
    search_fields = ['name']
    hospital_field = 'hospital'
