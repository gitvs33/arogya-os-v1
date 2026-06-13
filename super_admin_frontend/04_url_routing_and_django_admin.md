# URL Routing & Django Admin Registration

---

## 1. Root URLconf (`medos_project/urls.py`)

```python
urlpatterns = [
    path('admin/', admin.site.urls),                # Django built-in admin
    path('api/', include('medos.urls')),             # All MedOS API endpoints
    path('api-auth/', include('rest_framework.urls')),# DRF login/logout
]
```

**Total URL mount points:**
- `/admin/` → Django `django.contrib.admin` interface
- `/api/` → All MedOS REST API (patients, encounters, admin, settings, reports, etc.)
- `/api-auth/` → DRF browsable authentication

---

## 2. MedOS URLconf (`medos/urls.py`)

### 2.1 Core Domain Routers
| Router Prefix | ViewSet | Lines |
|---|---|---|
| `patients` | `PatientViewSet` | ~110 |
| `insurance` | `PatientInsuranceViewSet` | |
| `encounters` | `EncounterViewSet` | |
| `sync` | `SyncViewSet` | |
| `ddi` | `DDIViewSet` | |
| `invoices` | `InvoiceViewSet` | |
| `alerts` | `MedicalAlertViewSet` | |
| `lab-results` | `LabResultViewSet` | |
| `allergies` | `AllergyViewSet` | |
| `diagnoses` | `DiagnosisViewSet` | |
| `orders` | `ServiceOrderViewSet` | |
| `imaging` | `ImagingResultViewSet` | |
| `documents` | `PatientDocumentViewSet` | |
| `care-plans` | `CarePlanViewSet` | |
| `payments` | `PaymentViewSet` | |
| `refunds` | `RefundRequestViewSet` | |
| `claims` | `InsuranceClaimViewSet` | |
| `lab-panels` | `TestPanelViewSet` | |
| `lab-orders` | `LabOrderViewSet` | |
| `lab-parameter-results` | `LabParameterResultViewSet` | |
| `lab-documents` | `LabDocumentViewSet` | |
| `lab-qc` | `QCEntryViewSet` | |
| `lab-inventory` | `LabInventoryViewSet` | |
| `lab-alerts` | `LabAlertViewSet` | |

### 2.2 Custom Function Endpoints
| Path | View Function | Notes |
|---|---|---|
| `dashboard/` | `dashboard_views.DashboardView.as_view()` | Main dashboard |
| `billing/dashboard/` | `billing_views.BillingDashboardView.as_view()` | Billing dashboard |
| `billing/transactions/` | `billing_views.BillingTransactionsView.as_view()` | |
| `billing/insights/` | `billing_views.BillingInsightsView.as_view()` | |
| `auth/me/` | `auth_views.auth_me` | Current user info |
| `login/` | `auth_views.login_view` | Login |
| `teleicu/` | `include('medos.teleicu_urls')` | TeleICU sub-routes |

### 2.3 Lab Custom Endpoints
| Path | View Function |
|---|---|
| `lab-results/trend/` | `lab_views.lab_trend` |
| `lab-results/history/` | `lab_views.lab_history` |
| `lab-qc/overview/` | `lab_views.lab_qc_overview` |
| `lab-orders/<uuid:order_id>/qc-entry/` | `lab_views.lab_create_qc_entry` |

### 2.4 Care Scribe Endpoints
| Path | View Function |
|---|---|
| `care-scribe/` | `scribe_views.care_scribe_transcribe` |
| `care-scribe/<int:note_id>/confirm/` | `scribe_views.care_scribe_confirm` |
| `care-scribe/encounter/<uuid:encounter_id>/` | `scribe_views.care_scribe_list` |

### 2.5 Reports & Analytics (11 endpoints)
| Path | View Function |
|---|---|
| `reports/kpis/` | `reports_views.reports_kpis` |
| `reports/charts/revenue-by-department/` | `reports_views.chart_revenue_by_department` |
| `reports/charts/revenue-by-specialty/` | `reports_views.chart_revenue_by_specialty` |
| `reports/charts/revenue-trend/` | `reports_views.chart_revenue_trend` |
| `reports/tables/department-performance/` | `reports_views.table_department_performance` |
| `reports/tables/top-doctors/` | `reports_views.table_top_doctors` |
| `reports/insights/` | `reports_views.reports_insights` |
| `reports/recent/` | `reports_views.recent_reports` |
| `reports/generate/` | `reports_views.generate_report` |
| `reports/scheduled/` | `reports_views.scheduled_reports` |
| `reports/saved-views/` | `reports_views.saved_dashboard_views` |
| `reports/definitions/` | `reports_views.reports_report_definitions` |

