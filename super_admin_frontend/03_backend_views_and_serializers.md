# Backend Views & Serializers — Admin Panel

> **Views:** `backend/medos/admin_views.py` (≈570 lines)
> **Serializers:** `backend/medos/admin_serializers.py` (≈370 lines)

---

## SECTION 1 — Dashboard Overview Endpoints (11 Functions)

### 1.0 Router Setup
```python
admin_router = DefaultRouter()
admin_router.register(r'users', AdminUserViewSet, basename='admin-users')
admin_router.register(r'roles', AdminRoleViewSet, basename='admin-roles')
admin_router.register(r'departments', AdminDepartmentViewSet, basename='admin-departments')
admin_router.register(r'master-data', AdminMasterDataViewSet, basename='admin-master-data')
admin_router.register(r'settings', AdminSystemSettingViewSet, basename='admin-settings')
admin_router.register(r'workflows', AdminWorkflowViewSet, basename='admin-workflows')
admin_router.register(r'devices', AdminDeviceViewSet, basename='admin-devices')
admin_router.register(r'security', AdminSecurityViewSet, basename='admin-security')
admin_router.register(r'audit-logs', AdminAuditLogViewSet, basename='admin-audit-logs')
admin_router.register(r'backups', AdminBackupViewSet, basename='admin-backups')
```

### 1.1 `admin_kpis(request)` → AdminKPISerializer
**Route:** `GET /api/admin/kpis/`

**Logic:**
1. Queries `User.objects.count()` for total users
2. Computes growth by comparing users joined in last 30 days vs previous 30 days
3. Counts distinct users in `UserLoginActivity` within 30 days → active users %
4. Counts `Department.objects.count()` + departments created last month
5. Counts `Role.objects.count()`
6. Calculates uptime % = (total_modules - offline_modules) / total_modules × 100
7. Gets latest `StorageMetrics` → converts GB to TB, computes %

**Response shape:**
```json
{
  "total_users": {"count": 1245, "growth": "+12 this month"},
  "active_users": {"count": 1120, "percentage": 90.0},
  "departments": {"count": 8, "growth": "+1 this month"},
  "roles": {"count": 6},
  "system_uptime": {"percentage": 99.9},
  "storage_used": {"used": "1.2 TB", "total": "2.0 TB", "percentage": 60.0}
}
```

### 1.2 `admin_system_overview_chart(request)` → SystemOverviewPointSerializer
**Route:** `GET /api/admin/system-overview-chart/?period=last_7_days`

**Logic:**
1. Parses `period` query param (default: `last_7_days` → 7 days, `last_30_days` → 30 days)
2. Iterates over each day in range
3. For each day, queries:
   - `UserLoginActivity` count where login_timestamp matches day
   - `Payment` count where transaction_time matches day and status='SUCCESS'
   - `SystemActivityLog` count where timestamp matches day and event_type contains 'error'
4. Returns array of `{date, logins, transactions, errors}` per day

### 1.3 `admin_module_status(request)` → AdminModuleSerializer
**Route:** `GET /api/admin/module-status/`

**Logic:**
1. Queries all `AdminModule` records
2. If table is empty, seeds 7 default modules (emr, patient_registration, billing, pharmacy, laboratory, teleicu, ai_services)
3. Serializes with `name` field mapped from `label` (for frontend icon lookup)

### 1.4 `admin_system_alerts(request)` → SystemAlertSerializer
**Route:** `GET /api/admin/system-alerts/`

**Logic:**
1. Queries `SystemAlert.objects.filter(is_resolved=False)[:50]`
2. Returns `id, severity, title, description, timestamp (=created_at), is_resolved, resolved_at`

### 1.5 `admin_user_activity(request)` → UserActivitySerializer
**Route:** `GET /api/admin/user-activity/`

**Logic:**
1. Aggregates `UserLoginActivity` by `user_id` within last 30 days, annotates with `Count('id')`, orders by count descending, limits to 10
2. For each entry, fetches `User` object and `hospital_profile` for role name
3. Returns `{user_id, name, avatar_url, role, logins_count, last_login_timestamp}`

### 1.6 `admin_audit_summary(request)` → AuditSummarySerializer
**Route:** `GET /api/admin/audit-summary/`

