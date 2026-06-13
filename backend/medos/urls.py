from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .auth import views as auth_views
from .views import (
    patients as patient_views,
    encounters as encounter_views,
    sync as sync_views,
    ddi as ddi_views,
    billing as billing_views,
    clinical as clinical_views,
    dashboard as dashboard_views,
    scribe as scribe_views,
    teleicu as teleicu_views,
    lab as lab_views,
    appointments as appointment_views,
)
from . import reports as reports_views
from .views import admin as admin_views
from .views import ward as ward_views
from .views import departments as department_views
from . import settings_views as settings_views
from .views.admin.permission_metadata import permission_metadata

router = DefaultRouter()
router.register(r'patients', patient_views.PatientViewSet)
router.register(r'insurance', patient_views.PatientInsuranceViewSet)
router.register(r'encounters', encounter_views.EncounterViewSet)
router.register(r'sync', sync_views.SyncViewSet, basename='sync')
router.register(r'ddi', ddi_views.DDIViewSet, basename='ddi')
router.register(r'invoices', billing_views.InvoiceViewSet)
router.register(r'alerts', clinical_views.MedicalAlertViewSet)
router.register(r'lab-results', clinical_views.LabResultViewSet)
router.register(r'allergies', clinical_views.AllergyViewSet)
router.register(r'diagnoses', clinical_views.DiagnosisViewSet)
router.register(r'orders', clinical_views.ServiceOrderViewSet)
router.register(r'imaging', clinical_views.ImagingResultViewSet)
router.register(r'documents', clinical_views.PatientDocumentViewSet)
router.register(r'care-plans', clinical_views.CarePlanViewSet)
router.register(r'payments', billing_views.PaymentViewSet)
router.register(r'refunds', billing_views.RefundRequestViewSet)
router.register(r'claims', billing_views.InsuranceClaimViewSet)

# ── Laboratory Routes ───────────────────────────────────────────────────
router.register(r'lab-panels', lab_views.TestPanelViewSet)
router.register(r'lab-orders', lab_views.LabOrderViewSet, basename='lab-order')
router.register(r'lab-parameter-results', lab_views.LabParameterResultViewSet)
router.register(r'lab-documents', lab_views.LabDocumentViewSet)
router.register(r'lab-qc', lab_views.QCEntryViewSet)
router.register(r'lab-inventory', lab_views.LabInventoryViewSet)
router.register(r'lab-alerts', lab_views.LabAlertViewSet)

# ── Ward / IPD Routes ───────────────────────────────────────────────────────
router.register(r'departments', department_views.DepartmentViewSet, basename='department')
router.register(r'wards', ward_views.WardViewSet, basename='ward')
router.register(r'beds', ward_views.BedViewSet, basename='bed')
router.register(r'daily-rounds', ward_views.DailyRoundViewSet, basename='dailyround')
router.register(r'nursing-notes', ward_views.NursingNoteViewSet, basename='nursingnote')
router.register(r'medication-administrations', ward_views.MedicationAdministrationViewSet, basename='medicationadministration')
router.register(r'billing-accruals', ward_views.BillingAccrualViewSet, basename='billingaccrual')

