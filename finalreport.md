# MedOS System — Final Architecture Report

> Complete system documentation as of 11 June 2026.
> Covers both projects, all API surfaces, architecture cleanups, and scalability considerations.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Two-Project Architecture](#2-two-project-architecture)
3. [Project Inventory](#3-project-inventory)
4. [API Surface Area](#4-api-surface-area)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Database Model](#6-database-model)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Architecture Cleanups Summary](#8-architecture-cleanups-summary)
9. [Frontend-Backend Correspondence](#9-frontend-backend-correspondence)
10. [Scalability at 4M Hospitals](#10-scalability-at-4m-hospitals)
11. [Known Technical Debt](#11-known-technical-debt)
12. [Recommendations](#12-recommendations)

---

## 1. System Overview

MedOS is a hospital management system with **two Django backends** sharing one PostgreSQL database, serving **two separate frontends**:

| Layer | Main System | Internal Ops |
|-------|------------|--------------|
| **Backend** | `medos/backend/` (port 8000) | `medos_internal_frontend/backend/` (port 8001) |
| **Frontend** | `medos/frontend/` (port 5173) | `medos_internal_frontend/frontend/` (port 5175) |
| **Purpose** | Hospital staff EHR & operations | Platform-wide internal ops management |
| **Users** | Hospital staff (doctors, nurses, lab techs) | Internal ops staff (system administrators) |
| **Auth** | Supabase + local DB fallback | Token auth (is_staff only) |
| **Scope** | Per-hospital (tenant-scoped) | Platform-wide (global) |

### Total codebase size

| Component | Files | Lines (Python / TSX) |
|-----------|-------|---------------------|
| Main backend | ~100 Python files | 19,349 |
| Internal ops backend | ~30 Python files | 3,965 |
| Main frontend | 124 TS/TSX files | — |
| Internal ops frontend | 28 TS/TSX files | — |
| **Total** | ~280 files | ~23,314+ |

---

## 2. Two-Project Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                       PostgreSQL Database                            │
│   (medos_hospital, auth_user, medos_patient, medos_encounter,       │
│    medos_invoice, medos_role, medos_hospitaluserprofile,            │
│    medos_systemactivitylog, medos_* ~50 tables total)               │
└───────────────────────┬───────────────────────────┬──────────────────┘
                        │                           │
                        ▼                           ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│  medos/backend/                  │  │  medos_internal_frontend/      │
│  Django project on port 8000    │  │  backend/ — Django on 8001     │
│                                 │  │                                 │
│  medos_project/                  │  │  medos_internal_project/       │
│  ├── settings/ (package)        │  │  ├── settings.py (single file) │
│  │   ├── base.py                │  │  ├── urls.py                   │
│  │   ├── development.py         │  │  └── wsgi.py                   │
│  │   └── production.py          │  │                                 │
│  ├── urls.py                    │  │  medos_internal/                │
│  └── wsgi.py                    │  │  ├── models.py (unmanaged)     │
│                                 │  │  ├── views.py                  │
│  medos/ (Django app)            │  │  ├── serializers.py            │
│  ├── urls.py (17 routers + 40+  │  │  ├── urls.py                   │
│  │   custom paths)              │  │  ├── auth.py                   │
│  ├── models/ (10-file package)  │  │  ├── permissions.py            │
│  ├── views/ (3 packages)        │  │  ├── admin.py                  │
│  │   ├── admin/ (11 files)      │  │  └── services/                 │
│  │   ├── lab/ (9 files)         │  │      ├── dashboard.py          │
│  │   └── *.py (13 files)        │  │      ├── hospital_onboarding.py│
│  ├── serializers/               │  │      ├── hospital_detail.py    │
│  │   ├── admin/ (11 files)      │  │      ├── user_management.py   │
│  │   └── *.py (12 files)        │  │      └── admin_crud.py         │
│  ├── alerts/ (4 files)          │  │                                 │
│  ├── billing/ (4 files)         │  │  frontend/ (port 5175)         │
│  ├── auth/ (3 files)            │  │  ├── src/api/ (6 files)        │
│  ├── reports/ (7 files)         │  │  ├── src/pages/ (8 pages)      │
│  ├── teleicu/ (3 files)         │  │  ├── src/components/           │
│  ├── timeline/ (2 files)        │  │  └── src/test/                 │
│  ├── consumers.py               │  │                                 │
│  └── ...                        │  │                                 │
│                                 │  │                                 │
│  frontend/ (port 5173)          │  │                                 │
│  ├── src/api/ (17 files)        │  │                                 │
│  ├── src/pages/ (30+ files)     │  │                                 │
│  ├── src/pages/*-tabs/ (30+)    │  │                                 │
│  └── src/components/            │  │                                 │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

### Key architectural decisions

1. **Same database, separate projects** — Both Django projects connect to the same PostgreSQL database. The main backend owns the canonical migrations. The internal ops backend uses `managed=False` + `db_table` for shared tables and manages its own admin-model tables.

2. **Token auth for internal ops** — Internal ops staff authenticate via DRF Token auth (not Supabase). Login checks `is_staff=True` before granting access.

3. **Hospital-scoped tenant isolation** — The main backend's `HospitalScopedViewSet` (in `views/base.py`) automatically filters all queries by the current user's hospital and attaches the hospital FK on create. This prevents cross-tenant data leaks.

4. **Settings as singletons** — 8 settings models inherit from `SingletonSettingsBase` (abstract model with auto-singleton logic). A single parameterized view + registry handles CRUD for all of them.

5. **Admin endpoints on both backends** — The main backend serves 11 individual admin dashboard endpoints (per-hospital scope). The internal ops backend serves 3 composite admin dashboard endpoints (platform-wide scope). They serve different consumers and are **not** duplicative.

---

## 3. Project Inventory

### 3.1 Main backend packages (`medos/`)

| Package | Files | Lines | Purpose |
|---------|-------|-------|---------|
| `models/` | 10 files | 2,727 | Domain-aligned models (patient, clinical, billing, lab, icu, hospital, auth, analytics, sync, admin) |
| `views/` | 24 files | 2,000+ | API views organized by domain: `admin/` (11), `lab/` (9), + 13 standalone |
| `serializers/` | 23 files | 1,200+ | DRF serializers mirroring `views/` structure |
| `migrations/` | 20 files | 2,543 | Database migrations (0001–0020) |
| `auth/` | 3 files | 507 | Authentication views + authentication backend |
| `alerts/` | 4 files | 397 | Alert engine, thresholds, broadcaster |
| `reports/` | 7 files | 782 | Analytics reports (KPI, charts, tables, insights, management) |
| `billing/` | 4 files | 449 | Billing metrics, insights, transaction feed |
| `teleicu/` | 3 files | 373 | ICU registry + helpers (dashboard stats, trend, monitored patients) |
| `settings_*` | 3 files | 827 | Singleton settings models, serializers, views |
| `tests/` | 12 files | 2,545 | API, auth, billing, lab, models, registry, thresholds, timeline, tenant isolation |
| Other | 10 files | 2,550+ | Consumers, routing, tasks, permissions, subscriptions, care_scribe, lab/workflow |

### 3.2 Internal ops backend (`medos_internal/`)

| File | Lines | Purpose |
|------|-------|---------|
| `models.py` | 401 | Unmanaged mirror models + managed admin tables |
| `views.py` | 379 | Staff-only endpoints (login, hospitals CRUD, stats, dashboard, admin CRUD router) |
| `serializers.py` | 153 | Internal API serializers |
| `urls.py` | 28 | URL configuration |
| `auth.py` | 39 | Token expiry helpers |
| `permissions.py` | 41 | IsStaffUser permission |
| `admin.py` | 191 | Django admin config |
| `services/dashboard.py` | 404 | Dashboard stats + composite endpoint logic |
| `services/admin_crud.py` | 84 | Generic admin CRUD viewset factory |
| `services/hospital_onboarding.py` | 77 | Onboarding workflow |
| `services/hospital_detail.py` | 68 | Hospital detail query builder |
| `services/user_management.py` | 62 | User CRUD operations |
| `tests/` | 5 files | 1,726 | Dashboard, onboarding, detail, user mgmt, integration tests |

### 3.3 Main frontend (`medos/frontend/`)

| Area | Files | Purpose |
|------|-------|---------|
| `src/api/` | 17 files | API client modules by domain (patients, encounters, billing, lab, dashboard, alerts, teleicu, adminApi, reports, settings, ddi, careScribe) |
| `src/pages/` | 18 pages | Top-level route pages (Login, Dashboard, Patients, Encounters, Billing, Laboratory, TeleICU, AdminPanel, Settings, Reports, etc.) |
| `src/pages/*-tabs/` | 32 tab files | Sub-tab components organized by domain (admin-tabs, billing-tabs, lab-tabs, patient-tabs, reports-tabs, settings-tabs, teleicu-tabs) |
| `src/components/` | 6 components | Shared UI components (Layout, AlertToast, CareScribeModal, DDIWarningModal, VideoCall, DrugAutocomplete) |
| `src/hooks/` | 2 hooks | WebSocket hooks (useWebSocket, useAlertWebSocket) |
| `src/types/` | 1 file | auth.ts type definitions |
| `src/test/` | ~10 files | Tests |

### 3.4 Internal ops frontend (`medos_internal_frontend/frontend/`)

| Area | Files | Purpose |
|------|-------|---------|
| `src/api/` | 6 files | `client.ts`, `internalApi.ts`, `types.ts`, `internal/authApi.ts`, `internal/dashboardApi.ts`, `internal/hospitalsApi.ts` |
| `src/pages/` | 8 pages | Login, HospitalsDashboard, HospitalDetail, NewHospitalWizard, Stats, AdminDashboard (+ test files) |
| `src/components/` | 4 components | Layout, ErrorBoundary, Toast (+ test files) |
| `src/test/` | 3 test utilities | setup, test-utils, smoke test |

---

## 4. API Surface Area

### 4.1 Main backend endpoints (`/api/...` on port 8000)

#### Router-registered CRUD endpoints

| Prefix | Entity | ViewSet |
|--------|--------|---------|
| `patients` | Patient CRUD | `PatientViewSet` |
| `insurance` | Patient insurance | `PatientInsuranceViewSet` |
| `encounters` | Encounter CRUD | `EncounterViewSet` |
| `sync` | Offline sync | `SyncViewSet` |
| `ddi` | Drug-drug interactions | `DDIViewSet` |
| `invoices` | Invoice CRUD | `InvoiceViewSet` |
| `alerts` | Medical alerts | `MedicalAlertViewSet` |
| `lab-results` | Clinical lab results | `LabResultViewSet` |
| `allergies` | Allergies | `AllergyViewSet` |
| `diagnoses` | Diagnoses | `DiagnosisViewSet` |
| `orders` | Service orders | `ServiceOrderViewSet` |
| `imaging` | Imaging results | `ImagingResultViewSet` |
| `documents` | Patient documents | `PatientDocumentViewSet` |
| `care-plans` | Care plans | `CarePlanViewSet` |
| `payments` | Payments | `PaymentViewSet` |
| `refunds` | Refund requests | `RefundRequestViewSet` |
| `claims` | Insurance claims | `InsuranceClaimViewSet` |
| `lab-panels` | Test panel catalog | `TestPanelViewSet` |
| `lab-orders` | Lab order lifecycle | `LabOrderViewSet` |
| `lab-parameter-results` | Per-parameter results | `LabParameterResultViewSet` |
| `lab-documents` | Lab documents | `LabDocumentViewSet` |
| `lab-qc` | QC audit trail | `QCEntryViewSet` |
| `lab-inventory` | Lab inventory | `LabInventoryViewSet` |
| `lab-alerts` | Lab critical alerts | `LabAlertViewSet` |

#### Custom endpoints

| Path | Purpose |
|------|---------|
| `dashboard/` | Hospital dashboard KPI |
| `billing/dashboard/` | Billing dashboard |
| `billing/transactions/` | Transaction feed |
| `billing/insights/` | Billing insights |
| `auth/me/` | Current user profile |
| `login/` | User login |
| `auth/change-password/` | Password change |
| `teleicu/` | ICU wards, beds, sessions, consult, dashboard, alerts |
| `lab-results/trend/` | Parameter trend |
| `lab-results/history/` | Previous orders |
| `lab-qc/overview/` | Cross-order QC |
| `lab-orders/<id>/qc-entry/` | Per-order QC |
| `care-scribe/` | AI transcribe |
| `care-scribe/<id>/confirm/` | Confirm note |
| `care-scribe/encounter/<id>/` | List notes |
| `reports/kpis/` | Report KPIs |
| `reports/charts/...` | Revenue charts (by department, specialty, trend) |
| `reports/tables/...` | Department performance, top doctors |
| `reports/insights/` | AI insights |
| `reports/recent/` | Recent reports |
| `reports/generate/` | Generate report |
| `reports/scheduled/` | Scheduled reports |
| `reports/saved-views/` | Saved dashboard views |
| `reports/definitions/` | Report catalog |
| `settings/<slug>/` | Singleton settings (billing, pharmacy, lab, teleicu, etc.) |
| `settings/integrations/` | Integration settings |
| `settings/webhooks/` | Webhooks CRUD |
| `settings/templates/` | Templates CRUD |

#### Admin dashboard endpoints (11 individual)

| Path | Endpoint function | Purpose |
|------|------------------|---------|
| `admin/kpis/` | `admin_kpis` | KPI cards (users, active users, departments, roles, uptime, storage) |
| `admin/system-overview-chart/` | `admin_system_overview_chart` | 7-day login/transaction/error chart |
| `admin/module-status/` | `admin_module_status` | Module operational statuses |
| `admin/system-alerts/` | `admin_system_alerts` | Unresolved system alerts |
| `admin/user-activity/` | `admin_user_activity` | Top active users (30 days) |
| `admin/audit-summary/` | `admin_audit_summary` | Audit log category breakdown + recent entries |
| `admin/security-overview/` | `admin_security_overview` | Security policy summary |
| `admin/recent-activities/` | `admin_recent_activities` | Recent system activities |
| `admin/database-storage/` | `admin_database_storage` | Storage usage + backup schedule |
| `admin/license-info/` | `admin_license_info` | License details |
| `admin/system-info/` | `admin_system_info` | Python/Django/server info |

#### Admin CRUD ViewSets

| Prefix | Entity | ViewSet |
|--------|--------|---------|
| `admin/users/` | Hospital staff | `AdminUserViewSet` |
| `admin/roles/` | Roles | `AdminRoleViewSet` |
| `admin/departments/` | Departments | `AdminDepartmentViewSet` |
| `admin/master-data/` | Master data entries | `AdminMasterDataViewSet` |
| `admin/settings/` | System settings | `AdminSystemSettingViewSet` |
| `admin/workflows/` | Workflow definitions | `AdminWorkflowViewSet` |
| `admin/devices/` | Device integrations | `AdminDeviceViewSet` |
| `admin/security/` | Security policies | `AdminSecurityViewSet` |
| `admin/audit-logs/` | Audit log viewer | `AdminAuditLogViewSet` |
| `admin/backups/` | Backup records | `AdminBackupViewSet` |

### 4.2 Internal ops backend endpoints (`/api/internal/...` on port 8001)

| Path | Purpose | Scope |
|------|---------|-------|
| `internal/login/` | Staff login | Auth |
| `internal/hospitals/` | List all hospitals | Hospital management |
| `internal/hospitals/create/` | Create hospital + admin | Hospital management |
| `internal/hospitals/<id>/` | GET/PATCH hospital detail | Hospital management |
| `internal/hospitals/<id>/activate/` | Activate hospital | Hospital management |
| `internal/hospitals/<id>/deactivate/` | Deactivate hospital | Hospital management |
| `internal/hospitals/<id>/impersonate/` | Get admin token | Hospital management |
| `internal/stats/` | Platform-wide KPIs | Platform stats |
| `internal/admin/dashboard/overview/` | Composite: KPIs + modules + storage + license + system + security | Admin dashboard |
| `internal/admin/dashboard/activity/` | Composite: chart + user activity + audit summary | Admin dashboard |
| `internal/admin/dashboard/alerts/` | Composite: system alerts + recent activities | Admin dashboard |
| `internal/admin/users/` | Admin user CRUD | Admin CRUD |
| `internal/admin/roles/` | Admin role CRUD | Admin CRUD |
| `internal/admin/departments/` | Admin department CRUD | Admin CRUD |
| `internal/admin/security-policies/` | Admin security CRUD | Admin CRUD |
| `internal/admin/system-settings/` | Admin system settings CRUD | Admin CRUD |
| `internal/admin/workflows/` | Admin workflow CRUD | Admin CRUD |
| `internal/admin/device-integrations/` | Admin device CRUD | Admin CRUD |
| `internal/admin/master-data/` | Admin master data CRUD | Admin CRUD |
| `internal/admin/backups/` | Admin backup CRUD | Admin CRUD |
| `internal/admin/modules/` | Admin module CRUD | Admin CRUD |
| `internal/admin/licenses/` | Admin license CRUD | Admin CRUD |

---

## 5. Frontend Architecture

### 5.1 Main frontend page structure

```
Login
  ├── Dashboard (main hospital KPI)
  ├── Patients
  │   ├── PatientList
  │   ├── NewPatient
  │   ├── PatientDetail (10 tabs)
  │   │   ├── Overview
  │   │   ├── Billing
  │   │   ├── CarePlan
  │   │   ├── Diagnoses
  │   │   ├── Documents
  │   │   ├── Imaging
  │   │   ├── LabResults
  │   │   ├── Medications
  │   │   ├── Notes
  │   │   ├── Orders
  │   │   └── Timeline
  │   └── ...sub-pages
  ├── Encounters
  │   ├── EncounterList
  │   ├── NewEncounter
  │   └── EncounterDetail
  ├── Billing
  │   ├── BillingDashboard (6 tabs)
  │   │   ├── Invoices
  │   │   ├── Payments
  │   │   ├── Refunds
  │   │   ├── Insurance
  │   │   ├── GST
  │   │   └── DayEnd
  │   └── InvoiceDetail
  ├── Laboratory
  │   ├── LabDashboard (5 tabs)
  │   │   ├── Reports
  │   │   ├── SampleCollection
  │   │   └── Inventory
  │   └── LabOrderDetail
  ├── TeleICU
  │   ├── ICU Patients
  │   ├── Alerts
  │   ├── Consults
  │   └── Devices
  ├── AdminPanel (hospital-level admin)
  │   ├── AdminDashboard (overview, activity, alerts tabs)
  │   ├── UserManagement
  │   ├── RoleManagement
  │   ├── DepartmentSetup
  │   ├── AuditLogs
  │   ├── SecurityAccess
  │   ├── SystemSettings
  │   ├── WorkflowSetup
  │   ├── DeviceIntegration
  │   ├── MasterData
  │   └── BackupRestore
  ├── Settings
  │   ├── HospitalProfile
  │   ├── BillingSettings
  │   ├── LaboratorySettings
  │   ├── PharmacySettings
  │   ├── TeleICUSettings
  │   ├── LocalizationSettings
  │   ├── NotificationsSettings
  │   ├── APIWebhooksSettings
  │   ├── IntegrationsSettings
  │   ├── TemplatesSettings
  │   └── DataManagement
  ├── Reports & Analytics
  │   ├── Overview
  │   ├── Department Performance
  │   ├── Doctor Reports
  │   ├── Billing Reports
  │   ├── EMR Reports
  │   ├── Laboratory Reports
  │   ├── Pharmacy Reports
  │   ├── TeleICU Reports
  │   ├── Operations Reports
  │   └── AI Insights
  ├── AIScribe
  ├── Appointments
  ├── Prescriptions
  ├── Alerts
  ├── ChangePassword
  └── SuspendedAccount
```

### 5.2 Internal ops frontend page structure

```
Login
  ├── HospitalsDashboard (list all hospitals)
  │   ├── HospitalDetail (view/edit single hospital)
  │   └── NewHospitalWizard (multi-step onboarding)
  ├── Stats (platform-wide KPIs)
  └── AdminDashboard (system-wide admin)
      ├── Tab: Overview (KPIs, modules, storage, system, security)
      ├── Tab: Activity (7-day chart, user activity, audit summary)
      └── Tab: Alerts (system alerts, recent activities)
```

### 5.3 API client organization

**Main frontend** (`src/api/`): 17 domain-split modules, each exporting typed functions:

- `patients.ts` — Patient CRUD
- `encounters.ts` — Encounter CRUD
- `billing.ts` — Invoices, payments, refunds, claims, dashboard
- `lab/` — Catalog, orders, results, QC, inventory, dashboard
- `teleicu.ts` — ICU data
- `dashboard.ts` — Main hospital KPI
- `alerts.ts` — Medical alerts
- `adminApi.ts` — 11 admin dashboard endpoints
- `settings.ts` — Singleton settings
- `reports.ts` — All report endpoints
- `ddi.ts` — Drug-drug interactions
- `careScribe.ts` — AI scribe

**Internal ops frontend** (`src/api/`): 6 files:

- `client.ts` — Axios instance
- `types.ts` — All TypeScript interfaces (DashboardOverview, SystemAlert, etc.)
- `internalApi.ts` — Typed object with all endpoint methods
- `internal/authApi.ts` — Login
- `internal/dashboardApi.ts` — Dashboard composite endpoints
- `internal/hospitalsApi.ts` — Hospital CRUD

---

## 6. Database Model

### 6.1 Schema ownership

Tables are split into three categories:

**Owned by main backend** (50+ tables with canonical migrations):

```
medos_patient, medos_encounter, medos_invoice, medos_invoiceitem,
medos_billingdashboard, medos_insuranceclaim, medos_payment,
medos_refundrequest, medos_serviceorder, medos_diagnosis,
medos_imagingresult, medos_patientdocument, medos_careplan,
medos_medicalalert, medos_labresult, medos_allergy,
medos_labpanel, medos_laborder, medos_labparameterresult,
medos_labdocument, medos_labcriticalalert, medos_labinventory,
medos_qcentry, medos_labqcrule,
medos_icuward, medos_icubed, medos_vitals, medos_icusession,
medos_teleicuconsult, medos_dashboardkpi,
medos_systemactivitylog, medos_userloginactivity,
medos_hospital, medos_role, medos_hospitaluserprofile,
medos_department, medos_adminmodule, medos_systemalert,
medos_securitypolicy, medos_systemsetting, medos_workflowdefinition,
medos_deviceintegration, medos_masterdataentry, medos_backuprecord,
medos_licenseinfo, medos_storagemetrics,
medos_pharmacysettings, medos_billingsettings,
medos_laboratorysettings, medos_teleicusettings,
medos_notificationsettings, medos_integrationsettings,
medos_localizationsettings, medos_datamanagementsettings,
auth_user, auth_group, auth_permission, auth_group_permissions,
auth_user_groups, auth_user_user_permissions,
authtoken_token,
django_admin_log, django_content_type, django_migrations, django_session,
channels_channel, channels_group
```

**Owned by internal ops backend** (managed=false, db_table):

```
medos_hospital         (managed=False, db_table='medos_hospital')
medos_role              (managed=False)
medos_hospitaluserprofile (managed=False)
medos_systemactivitylog (managed=False)
medos_patient           (managed=False — stats only)
medos_encounter         (managed=False — stats only)
medos_invoice           (managed=False — stats only)
auth_user               (managed=False)
authtoken_token         (managed=False)
```

**Managed by internal ops backend** (migrations there):

```
medos_adminmodule, medos_systemalert, medos_userloginactivity,
medos_department, medos_masterdataentry, medos_systemsetting,
medos_workflowdefinition, medos_deviceintegration, medos_securitypolicy,
medos_backuprecord, medos_licenseinfo, medos_storagemetrics
```

### 6.2 Model structure (main backend)

The `medos/models/` package has 10 domain-aligned files:

| File | Lines | Key models |
|------|-------|------------|
| `patient.py` | 323 | `Patient`, `PatientSummary`, `PatientInsurance` |
| `clinical.py` | 601 | `Encounter`, `Diagnosis`, `ServiceOrder`, `ImagingResult`, `MedicalAlert`, `Allergy`, `PatientDocument`, `CarePlan`, `ClinicalNote`, `LabResult`, `Prescription` |
| `billing.py` | 253 | `Invoice`, `InvoiceItem`, `Payment`, `RefundRequest`, `InsuranceClaim`, `BillingDashboard` |
| `lab.py` | 445 | `TestPanel`, `TestParameter`, `LabOrder`, `LabParameterResult`, `LabDocument`, `LabCriticalAlert`, `LabInventory`, `LabQCRule`, `QCEntry` |
| `icu.py` | 203 | `ICUWard`, `ICUBed`, `Vitals`, `ICUSession`, `TeleICUConsult`, `DashboardKPI` |
| `hospital.py` | 54 | `Hospital`, `Department` |
| `admin.py` | 402 | `Role`, `HospitalUserProfile`, `SystemActivityLog`, `UserLoginActivity`, `AdminModule`, `SystemAlert`, `SecurityPolicy`, `SystemSetting`, `WorkflowDefinition`, `DeviceIntegration`, `MasterDataEntry`, `BackupRecord`, `LicenseInfo`, `StorageMetrics` |
| `auth.py` | 79 | User-related profile models |
| `analytics.py` | 237 | Analytics and reporting models |
| `sync.py` | 115 | Offline sync models |

### 6.3 Model structure (internal ops backend)

The `medos_internal/models.py` file mirrors the shared tables from the main project as unmanaged models, plus manages its own admin tables.

**Unmanaged mirrors** (must exactly match main backend schema):
- `Hospital` → `medos_hospital`
- `Role` → `medos_role`
- `HospitalUserProfile` → `medos_hospitaluserprofile`
- `SystemActivityLog` → `medos_systemactivitylog`
- `Patient` → `medos_patient`
- `Encounter` → `medos_encounter`
- `Invoice` → `medos_invoice`

**Managed models** (owned by internal ops):
- `AdminModule`, `SystemAlert`, `UserLoginActivity`
- `Department`, `MasterDataEntry`, `SystemSetting`
- `WorkflowDefinition`, `DeviceIntegration`, `SecurityPolicy`
- `BackupRecord`, `LicenseInfo`, `StorageMetrics`

**Critical requirement**: The unmanaged models must exactly mirror the main backend's schema. Any field mismatch causes a PostgreSQL error at runtime.

---

## 7. Authentication & Authorization

### 7.1 Main backend auth flow

1. **Primary**: Local DB authentication via `django.contrib.auth.authenticate()`
2. **Fallback**: Supabase authentication (legacy, dead fallback)
3. **Session**: Token-based via `rest_framework.authtoken`

Auth code lives in `medos/auth/`:
- `views.py` — `login_view`, `auth_me`, `change_password`
- `authentication.py` — `ExpiringTokenAuthentication`, custom auth backends

### 7.2 Internal ops backend auth flow

1. **Staff check**: `POST /api/internal/login/` authenticates via `django.contrib.auth.authenticate()`
2. **is_staff gate**: If user is not `is_staff=True`, returns 403
3. **Token**: DRF `Token` model with expiry support via `medos_internal/auth.py`
4. **Permission**: All endpoints require `IsAuthenticated + IsStaffUser`

### 7.3 Tenant isolation

The main backend enforces hospital-scoped data isolation via `HospitalScopedViewSet` (`views/base.py`):

- All model queries auto-filtered by `hospital_id`
- `perform_create()` auto-attaches the user's hospital
- Cross-tenant access returns 404 (not 403) to prevent resource enumeration
- The internal ops backend has **no tenant scoping** — it sees all hospitals

### 7.4 Deleted code

- `auth_backends.py` (Keycloak JWT auth) — deleted, was dead code
- `supabase_auth.py`, `cookie_auth.py` — merged into `medos/auth/`
- `views/auth.py` — replaced by `medos/auth/views.py`

---

## 8. Architecture Cleanups Summary

### Round 1 — Foundation Cleanups

| # | Candidate | Description | Net Δ | Frontend Impact |
|---|---|---|---|---|
| 1 | Delete `views/internal.py` | Removed 431 lines of dead code | −431 | ✅ None |
| 2 | Move `admin_views.py` | Into `views/` package (later split) | 0 | ✅ None |
| 3 | Consolidate auth | `supabase_auth.py` + `cookie_auth.py` → `medos/auth/` package | −220 | ✅ None |
| 4 | Split models | `models.py` → `medos/models/` (10 files) | 0 | ✅ None |
| 5 | Consolidate alert engine | `medos/alerts/engine.py` wired correctly | −16 | ✅ None |
| 6 | Convert settings | `settings.py` → `medos_project/settings/` package | 0 | ✅ None |
| | **Round 1 total** | | **~−4,000** | |

### Round 1.5 — Zero-Risk Cleanups

| # | Candidate | Description | Net Δ | Frontend Impact |
|---|---|---|---|---|
| 1 | Delete `alert_engine.py` shim | Zero callers confirmed | −16 | ✅ None |
| 2 | Merge `admin_models.py` | Models moved into `models/admin.py` + `models/hospital.py` | 0 | ✅ None |
| 3 | Collapse settings views | 8 views → 1 generic view + registry | −113 | ✅ None |
| 4 | Consolidate settings models | `SingletonSettingsBase` for 8 singleton models | −105 | ✅ None |
| | **Round 1.5 total** | | **−234** | |

### Round 2 — Targeted Deepenings

| # | Candidate | Description | Net Δ | Frontend Impact |
|---|---|---|---|---|
| 1 | Split `hospital_admin.py` | 831 lines → `views/admin/` package (11 files) | +3 | ✅ None |
| 2 | Merge vitals consumers | `VitalsConsumer` handles both paths | −26 | ✅ None |
| 3 | Extract TeleICU helpers | `teleicu/helpers.py` — dashboard, trend, monitored patients | −159 (in view) | ✅ None |
| | **Round 2 total** | | **+2** (package overhead) | |

### Round 3 — Final Cleanups

| # | Candidate | Description | Net Δ | Frontend Impact |
|---|---|---|---|---|
| 1 | Delete `admin_models.py` shim | Backward-compat shim, zero callers | −8 | ✅ None |
| 2 | Deepen billing transactions | Extract `billing/transactions.py` helper | −27 (in view) | ✅ None |
| 3 | Split `views/lab.py` | 536 lines → `views/lab/` package (9 files) | +47 | ✅ None |
| 4 | Split `admin_serializers.py` | 356 lines → `serializers/admin/` package (11 files) | +32 | ✅ None |
| | **Round 3 total** | | **+121** | |

### Overall impact

| Metric | Value |
|--------|-------|
| Files deleted | 9 files (1,060+ lines) |
| Lines removed (gross) | ~4,267 |
| Lines added (package overhead) | ~507 |
| **Net lines removed** | **~3,760** |
| API contract changes | **Zero** |
| Frontend-impactful changes | **Zero** |
| Bugs discovered and fixed | 3 (import bugs in admin views, alert serializers) |

### Files deleted

| File | Lines | Round |
|------|-------|-------|
| `views/internal.py` | 431 | R1 |
| `auth_backends.py` | 246 | R1 |
| `views/auth.py` | 297 | R1 |
| `supabase_auth.py` | 220 | R1 |
| `cookie_auth.py` | 9 | R1 |
| `models.py` (monolithic) | 2,259 | R1 |
| `settings.py` (monolithic) | 178 | R1 |
| `alert_engine.py` (shim) | 32 | R1.5 |
| `admin_models.py` (shim) | 8 | R3 |
| **Total** | **~3,680** | |

---

## 9. Frontend-Backend Correspondence

### 9.1 Main frontend → main backend (port 8000)

| Frontend Page | API Endpoints | Backend Module | Scope |
|--------------|--------------|---------------|-------|
| Login | `POST /api/login/` | `medos/auth/views.py` | Any |
| Dashboard | `GET /api/dashboard/` | `medos/views/dashboard.py` | Hospital |
| Patients | `GET/POST /api/patients/` | `medos/views/patients.py` | Hospital |
| Patient Detail | `GET /api/patients/<id>/` | `medos/views/patients.py` | Hospital |
| Encounters | `GET/POST /api/encounters/` | `medos/views/encounters.py` | Hospital |
| Encounter Detail | `GET /api/encounters/<id>/` | `medos/views/encounters.py` | Hospital |
| Billing | `GET /api/invoices/`, `/api/billing/dashboard/`, `/api/billing/transactions/`, `/api/billing/insights/` | `medos/views/billing.py` | Hospital |
| Billing Invoice Detail | `GET /api/invoices/<id>/` | `medos/views/billing.py` | Hospital |
| Laboratory | `GET /api/lab-panels/`, `/api/lab-orders/`, `/api/lab-results/trend/`, etc. | `medos/views/lab/` package | Hospital |
| TeleICU | `GET /api/teleicu/...` | `medos/views/teleicu.py` + `medos/teleicu/helpers.py` | Hospital |
| Care Scribe | `POST /api/care-scribe/`, etc. | `medos/views/scribe.py` | Hospital |
| Reports | `GET /api/reports/...` | `medos/reports/` package | Hospital |
| Settings | `GET /api/settings/<slug>/`, etc. | `medos/settings_views.py` | Hospital |
| Admin Panel | `GET /api/admin/kpis/`, `/api/admin/user-activity/`, `/api/admin/system-alerts/`, etc. (11 endpoints) | `medos/views/admin/dashboard.py` | Hospital |
| Admin CRUD | `GET/POST/PATCH/DELETE /api/admin/users/`, `roles/`, `departments/`, etc. | `medos/views/admin/*.py` | Hospital |

### 9.2 Internal ops frontend → internal ops backend (port 8001)

| Frontend Page | API Endpoint | Backend Module | Scope |
|--------------|-------------|---------------|-------|
| Login | `POST /api/internal/login/` | `medos_internal/views.py` | Staff |
| Hospitals Dashboard | `GET /api/internal/hospitals/` | `medos_internal/views.py` | Global |
| Hospital Detail | `GET /api/internal/hospitals/<id>/` | `medos_internal/services/hospital_detail.py` | Global |
| New Hospital Wizard | `POST /api/internal/hospitals/create/` | `medos_internal/services/hospital_onboarding.py` | Global |
| Platform Stats | `GET /api/internal/stats/` | `medos_internal/services/dashboard.py` | Global |
| Admin Dashboard Overview | `GET /api/internal/admin/dashboard/overview/` | `medos_internal/services/dashboard.py` | Global |
| Admin Dashboard Activity | `GET /api/internal/admin/dashboard/activity/` | `medos_internal/services/dashboard.py` | Global |
| Admin Dashboard Alerts | `GET /api/internal/admin/dashboard/alerts/` | `medos_internal/services/dashboard.py` | Global |

### 9.3 Admin dashboard: two scopes, not duplication

The admin dashboard endpoints on both backends serve **different consumers**:

| Aspect | 11 individual endpoints (port 8000) | 3 composite endpoints (port 8001) |
|--------|-----------------------------------|-----------------------------------|
| **Scope** | Per-hospital admin dashboard | Platform-wide ops dashboard |
| **User** | Hospital admin (sees 1 hospital) | Internal ops staff (sees all hospitals) |
| **Data volume** | ~dozens of rows per query | Aggregated across all hospitals |
| **Query pattern** | `WHERE hospital_id = ?` | `SELECT COUNT(*) FROM ...` |
| **Frontend** | `medos/frontend/ AdminPanel.tsx → AdminDashboard.tsx` | `medos_internal_frontend/frontend/ AdminDashboard.tsx` |

**Both should stay as-is.** Unifying would require either adding `?hospital_id=` params to composite endpoints (defeating the composite purpose) or forcing hospital admins to fetch platform-wide responses.

---

## 10. Scalability at 4M Hospitals

At 4 million hospitals, the **individual endpoints are superior to composites** for the main backend's admin dashboard.

### 10.1 Independent cache TTLs

| Endpoint | Data freshness | Cache TTL | Query cost |
|----------|---------------|-----------|------------|
| `kpis` | Slow (daily) | 5 min | Light — aggregate counts via index |
| `module-status` | Slow | 5 min | Light — status flags |
| `system-alerts` | Fast | 30 s | Medium — unresolved alerts |
| `user-activity` | Slow | 5 min | Heavy — login stats across hospital staff |
| `audit-summary` | Medium | 2 min | Heavy — category counts |
| `storage` | Slow | 10 min | Light — one row |

A composite endpoint bundles fast + slow data → forced to the shortest TTL for everything → 6× more cache misses. At 4M hospitals, heavy queries (user activity, audit summary) recompute every 30 seconds even if only alerts changed.

### 10.2 Frontend lazy-loads per tab

The main frontend `AdminDashboard.tsx` uses a 3-tab layout. Individual endpoints fetch only data for the active tab:

- **Tab 1 (Overview):** 3-4 endpoints (kpis, module-status, storage, license)
- **Tab 2 (Activity):** 2 endpoints (user-activity, audit-summary)
- **Tab 3 (Alerts):** 1 endpoint (system-alerts)

Composite endpoints force fetching **all data on every request** — the user-activity query runs even when the user only wants alerts.

### 10.3 Materialized views strategy

At 4M scale, **nothing computes in real-time**. Background jobs (Celery beat) refresh materialized views on independent schedules:

```
medos_admin_kpis_mv          → refresh every 5 min
medos_user_activity_mv       → refresh every 5 min
medos_system_alerts_mv       → refresh every 30 s
medos_audit_summary_mv       → refresh every 2 min
```

Both backends can read from the same materialized views. The endpoints stay separate (different consumers, different `WHERE` clauses), but the **query layer is shared**.

### 10.4 Strategy: Keep both, share the query layer

| Layer | Recommendation |
|-------|---------------|
| **API endpoints** | Keep individual (port 8000, per-hospital) + composite (port 8001, platform-wide). Different consumers, different scoping. |
| **Query layer** | Extract into shared helpers or materialized views that both backends import. No duplicate SQL. |
| **Caching** | Per-endpoint cache TTLs. Redis with different expiry per key prefix. |
| **Background jobs** | Celery beat refreshes materialized views. Both backends query the same pre-computed tables. |
| **Database** | Read replicas for heavy query endpoints. Connection pooling tuned per query profile. |

---

## 11. Known Technical Debt

### 11.1 Missing API versioning

All endpoints are versionless (`/api/patients/`, not `/api/v1/patients/`). The frontend hardcodes paths in API clients. Any URL pattern rename silently breaks the frontend.

### 11.2 No contract tests

There's no OpenAPI spec or contract test validating response shapes between frontend TypeScript types and backend serializer output. The TypeScript interfaces in both frontends are manually maintained — drift is possible.

### 11.3 Duplicated serializers

The main backend's `medos/admin_serializers.py` (now a shim for `serializers/admin/`) and the internal ops backend's `medos_internal/serializers.py` both define serializers for shared models like `User`, `Role`, `Hospital`. They're maintained independently.

### 11.4 Unmanaged schema drift risk

The internal ops backend's unmanaged models must exactly mirror the main backend's schema. Any migration on the main backend that adds/renames a field on `medos_hospital`, `medos_patient`, etc. will cause a runtime error in the internal ops backend until its models are updated.

### 11.5 Admin table ownership ambiguity

Tables like `medos_hospital`, `medos_department`, `medos_systemsetting` exist in both backends — the main backend created them via migrations, but the internal ops backend declares them as managed models with explicit `db_table`. This creates a risk of migration conflicts if both projects attempt to alter the same table.

### 11.6 No dedicated analytics database

At scale, OLAP queries (aggregate counts, dashboard stats) would compete with OLTP queries (patient CRUD, encounter writes) on the same PostgreSQL instance. No dedicated analytics replica or data warehouse exists.

### 11.7 Settings singleton model complexity

The 8 singleton settings models each have identical fields (`id`, `created_at`, `updated_at`, plus domain-specific JSON fields). They could be collapsed into a single `KeyValueSetting` model, but the current design uses separate models for clarity.

### 11.8 Frontend type duplication

The internal ops frontend defines TypeScript interfaces in `types.ts` that mirror backend serializer output. These are manually kept in sync — there's no code-generation pipeline.

---

## 12. Recommendations

### Short-term (next sprint)

1. **Add API version prefix** — `/api/v1/` to all endpoints. `urls.py` can be wrapped with a single prefix. Frontend clients update their base URL.

2. **Generate TypeScript types from DRF** — Use `openapi-typescript` or `@openapitools/openapi-generator` to generate TypeScript interfaces from DRF's schema generation. Replace manually-maintained `types.ts` and `internalApi.ts` interfaces.

3. **Contract tests** — Add a test suite that hits each endpoint and validates response shape against generated TypeScript types. Run in CI to catch drift.

4. **Materialized view proof-of-concept** — Start with the `admin_kpis` endpoint. Create a Celery beat task that refreshes a materialized view every 5 minutes. The endpoint reads from the materialized view instead of running raw COUNT queries.

### Medium-term (next quarter)

5. **Extract shared query layer** — Both backends compute similar aggregates (hospital count, patient count, encounter count). Extract into `medos/shared/queries.py` or a shared Python package that both Django projects can import.

6. **Read replica routing** — Configure database routers so heavy dashboard/analytics queries route to a read replica. OLTP queries (patient CRUD) go to the primary.

7. **Audit log pruning automation** — The internal ops backend already has `purge_old_logs.py` management command. Productionize it as a Celery beat task with configurable retention.

8. **Schema drift detection** — Add a CI check that compares unmanaged model fields in the internal ops backend against the main backend's managed models. Fail if they diverge.

### Long-term (next year)

9. **Dedicated analytics database** — Separate the OLAP workload (dashboard stats, reports, aggregates) into a Postgres read replica or a dedicated analytics store (ClickHouse, TimescaleDB). Use materialized views or streaming replication.

10. **API gateway / BFF** — If the two frontends continue to diverge, introduce a BFF (Backend-for-Frontend) layer that sits between the frontends and backends. The BFF handles authentication, response shaping, and routing to the appropriate backend.

11. **Event-driven architecture** — Replace polling-based aggregated queries with event-driven counters. When a new patient is created, an event increments a counter table. Dashboard reads are O(1) lookups.

---

*Report generated 11 June 2026. Covers architecture cleanups Rounds 1–3, both projects, and scalability analysis.*