**Logic:**
1. Groups `SystemActivityLog` by `event_type`, annotates with count, orders desc
2. Computes percentage for each category
3. Returns `{total_logs, categories: [{name, count, percentage}]}`

### 1.7 `admin_security_overview(request)` → SecurityOverviewSerializer
**Route:** `GET /api/admin/security-overview/`

**Logic:**
1. Loads all `SecurityPolicy` objects into dict keyed by `policy_type`
2. Extracts password_policy strength, two_factor enforcement, session timeout
3. Returns `{password_policy, two_factor_enforcement, session_timeout}`

### 1.8 `admin_recent_activities(request)` → RecentActivitySerializer
**Route:** `GET /api/admin/recent-activities/`

**Logic:**
1. Queries latest 20 `SystemActivityLog` entries
2. Maps `event_type` → frontend `action_type` (user, role, department, database, system)
3. Returns `{id, action_type, description, timestamp, author_name}`

### 1.9 `admin_database_storage(request)` → DatabaseStorageSerializer
**Route:** `GET /api/admin/database-storage/`

**Logic:**
1. Gets latest `StorageMetrics` record
2. Converts GB to TB
3. Returns `{storage_used_tb, storage_total_tb, database_status, last_backup, next_backup}`

### 1.10 `admin_license_info(request)` → LicenseInfoSerializer
**Route:** `GET /api/admin/license-info/`

**Logic:**
1. Queries `LicenseInfo.objects.filter(is_active=True).first()`
2. If found, serializes (with dynamic `active_users` count from `User.objects.filter(is_active=True).count()`)
3. If not found, returns default data (Enterprise, valid 2026-2027, 8/10 modules, 500 user limit)

### 1.11 `admin_system_info(request)` → SystemInfoSerializer
**Route:** `GET /api/admin/system-info/`

**Logic:**
1. Reads `platform.node()` for server name
2. Reads `settings.ENVIRONMENT`, `settings.TIME_ZONE`
3. Reads `sys.version`, `django.get_version()`
4. Returns `{version, environment, server_name, server_time, timezone, python_version, django_version, database}`

---

## SECTION 2 — CRUD ViewSets (10 Classes)

### 2.1 AdminUserViewSet
| Action | Method | Endpoint | Notes |
|---|---|---|---|
| list | GET | `/api/admin/users/` | Filters: `is_active`, `role_id`, `department`. Selects related `hospital_profile__role` |
| create | POST | `/api/admin/users/` | Uses `AdminUserCreateSerializer`. Creates User + HospitalUserProfile in transaction |
| retrieve | GET | `/api/admin/users/{id}/` | — |
| update | PUT | `/api/admin/users/{id}/` | — |
| partial_update | PATCH | `/api/admin/users/{id}/` | — |
| destroy | DELETE | `/api/admin/users/{id}/` | — |
| reset_password | POST | `/api/admin/users/{id}/reset_password/` | Body: `{"password": "..."}` |
| toggle_active | POST | `/api/admin/users/{id}/toggle_active/` | Flips `is_active`, logs to SystemActivityLog |
| activity_stats | GET | `/api/admin/users/activity_stats/` | Returns total_users, active_users, active_pct, users_logged_in_30d |

**`perform_create` detailed logic:**
```python
@transaction.atomic
def perform_create(self, serializer):
    data = serializer.validated_data
    # 1. Create User
    user = User.objects.create_user(
        username=data['username'],
        email=data.get('email', ''),
        password=data['password'],
        first_name=data.get('first_name', ''),
        last_name=data.get('last_name', ''),
        is_active=data.get('is_active', True),
    )
    # 2. Look up Role
    role_id = data.get('role_id')
    role = Role.objects.filter(id=role_id).first() if role_id else None
    # 3. Create/Update HospitalUserProfile
    HospitalUserProfile.objects.update_or_create(
        user=user,
        defaults={
            'employee_id': data.get('employee_id', ''),
            'role': role,
            'department': data.get('department', ''),
            'designation': data.get('designation', ''),
            'phone': data.get('phone', ''),
        },
    )
```