urlpatterns = [
    path('', include(router.urls)),
    # ── Dashboard ─────────────────────────────────────────────────────
    path('dashboard/', dashboard_views.DashboardView.as_view(), name='dashboard'),
    path('dashboard/activity/', dashboard_views.dashboard_activity, name='dashboard-activity'),
    path('dashboard/patient-flow/', dashboard_views.dashboard_patient_flow, name='dashboard-patient-flow'),
    path('dashboard/department-overview/', dashboard_views.dashboard_department_overview, name='dashboard-department-overview'),
    path('dashboard/insights/', dashboard_views.dashboard_insights, name='dashboard-insights'),
    path('billing/dashboard/', billing_views.BillingDashboardView.as_view(), name='billing-dashboard'),
    path('billing/transactions/', billing_views.BillingTransactionsView.as_view(), name='billing-transactions'),
    path('billing/insights/', billing_views.BillingInsightsView.as_view(), name='billing-insights'),
    path('auth/me/', auth_views.auth_me, name='auth-me'),
    path('login/', auth_views.login_view, name='login'),
    path('auth/change-password/', auth_views.change_password, name='change-password'),
    path('teleicu/', include('medos.teleicu_urls')),
    path('appointments/', include('medos.appointments_urls')),
    path('pharmacy/', include('medos.pharmacy_urls')),

    # ── Ward / IPD Custom Endpoints ───────────────────────────────────────
    path('bed-map/', ward_views.BedMapViewSet.as_view({
        'get': 'list',
    }), name='bed-map'),
    path('discharge/readiness/', ward_views.DischargeViewSet.as_view({
        'get': 'readiness',
    }), name='discharge-readiness'),
    path('discharge/execute/', ward_views.DischargeViewSet.as_view({
        'post': 'execute',
    }), name='discharge-execute'),
    path('transfer/', ward_views.TransferViewSet.as_view({
        'post': 'patient',
    }), name='transfer-patient'),
    path('nursing-station/', ward_views.NursingStationViewSet.as_view({
        'get': 'list',
    }), name='nursing-station'),
    path('nursing-station/record-vitals/', ward_views.NursingStationViewSet.as_view({
        'post': 'record_vitals',
    }), name='nursing-station-record-vitals'),

    # ── Lab Custom Endpoints ──────────────────────────────────────────
    path('lab-results/trend/', lab_views.lab_trend, name='lab-trend'),
    path('lab-results/history/', lab_views.lab_history, name='lab-history'),
    path('lab-qc/overview/', lab_views.lab_qc_overview, name='lab-qc-overview'),
    path('lab-orders/<uuid:order_id>/qc-entry/', lab_views.lab_create_qc_entry, name='lab-create-qc-entry'),

    # ── Lab Queue (Prescription-based) ────────────────────────────────
    path('lab-queue/', lab_views.LabQueueViewSet.as_view({
        'get': 'list',
    }), name='lab-queue'),
    path('lab-queue/collect-samples/', lab_views.LabQueueViewSet.as_view({
        'post': 'collect_samples',
    }), name='lab-queue-collect-samples'),
    path('lab-queue/receive-in-lab/', lab_views.LabQueueViewSet.as_view({
        'post': 'receive_in_lab',
    }), name='lab-queue-receive-in-lab'),

    # ── Care Scribe ────────────────────────────────────────────────
    path('care-scribe/', scribe_views.care_scribe_transcribe, name='care-scribe-transcribe'),
    path('care-scribe/<int:note_id>/confirm/', scribe_views.care_scribe_confirm, name='care-scribe-confirm'),
    path('care-scribe/encounter/<uuid:encounter_id>/', scribe_views.care_scribe_list, name='care-scribe-list'),

    # ═══════════════════════════════════════════════════════════════════
    # Reports & Analytics Module
    # ═══════════════════════════════════════════════════════════════════

    # ── 2.1 Overview KPIs ──────────────────────────────────────────
    path('reports/kpis/', reports_views.reports_kpis, name='reports-kpis'),

    # ── 2.2 Charts & Visualizations ────────────────────────────────
    path('reports/charts/revenue-by-department/', reports_views.chart_revenue_by_department, name='reports-chart-revenue-dept'),
    path('reports/charts/revenue-by-specialty/', reports_views.chart_revenue_by_specialty, name='reports-chart-revenue-specialty'),
    path('reports/charts/revenue-trend/', reports_views.chart_revenue_trend, name='reports-chart-revenue-trend'),

    # ── 2.3 Tabular Analytics ──────────────────────────────────────
    path('reports/tables/department-performance/', reports_views.table_department_performance, name='reports-table-dept-performance'),
    path('reports/tables/top-doctors/', reports_views.table_top_doctors, name='reports-table-top-doctors'),

    # ── 2.4 AI Insights ────────────────────────────────────────────
    path('reports/insights/', reports_views.reports_insights, name='reports-insights'),

    # ── 2.5 Report Management ──────────────────────────────────────
    path('reports/recent/', reports_views.recent_reports, name='reports-recent'),
    path('reports/generate/', reports_views.generate_report, name='reports-generate'),
    path('reports/scheduled/', reports_views.scheduled_reports, name='reports-scheduled'),
    path('reports/saved-views/', reports_views.saved_dashboard_views, name='reports-saved-views'),

    # ── Report Definitions Catalog ─────────────────────────────────
    path('reports/definitions/', reports_views.reports_report_definitions, name='reports-definitions'),

    # ═══════════════════════════════════════════════════════════════════
    # Settings Panel
    # ═══════════════════════════════════════════════════════════════════

    # 3. Notifications & Integrations
    path('settings/integrations/', settings_views.integration_settings, name='settings-integrations'),
    path('settings/webhooks/', include([
        path('', settings_views.WebhookViewSet.as_view({
            'get': 'list', 'post': 'create',
        }), name='settings-webhooks-list'),
        path('<uuid:pk>/', settings_views.WebhookViewSet.as_view({
            'delete': 'destroy', 'patch': 'partial_update',
        }), name='settings-webhooks-detail'),
    ])),

    # 5. Templates
    path('settings/templates/', include([
        path('', settings_views.TemplateViewSet.as_view({
            'get': 'list', 'post': 'create',
        }), name='settings-templates-list'),
        path('<uuid:pk>/', settings_views.TemplateViewSet.as_view({
            'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy',
        }), name='settings-templates-detail'),
    ])),

    # Singleton — model/serialiser looked up by slug from _SINGLETON_SETTINGS
    # MUST come after all specific /settings/.../* routes so they match first
    path('settings/<slug:setting_name>/', settings_views.singleton_settings_view, name='settings-singleton'),

    # ═══════════════════════════════════════════════════════════════════
    # Admin Panel
    # ═══════════════════════════════════════════════════════════════════

    # ── 1. Dashboard Overview ──────────────────────────────────────
    path('admin/kpis/', admin_views.admin_kpis, name='admin-kpis'),
    path('admin/system-overview-chart/', admin_views.admin_system_overview_chart, name='admin-system-overview-chart'),
    path('admin/module-status/', admin_views.admin_module_status, name='admin-module-status'),
    path('admin/system-alerts/', admin_views.admin_system_alerts, name='admin-system-alerts'),
    path('admin/user-activity/', admin_views.admin_user_activity, name='admin-user-activity'),
    path('admin/audit-summary/', admin_views.admin_audit_summary, name='admin-audit-summary'),
    path('admin/security-overview/', admin_views.admin_security_overview, name='admin-security-overview'),
    path('admin/recent-activities/', admin_views.admin_recent_activities, name='admin-recent-activities'),
    path('admin/database-storage/', admin_views.admin_database_storage, name='admin-database-storage'),
    path('admin/license-info/', admin_views.admin_license_info, name='admin-license-info'),
    path('admin/system-info/', admin_views.admin_system_info, name='admin-system-info'),
    path('admin/stats/', admin_views.admin_stats, name='admin-stats'),
    path('admin/permission-metadata/', permission_metadata, name='admin-permission-metadata'),

    # ── 2. Admin CRUD ViewSets ─────────────────────────────────────
    path('admin/', include(admin_views.admin_router.urls)),

]
