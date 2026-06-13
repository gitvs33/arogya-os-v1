# Backend Models — Admin Panel (`admin_models.py`)

> **File:** `backend/medos/admin_models.py`
>
> **Migration:** `backend/medos/migrations/0012_admin_panel_models.py`
> **Seed Data:** `backend/medos/migrations/0013_seed_admin_data.py`

---

## 12 Models — Complete Schema

### 1. AdminModule
```python
class AdminModule(models.Model):
    """Tracks real-time operational status of system modules."""
    id          = UUIDField(primary_key, default=uuid4)
    name        = CharField(100, unique)       # machine name: "emr", "billing"
    label       = CharField(100)                # human: "EMR", "Patient Registration"
    status      = CharField(20, choices=STATUS) # Operational|Degraded|Offline
    is_critical = BooleanField(default=False)
    updated_at  = DateTimeField(auto_now=True)
```

### 2. SystemAlert
```python
class SystemAlert(models.Model):
    """System-level notifications (infrastructure, not medical alerts)."""
    id          = UUIDField(primary_key)
    severity    = CharField(20, choices=SEVERITY)  # critical|warning|info|success
    title       = CharField(200)
    description = TextField(blank=True)
    is_resolved = BooleanField(default=False)
    created_at  = DateTimeField(auto_now_add=True)
    resolved_at = DateTimeField(null=True)
    resolved_by = ForeignKey(User, SET_NULL)
```

### 3. UserLoginActivity
```python
class UserLoginActivity(models.Model):
    """Tracks every login for admin analytics."""
    id              = UUIDField(primary_key)
    user            = ForeignKey(User, CASCADE, related_name='login_activities')
    login_timestamp = DateTimeField(auto_now_add=True)
    ip_address      = GenericIPAddressField(null=True)
    user_agent      = TextField(blank=True)
    was_successful  = BooleanField(default=True)
    # Indexes: (-login_timestamp), (user, -login_timestamp)
```

### 4. Department
```python
class Department(models.Model):
    """Hospital department / ward."""
    id                  = UUIDField(primary_key)
    name                = CharField(100, unique)
    code                = CharField(20, unique)     # "CARD", "ORTH"
    description         = TextField(blank=True)
    is_active           = BooleanField(default=True)
    head_of_department  = ForeignKey(User, SET_NULL, related_name='headed_departments')
    created_at          = DateTimeField(auto_now_add=True)
    updated_at          = DateTimeField(auto_now=True)
```

### 5. MasterDataEntry
```python
class MasterDataEntry(models.Model):
    """Lookup table entries for dropdowns and config lists."""
    id            = UUIDField(primary_key)
    category      = CharField(100, db_index)  # "specialty", "encounter_type"
    key           = CharField(100)             # "cardiology", "opd"
    value         = CharField(255)             # "Cardiology", "OPD Consultation"
    is_active     = BooleanField(default=True)
    display_order = IntegerField(default=0)
    metadata      = JSONField(default=dict)
    created_at    = DateTimeField(auto_now_add=True)
    updated_at    = DateTimeField(auto_now=True)
    # Unique: (category, key)
```

### 6. SystemSetting
```python
class SystemSetting(models.Model):
    """Key-value global application configuration."""
    id           = UUIDField(primary_key)
    key          = CharField(100, unique)      # "hospital_name"
    label        = CharField(200)              # "Hospital Name"
    value        = JSONField()                 # stored as JSON
    value_type   = CharField(20, choices)      # string|number|boolean|json|email|url
    category     = CharField(100, choices)     # general|hospital|email|security|billing
    is_encrypted = BooleanField(default=False)
    description  = TextField(blank=True)
    updated_at   = DateTimeField(auto_now=True)
    updated_by   = ForeignKey(User, SET_NULL)
```

### 7. WorkflowDefinition
```python
class WorkflowDefinition(models.Model):
    """State machine workflow (e.g. approval chains)."""
    id            = UUIDField(primary_key)
    name          = CharField(100)
    module        = CharField(100)            # "billing", "pharmacy", "lab"
    description   = TextField(blank=True)
    initial_state = CharField(100)
    states        = JSONField()               # [{"name": "...", "label": "..."}]
    transitions   = JSONField()               # [{"from": "...", "to": "...", "action": "..."}]
    is_active     = BooleanField(default=True)
    created_at    = DateTimeField(auto_now_add=True)
    updated_at    = DateTimeField(auto_now=True)
    created_by    = ForeignKey(User, SET_NULL)
    # Unique: (module, name)
```