### 2.2 AdminRoleViewSet
| Action | Method | Endpoint | Notes |
|---|---|---|---|
| list | GET | `/api/admin/roles/` | Orders by `name`. `user_count` computed via `HospitalUserProfile.objects.filter(role=obj).count()` |
| create | POST | `/api/admin/roles/` | — |
| retrieve | GET | `/api/admin/roles/{id}/` | — |
| update | PUT | `/api/admin/roles/{id}/` | — |
| partial_update | PATCH | `/api/admin/roles/{id}/` | Used for permission updates |
| destroy | DELETE | `/api/admin/roles/{id}/` | — |

### 2.3 AdminDepartmentViewSet
| Action | Method | Endpoint | Notes |
|---|---|---|---|
| list | GET | `/api/admin/departments/` | Filters: `is_active` |
| create | POST | `/api/admin/departments/` | — |
| retrieve | GET | `/api/admin/departments/{id}/` | Includes `head_name` serialized from HoD |
| update | PUT | `/api/admin/departments/{id}/` | — |
| partial_update | PATCH | `/api/admin/departments/{id}/` | — |
| destroy | DELETE | `/api/admin/departments/{id}/` | — |
| staff_count | GET | `/api/admin/departments/{id}/staff_count/` | Counts `HospitalUserProfile` matching department name |

### 2.4 AdminMasterDataViewSet
| Action | Method | Endpoint | Notes |
|---|---|---|---|
| list | GET | `/api/admin/master-data/` | Filters: `category`, `is_active`. Orders by category, display_order |
| create | POST | `/api/admin/master-data/` | — |
| retrieve | GET | `/api/admin/master-data/{id}/` | — |
| update | PUT | `/api/admin/master-data/{id}/` | — |
| partial_update | PATCH | `/api/admin/master-data/{id}/` | — |
| destroy | DELETE | `/api/admin/master-data/{id}/` | — |
| categories | GET | `/api/admin/master-data/categories/` | Returns distinct category values |

### 2.5 AdminSystemSettingViewSet
| Action | Method | Endpoint | Notes |
|---|---|---|---|
| list | GET | `/api/admin/settings/` | Filters: `category`, `value_type` |
| create | POST | `/api/admin/settings/` | Sets `updated_by = request.user` |
| retrieve | GET | `/api/admin/settings/{id}/` | — |
| update | PUT | `/api/admin/settings/{id}/` | Sets `updated_by = request.user` |
| partial_update | PATCH | `/api/admin/settings/{id}/` | Sets `updated_by = request.user` |
| destroy | DELETE | `/api/admin/settings/{id}/` | — |

### 2.6 AdminWorkflowViewSet
| Action | Method | Endpoint | Notes |
|---|---|---|---|
| list | GET | `/api/admin/workflows/` | Filters: `module`, `is_active` |
| create | POST | `/api/admin/workflows/` | Sets `created_by = request.user` |
| retrieve | GET | `/api/admin/workflows/{id}/` | — |
| update | PUT | `/api/admin/workflows/{id}/` | — |
| partial_update | PATCH | `/api/admin/workflows/{id}/` | — |
| destroy | DELETE | `/api/admin/workflows/{id}/` | — |

### 2.7 AdminDeviceViewSet
| Action | Method | Endpoint | Notes |
|---|---|---|---|
| list | GET | `/api/admin/devices/` | Filters: `device_type`, `is_active`, `auth_type` |
| create | POST | `/api/admin/devices/` | — |
| retrieve | GET | `/api/admin/devices/{id}/` | — |
| update | PUT | `/api/admin/devices/{id}/` | — |
| partial_update | PATCH | `/api/admin/devices/{id}/` | — |
| destroy | DELETE | `/api/admin/devices/{id}/` | — |
| test_connection | POST | `/api/admin/devices/{id}/test_connection/` | Mock connection test |
| heartbeat | POST | `/api/admin/devices/{id}/heartbeat/` | Updates `last_heartbeat = now()` |
| online | GET | `/api/admin/devices/online/` | Filters devices with heartbeat in last 5 min |

