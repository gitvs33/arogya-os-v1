# Administration Pipeline — Complete Backend Logic

> **File:** `backend/medos/admin_views.py`, `admin_models.py`, `admin_serializers.py`, `admin.py`, `urls.py`
>
> **Frontend:** `frontend/src/pages/AdminPanel.tsx` → `admin-tabs/*.tsx` → `api/adminApi.ts`

---

## Pipeline Flow Diagram

```
                          ┌─────────────────────────────────────┐
                          │        Browser (React SPA)           │
                          │   AdminPanel.tsx → Tab → useQuery()  │
                          │        ↓                             │
                          │   adminApi.ts → client.get('/...')   │
                          │        ↓                             │
                          │   Axios (token in header)            │
                          └────────────┬────────────────────────┘
                                       │ HTTP GET/POST/PATCH/DELETE
                                       │ /api/admin/{endpoint}/
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Django ASGI/WSGI (manage.py → medos_project)                    │
│     ↓                                                             │
│  medos_project/urls.py                                           │
│     path('api/', include('medos.urls'))                           │
│     ↓                                                             │
│  medos/urls.py                                                    │
│     path('admin/kpis/', admin_views.admin_kpis)                   │
│     path('admin/', include(admin_views.admin_router.urls))        │
│     ↓                                                             │
│  medos/admin_views.py                                             │
│     ┌─ Dashboard functions (11 endpoints)                        │
│     │  admin_kpis()              → AdminKPISerializer            │
│     │  admin_system_overview_chart() → SystemOverviewPoint       │
│     │  admin_module_status()     → AdminModuleSerializer         │
│     │  admin_system_alerts()     → SystemAlertSerializer         │
│     │  admin_user_activity()     → UserActivitySerializer        │
│     │  admin_audit_summary()     → AuditSummarySerializer        │
│     │  admin_security_overview() → SecurityOverviewSerializer    │
│     │  admin_recent_activities() → RecentActivitySerializer     │
│     │  admin_database_storage()  → DatabaseStorageSerializer    │
│     │  admin_license_info()      → LicenseInfoSerializer         │
│     │  admin_system_info()       → SystemInfoSerializer          │
│     │                                                             │
│     └─ CRUD ViewSets (10 classes)                                │
│        AdminUserViewSet        → AdminUserSerializer             │
│        AdminRoleViewSet        → AdminRoleSerializer             │
│        AdminDepartmentViewSet  → DepartmentSerializer            │
│        AdminMasterDataViewSet  → MasterDataEntrySerializer       │
│        AdminSystemSettingViewSet → SystemSettingSerializer       │
│        AdminWorkflowViewSet    → WorkflowDefinitionSerializer    │
│        AdminDeviceViewSet      → DeviceIntegrationSerializer     │
│        AdminSecurityViewSet    → SecurityPolicySerializer        │
│        AdminAuditLogViewSet    → AuditLogSerializer              │
│        AdminBackupViewSet      → BackupRecordSerializer          │
│     ↓                                                             │
│  ORM Models                                                       │
│     admin_models.py  (12 models)                                  │
│     models.py         (core domain models)                       │
│     settings_models.py (hospital settings)                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Request Lifecycle (Detailed)

### Step 1: URL Resolution

```
Request: GET /api/admin/kpis/
                        │
Root URLconf:           │  medos_project/urls.py
  path('api/', ...)     │  → includes medos/urls.py
                        ▼
App URLconf:            medos/urls.py
  path('admin/kpis/', admin_views.admin_kpis, name='admin-kpis')
                        │
                        ▼
Function dispatch:      admin_kpis(request)
```

### Step 2: Authentication Check

```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])  # DRF permission class
def admin_kpis(request):
    # If token is invalid/expired → 401 Unauthorized
    # If token is valid → request.user is set
    ...
```

Token extracted from `Authorization: Token <token>` header by DRF's `TokenAuthentication`.

### Step 3: Business Logic (Querying ORM)

```python
def admin_kpis(request):
    # ── Count queries ─────────────────────────────────
    total_users_count = User.objects.count()
    
    # ── Filtered queries ──────────────────────────────
    active_user_ids = UserLoginActivity.objects.filter(
        login_timestamp__gte=thirty_days_ago,
        was_successful=True,
    ).values_list('user_id', flat=True).distinct()
    
    # ── Aggregate queries ─────────────────────────────
    uptime_pct = ((total - offline) / total) * 100
    
    # ── Latest record ─────────────────────────────────
    latest_storage = StorageMetrics.objects.order_by('-recorded_at').first()
```

### Step 4: Serialization

```python
data = {
    'total_users': {'count': total_users_count, 'growth': users_growth},
    'active_users': {'count': active_users_count, 'percentage': active_users_pct},
    ...
}
serializer = AdminKPISerializer(data)   # validates + transforms
return Response(serializer.data)        # DRF Response → JSON
```

### Step 5: Response

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

---

## CRUD ViewSet — Detailed Lifecycle (AdminUserViewSet example)

```
PATCH /api/admin/users/{id}/  with body {"is_active": false}
        │
        ▼
DefaultRouter maps:           admin_router.register(r'users', AdminUserViewSet)
        │
        ▼
ViewSet dispatch:             AdminUserViewSet.partial_update(request, pk=id)
        │
        ▼
get_object():                 User.objects.get(pk=id)
        │
        ▼
perform_update():             serializer.save()
        │
        ▼
Response:                     Serialized user JSON with is_active=false
        │
        ▼
Frontend mutation.onSuccess:  queryClient.invalidateQueries(['users'])
                              → table re-fetches → UI updates
```

For custom actions:

```
POST /api/admin/users/{id}/toggle_active/
        │
        ▼
@action(detail=True, methods=['post'])
def toggle_active(self, request, pk=None):
    user = self.get_object()
    user.is_active = not user.is_active
    user.save()
    SystemActivityLog.objects.create(event_type='USER_STATUS_CHANGE', ...)
    return Response({'status': 'success', 'is_active': user.is_active})
```