### 8. DeviceIntegration
```python
class DeviceIntegration(models.Model):
    """External hardware/device integration."""
    id             = UUIDField(primary_key)
    name           = CharField(100)
    device_type    = CharField(100)           # "biometric_scanner", "lab_machine"
    ip_address     = GenericIPAddressField(null=True)
    port           = IntegerField(null=True)
    api_endpoint   = URLField(blank=True)
    auth_type      = CharField(20, choices)   # api_key|basic|oauth|none
    credentials    = JSONField(default=dict)
    is_active      = BooleanField(default=True)
    last_heartbeat = DateTimeField(null=True)
    metadata       = JSONField(default=dict)
    created_at     = DateTimeField(auto_now_add=True)
    updated_at     = DateTimeField(auto_now=True)
```

### 9. SecurityPolicy
```python
class SecurityPolicy(models.Model):
    """Security config (password, 2FA, session, IP whitelist, login attempts)."""
    id           = UUIDField(primary_key)
    policy_type  = CharField(50, unique, choices=POLICY_TYPES)
    settings     = JSONField(default=dict)   # policy-specific settings
    is_enforced  = BooleanField(default=True)
    description  = TextField(blank=True)
    updated_at   = DateTimeField(auto_now=True)
    updated_by   = ForeignKey(User, SET_NULL)
```

### 10. BackupRecord
```python
class BackupRecord(models.Model):
    """Tracks database backup operations."""
    id            = UUIDField(primary_key)
    backup_type   = CharField(20, choices)    # MANUAL|SCHEDULED
    status        = CharField(20, choices)    # IN_PROGRESS|COMPLETED|FAILED
    file_url      = URLField(blank=True)
    file_size_mb  = FloatField(null=True)
    started_at    = DateTimeField(auto_now_add=True)
    completed_at  = DateTimeField(null=True)
    triggered_by  = ForeignKey(User, SET_NULL)
    notes         = TextField(blank=True)
```

### 11. LicenseInfo
```python
class LicenseInfo(models.Model):
    """Software license and subscription details."""
    id                = UUIDField(primary_key)
    edition           = CharField(50, choices)    # Community|Professional|Enterprise
    license_key       = CharField(200, blank=True)
    valid_from        = DateField()
    valid_till        = DateField()
    registered_modules= IntegerField(default=0)
    total_modules     = IntegerField(default=0)
    active_users      = IntegerField(default=0)
    user_limit        = IntegerField(default=0)
    is_active         = BooleanField(default=True)
    updated_at        = DateTimeField(auto_now=True)
```

### 12. StorageMetrics
```python
class StorageMetrics(models.Model):
    """Database storage usage over time."""
    id               = UUIDField(primary_key)
    storage_used_gb  = FloatField()
    storage_total_gb = FloatField()
    database_status  = CharField(50, default='Healthy')  # Healthy|Degraded|Critical
    last_backup      = DateTimeField(null=True)
    next_backup      = DateTimeField(null=True)
    recorded_at      = DateTimeField(auto_now_add=True)
```

---

## Seed Data (Migration 0013)

The migration `0013_seed_admin_data.py` runs 6 seed functions:

1. **`seed_admin_modules`** — Creates 7 modules: emr, patient_registration, billing, pharmacy, laboratory, teleicu, ai_services
2. **`seed_security_policies`** — Creates 5 policies with default JSON settings
3. **`seed_system_settings`** — Creates 15 key-value settings (hospital info, SMTP, billing, notifications)
4. **`seed_license_info`** — Creates 1 Enterprise license (valid Jan 2026 – Jan 2027)
5. **`seed_storage_metrics`** — Creates 1 initial storage record (128.5 GB / 500 GB)
6. **`seed_master_data`** — Creates 30 lookup entries across 4 categories (specialty, encounter_type, room_type, visit_type)