### 2.8 AdminSecurityViewSet
| Action | Method | Endpoint | Notes |
|---|---|---|---|
| list | GET | `/api/admin/security/` | Filters: `policy_type`, `is_enforced` |
| create | POST | `/api/admin/security/` | Sets `updated_by = request.user` |
| retrieve | GET | `/api/admin/security/{id}/` | — |
| update | PUT | `/api/admin/security/{id}/` | Sets `updated_by = request.user` |
| partial_update | PATCH | `/api/admin/security/{id}/` | Sets `updated_by = request.user` |
| destroy | DELETE | `/api/admin/security/{id}/` | — |
| overview | GET | `/api/admin/security/overview/` | Consolidated security status |

### 2.9 AdminAuditLogViewSet (ReadOnly)
| Action | Method | Endpoint | Notes |
|---|---|---|---|
| list | GET | `/api/admin/audit-logs/` | Filters: `event_type`, `patient`. Orders by `-timestamp`. Paginated |
| retrieve | GET | `/api/admin/audit-logs/{id}/` | Selects related `patient`, `encounter` |

### 2.10 AdminBackupViewSet
| Action | Method | Endpoint | Notes |
|---|---|---|---|
| list | GET | `/api/admin/backups/` | Filters: `status`, `backup_type`. Orders by `-started_at` |
| create | POST | `/api/admin/backups/` | Sets `triggered_by = request.user` |
| retrieve | GET | `/api/admin/backups/{id}/` | — |
| partial_update | PATCH | `/api/admin/backups/{id}/` | — |
| destroy | DELETE | `/api/admin/backups/{id}/` | — |
| trigger | POST | `/api/admin/backups/trigger/` | Creates backup record IN_PROGRESS → immediately sets COMPLETED with mock size |
| restore | POST | `/api/admin/backups/{id}/restore/` | Mock restore initiation |

---

## Serializers Detail

### Dashboard Serializers (reader-only)
| Serializer | Fields |
|---|---|
| `AdminKPISerializer` | total_users, active_users, departments, roles, system_uptime, storage_used (all as KPISubObjectField) |
| `SystemOverviewPointSerializer` | date (str), logins (int), transactions (int), errors (int) |
| `AdminModuleSerializer` | id, name (source=label), label, status, is_critical, updated_at |
| `SystemAlertSerializer` | id, severity, title, description, timestamp (source=created_at), is_resolved, created_at, resolved_at |
| `UserActivitySerializer` | user_id, name, avatar_url, role, logins_count, last_login_timestamp |
| `AuditCategorySerializer` | name, count, percentage |
| `AuditSummarySerializer` | total_logs, categories (list of AuditCategory) |
| `SecurityOverviewSerializer` | password_policy (str), two_factor_enforcement (str), session_timeout (str) |
| `RecentActivitySerializer` | id, action_type, description, timestamp (DateTimeField), author_name |
| `DatabaseStorageSerializer` | storage_used_tb, storage_total_tb, database_status, last_backup, next_backup |
| `LicenseInfoSerializer` | edition, valid_from, valid_till, registered_modules, total_modules, active_users (dynamic), user_limit, is_active |
| `SystemInfoSerializer` | version, environment, server_name, server_time, timezone, python_version, django_version, database |

### CRUD Serializers (read-write)
| Serializer | Notes |
|---|---|
| `AdminUserSerializer` | SerializerMethodFields for role, role_id, employee_id, department, designation from hospital_profile |
| `AdminUserCreateSerializer` | Write-only. Fields: username, email, password, first_name, last_name, employee_id, role_id, department, designation, phone, is_active |
| `AdminRoleSerializer` | Includes `user_count` via SerializerMethodField (HospitalUserProfile count) |
| `DepartmentSerializer` | Includes `head_name` (user full name) via SerializerMethodField |
| `MasterDataEntrySerializer` | Standard ModelSerializer |
| `SystemSettingSerializer` | Standard ModelSerializer |
| `WorkflowDefinitionSerializer` | Standard ModelSerializer |
| `DeviceIntegrationSerializer` | Standard ModelSerializer |
| `SecurityPolicySerializer` | Includes `policy_type_display` (human-readable) |
| `AuditLogSerializer` | Read-only. Includes `patient_name`, `event_type_display` |
| `BackupRecordSerializer` | Includes `triggered_by_name` (user full name), `duration_seconds` (computed) |