### 2.6 Settings Endpoints (modular)
| Path | View Function / ViewSet |
|---|---|
| `settings/hospital-profile/` | `settings_views.hospital_profile` |
| `settings/billing/` | `settings_views.billing_settings` |
| `settings/pharmacy/` | `settings_views.pharmacy_settings` |
| `settings/laboratory/` | `settings_views.laboratory_settings` |
| `settings/teleicu/` | `settings_views.teleicu_settings` |
| `settings/notifications/` | `settings_views.notification_settings` |
| `settings/integrations/` | `settings_views.integration_settings` |
| `settings/webhooks/` | `WebhookViewSet` (list/create + delete/patch) |
| `settings/data-policies/` | `settings_views.data_policies` |
| `settings/localization/` | `settings_views.localization_settings` |
| `settings/templates/` | `TemplateViewSet` (full CRUD) |

### 2.7 Admin Panel Endpoints (THE PACKAGE)

#### Dashboard Overview (11 function-based)
| Path | View Function |
|---|---|
| `admin/kpis/` | `admin_views.admin_kpis` |
| `admin/system-overview-chart/` | `admin_views.admin_system_overview_chart` |
| `admin/module-status/` | `admin_views.admin_module_status` |
| `admin/system-alerts/` | `admin_views.admin_system_alerts` |
| `admin/user-activity/` | `admin_views.admin_user_activity` |
| `admin/audit-summary/` | `admin_views.admin_audit_summary` |
| `admin/security-overview/` | `admin_views.admin_security_overview` |
| `admin/recent-activities/` | `admin_views.admin_recent_activities` |
| `admin/database-storage/` | `admin_views.admin_database_storage` |
| `admin/license-info/` | `admin_views.admin_license_info` |
| `admin/system-info/` | `admin_views.admin_system_info` |

#### CRUD ViewSets (10 routers under `/api/admin/`)
| Router Prefix | ViewSet |
|---|---|
| `admin/users/` | `AdminUserViewSet` |
| `admin/roles/` | `AdminRoleViewSet` |
| `admin/departments/` | `AdminDepartmentViewSet` |
| `admin/master-data/` | `AdminMasterDataViewSet` |
| `admin/settings/` | `AdminSystemSettingViewSet` |
| `admin/workflows/` | `AdminWorkflowViewSet` |
| `admin/devices/` | `AdminDeviceViewSet` |
| `admin/security/` | `AdminSecurityViewSet` |
| `admin/audit-logs/` | `AdminAuditLogViewSet` |
| `admin/backups/` | `AdminBackupViewSet` |

**Total admin endpoints:**
- 11 function-based dashboard endpoints
- 10 ViewSets × 6 standard actions = 60 CRUD endpoints
- +15 custom actions (reset_password, toggle_active, test_connection, etc.)
- **≈86 admin endpoints total**

---

## 3. Django Admin Registration (`medos/admin.py`)

The standard Django `django.contrib.admin` is used for back-office staff:

```python
from django.contrib import admin
from .models import (ClinicalNote, Patient, PatientInsurance, Encounter, ...)
from .admin_models import (AdminModule, BackupRecord, Department, ...)
from .settings_models import (HospitalProfile, BillingSettings, ...)
```

### 3.1 Registered Models (≈40 models)

**Core Models** (from `models.py`):
| Model | Admin Class | Key Features |
|---|---|---|
| `Patient` | `PatientAdmin` | list_display, list_filter, search_fields, date_hierarchy |
| `Encounter` | `EncounterAdmin` | list_display, list_filter, search_fields, date_hierarchy |
| `Vitals` | (inline) | TabularInline inside Encounter |
| `Medication` | (inline) | TabularInline inside Encounter |
| `SyncEntry` | `SyncEntryAdmin` | list_display, list_filter, date_hierarchy |
| `DrugInteraction` | `DrugInteractionAdmin` | list_display, list_filter, search_fields |
| `Invoice` | `InvoiceAdmin` | list_display, list_filter, search_fields, date_hierarchy |
| `LabResult` | `LabResultAdmin` | @admin.register, list_display, list_filter, search_fields |
| `MedicalAlert` | `MedicalAlertAdmin` | list_display |
| `Role` | `RoleAdmin` | list_display |
| `HospitalUserProfile` | (built-in) | Standard |
| `User` | `CustomUserAdmin` | Unregisters default UserAdmin, re-registers with HospitalUserProfileInline |

**Patient Summary Models:**
| Model | Admin Class |
|---|---|
| `Allergy` | `AllergyAdmin` |
| `Diagnosis` | `DiagnosisAdmin` |
| `ServiceOrder` | `ServiceOrderAdmin` |
| `ImagingResult` | `ImagingResultAdmin` |
| `PatientDocument` | `PatientDocumentAdmin` |
| `CarePlan` | `CarePlanAdmin` |

**Billing Models:**
| Model | Admin Class |
|---|---|
| `Payment` | `PaymentAdmin` |
| `RefundRequest` | `RefundRequestAdmin` |
| `InsuranceClaim` | `InsuranceClaimAdmin` |
| `PatientInsurance` | `PatientInsuranceAdmin` |

**TeleICU Models:**
| Model | Admin Class |
|---|---|
| `ICUWard` | `ICUWardAdmin` |
| `ICUBed` | `ICUBedAdmin` |
| `TeleICUSession` | `TeleICUSessionAdmin` |
| `TeleConsultSession` | `TeleConsultSessionAdmin` |
| `SystemActivityLog` | `SystemActivityLogAdmin` |

**Care Scribe:**
| Model | Admin Class |
|---|---|
| `ClinicalNote` | `ClinicalNoteAdmin` |

**Laboratory Models:**
| Model | Admin Class |
|---|---|
| `TestPanel` | `TestPanelAdmin` |
| `TestParameter` | `TestParameterAdmin` |
| `LabOrder` | `LabOrderAdmin` |
| `LabParameterResult` | `LabParameterResultAdmin` |
| `LabDocument` | `LabDocumentAdmin` |
| `QCEntry` | `QCEntryAdmin` |
| `LabInventory` | `LabInventoryAdmin` |
| `LabAlert` | `LabAlertAdmin` |

**Admin Panel Models** (from `admin_models.py`):
| Model | Admin Class |
|---|---|
| `AdminModule` | `AdminModuleAdmin` |
| `SystemAlert` | `SystemAlertAdmin` |
| `UserLoginActivity` | `UserLoginActivityAdmin` |
| `Department` | `DepartmentAdmin` |
| `MasterDataEntry` | `MasterDataEntryAdmin` |
| `SystemSetting` | `SystemSettingAdmin` |
| `WorkflowDefinition` | `WorkflowDefinitionAdmin` |
| `DeviceIntegration` | `DeviceIntegrationAdmin` |
| `SecurityPolicy` | `SecurityPolicyAdmin` |
| `BackupRecord` | `BackupRecordAdmin` |
| `LicenseInfo` | `LicenseInfoAdmin` |
| `StorageMetrics` | `StorageMetricsAdmin` |

**Settings Models** (from `settings_models.py`):
| Model | Admin Class |
|---|---|
| `HospitalProfile` | `HospitalProfileAdmin` |
| `BillingSettings` | `BillingSettingsAdmin` |
| `PharmacySettings` | `PharmacySettingsAdmin` |
| `LaboratorySettings` | `LaboratorySettingsAdmin` |
| `TeleICUSettings` | `TeleICUSettingsAdmin` |
| `NotificationSettings` | `NotificationSettingsAdmin` |
| `IntegrationSetting` | `IntegrationSettingAdmin` |
| `Webhook` | `WebhookAdmin` |
| `DataPolicySettings` | `DataPolicySettingsAdmin` |
| `LocalizationSettings` | `LocalizationSettingsAdmin` |
| `Template` | `TemplateAdmin` |

---

## 4. Two Admin Interfaces — How They Differ

| Aspect | Django Admin (`/admin/`) | MedOS Admin API (`/api/admin/`) |
|---|---|---|
| **Purpose** | Back-office CRUD for superusers | Frontend-facing API for Admin Panel SPA |
| **Auth** | Django session + staff status | DRF TokenAuthentication |
| **UI** | Server-rendered HTML (django.contrib.admin) | JSON consumed by React SPA |
| **Models** | All ~40 models registered | 12 admin_models + User/Role/HospitalUserProfile |
| **View Layer** | `ModelAdmin` subclasses | DRF `@api_view` functions + `ModelViewSet` classes |
| **Serialization** | Automatic Django form rendering | DRF `Serializer` classes |
| **Custom Actions** | Admin actions dropdown | `@action(detail=True, methods=['post'])` |
| **Pagination** | Django paginator | DRF PageNumberPagination |
| **Permission** | `staff` + `is_superuser` | `IsAuthenticated` + permission checks |

### The Dual-Admin Architecture

```
Browser Staff User (internal)          Browser Admin User (dashboard)
          │                                       │
          ▼                                       ▼
  /admin/  (Django HTML)               /admin/  (React SPA)
          │                                       │
          ▼                                       ▼
  django.contrib.admin                  admin_views.py (DRF)
          │                                       │
          ▼                                       ▼
  Same ORM Models ←───────────────────────────────┘
  (models.py + admin_models.py + settings_models.py)
          │
          ▼
  Database (PostgreSQL)
```

Both interfaces operate on the **same database tables** through the **same Django ORM models**. The Django admin is for direct data manipulation by superusers, while the MedOS admin API serves the React frontend for day-to-day administrative operations.
