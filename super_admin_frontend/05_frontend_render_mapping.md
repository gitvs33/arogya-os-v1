# Frontend Render Mapping — How Each Backend Endpoint Becomes UI

> This file maps every backend admin endpoint to its exact frontend rendering location, including the specific React component, HTML element, and data flow.

---

## 1. Dashboard Overview — Render Map

### 1.1 KPIs Card — `GET /api/admin/kpis/`

```
Backend returns:
{
  "total_users":    { count, growth },
  "active_users":   { count, percentage },
  "departments":    { count, growth },
  "roles":          { count },
  "system_uptime":  { percentage },
  "storage_used":   { used, total, percentage }
}

Frontend renders in: AdminDashboard.tsx → <KPICard> x6

KPICard(title="Total Users",        value=kpis.total_users.count,
        trendValue="+12 this month", icon=Users,         colorTheme="green")
KPICard(title="Active Users",       value=kpis.active_users.count,
        subtitle="90% of total",     icon=Shield,        colorTheme="orange")
KPICard(title="Departments",        value=kpis.departments.count,
        trendValue="+1 this month",  icon=Building2,     colorTheme="blue")
KPICard(title="Roles",              value=kpis.roles.count,
        icon=UserCog,               colorTheme="purple")
KPICard(title="System Uptime",      value="99.9%",
        subtitle="Last 30 days",    icon=Clock,          colorTheme="green")
KPICard(title="Storage Used",       value="1.2 TB",
        subtitle="of 2.0 TB (60%)", icon=HardDrive,      colorTheme="orange")
```

**KPICard component structure:**
```
<div.bg-white.border.rounded-xl>
  <div> → <div.w-10.h-10.rounded-full>{Icon}</div>
  <h3>{title}</h3>
  <p>{value}</p>
  <div>
    <TrendingUp /> {trendValue} | {subtitle}
  </div>
</div>
```

---

### 1.2 System Overview Line Chart — `GET /api/admin/system-overview-chart/`

```
Backend returns:
[
  { date: "2026-06-03", logins: 45, transactions: 120, errors: 3 },
  { date: "2026-06-04", logins: 52, transactions: 98,  errors: 1 },
  ...
]

Frontend renders in: AdminDashboard.tsx → Recharts <LineChart>

<ResponsiveContainer width="100%" height="100%">
  <LineChart data={overviewData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />         ← date from backend
    <YAxis tickFormatter={(val) => `${val/1000}K`} />
    <Tooltip />
    <Line dataKey="logins"       stroke="#10B981" />   ← green line
    <Line dataKey="transactions" stroke="#3B82F6" />   ← blue dashed
    <Line dataKey="errors"       stroke="#EF4444" />   ← red dashed
  </LineChart>
</ResponsiveContainer>
```

Period selector (`<select>`) controls `?period=last_7_days|last_30_days` query param.

---

### 1.3 Module Status — `GET /api/admin/module-status/`

```
Backend returns:
[
  { id, name: "EMR",              label: "EMR",              status: "Operational" },
  { id, name: "Patient Registration", label: "Patient Registration", status: "Operational" },
  ...
]

Frontend renders in: AdminDashboard.tsx → Module Status panel

Uses MODULE_ICONS mapping:
  "EMR" → FileText icon
  "Patient Registration" → Users icon
  "Billing" → DollarSign icon
  "Pharmacy" → Pill icon
  "Laboratory" → Beaker icon
  "TeleICU" → Activity icon
  "AI Services" → Brain icon

Each module rendered as:
<div> → ModIcon (14px) + module.name (label)
  → <span.status-badge> = mod.status (green=Operational, orange=Degraded)
```

---

### 1.4 System Alerts — `GET /api/admin/system-alerts/`

```
Backend returns:
[
  { id, severity: "critical", title, description, timestamp: "2026-06-10T..." },
  ...
]

Frontend renders in: AdminDashboard.tsx → System Alerts panel

Severity → icon mapping:
  critical → <AlertTriangle size={16} /> + red text
  warning  → <AlertCircle size={16} />   + orange text
  info     → <Info size={16} />          + blue text
  success  → <CheckCircle2 size={16} />  + green text

Each alert:
<div.flex.gap-3>
  <severity-icon>
  <div> → <h4>{alert.title}</h4> + <p>{alert.description}</p>
  <span>{alert.timestamp}</span>
</div>
```

---

### 1.5 User Activity — `GET /api/admin/user-activity/`

```
Backend returns:
[
  { user_id, name, avatar_url, role, logins_count, last_login_timestamp },
  ...
]

Frontend renders in: AdminDashboard.tsx → User Activity Overview table

Table columns:
  User  | Role  | Logins  | Last Login
  ------|-------|---------|------------
  Avatar+Name | role text | count | timestamp

If no avatar_url: renders initial letter in green circle
  <div.w-6.h-6.rounded-full.bg-emerald-100>
    {user.name.charAt(0)}
  </div>
```

---

### 1.6 Audit Log Summary — `GET /api/admin/audit-summary/`

```
Backend returns:
{
  total_logs: 12453,
  categories: [
    { name: "User Login", count: 4215, percentage: 33.7 },
    { name: "Patient Visit", count: 2890, percentage: 23.2 },
    ...
  ]
}

Frontend renders in: AdminDashboard.tsx → Recharts <PieChart>

<PieChart>
  <Pie data={auditSummary.categories} innerRadius={45} outerRadius={65}
       dataKey="count" stroke="none">
    {colors.map: ['#10B981','#3B82F6','#F59E0B','#8B5CF6','#9CA3AF']}
    <Cell fill={color} /> per category
  </Pie>
</PieChart>

Center overlay: "Total Logs" + number

Legend: dot(2px) + category name + count + (percentage%)
```

---

### 1.7 Security Overview — `GET /api/admin/security-overview/`

```
Backend returns:
{ password_policy: "Strong", two_factor_enforcement: "Enabled", session_timeout: "30 min" }

Frontend renders in: AdminDashboard.tsx → bottom of Audit card

3 cards:
  [Lock icon]  Password Policy  → Strong
  [Shield icon] 2FA Enforcement → Enabled
  [Clock icon]  Session Timeout → 30 min
```

---

### 1.8 Recent Activities — `GET /api/admin/recent-activities/`

```
Backend returns:
[
  { id, action_type: "user", description: "New user Dr. X created",
    timestamp: "Jun 10, 2026 03:45 PM", author_name: "Admin" },
  ...
]

Frontend renders in: AdminDashboard.tsx → Recent System Activities

action_type → icon mapping:
  user       → <UserCog />   icon
  role       → <Shield />    icon
  department → <Building2 /> icon
  system     → <Settings />  icon
  database   → <Database />  icon
  default    → <Info />      icon

Each activity:
<div.flex.items-center.gap-3>
  <ActionIcon size={14} className="text-emerald-600" />
  <span>{act.description}</span>
  <span>{time portion of timestamp}</span>
</div>
```

---

### 1.9 Database Storage — `GET /api/admin/database-storage/`

```
Backend returns:
{ storage_used_tb: 0.13, storage_total_tb: 0.49,
  database_status: "Healthy", last_backup, next_backup }

Frontend renders in: AdminDashboard.tsx → Database & Storage card

Left card: Storage Usage
  "0.13 TB / 0.49 TB" + "26.5% Used"
  <div.h-1.5.bg-gray-200> → <div.bg-emerald-500 width={26.5}%>

Right card: Database Status
  <Database size={20} /> + "Database Status" + "Healthy" + "All systems normal"

Bottom: Last Backup: - | Next Backup: -
```

---

### 1.10 License Info — `GET /api/admin/license-info/`

```
Backend returns:
{ edition: "Enterprise", valid_till: "2027-01-01",
  registered_modules: 8, total_modules: 10,
  active_users: 45, user_limit: 500 }

Frontend renders in: AdminDashboard.tsx → License & Subscription card

Detail list: Edition | Valid Till | Registered Modules | Active Users

Bottom button: "Manage Subscription" (bg-[#0A6253])
```

---

### 1.11 System Info — `GET /api/admin/system-info/`

```
Backend returns:
{ version: "v3.2.1", environment: "Production",
  server_name: "medos-prod-01", server_time: "2026-06-10T...",
  timezone: "Asia/Kolkata", python_version: "3.14",
  django_version: "6.0.6", database: "django.db.backends.postgresql" }

Frontend renders in: AdminDashboard.tsx → System Information card

Gray box with key-value rows: Version | Environment | Server Name | Server Time | Timezone
```

---

## 2. CRUD Tabs — Render Map

### 2.1 UserManagement.tsx

**Data Flow:**
```
useQuery(['users']) → adminApi.getUsers()
  → GET /api/admin/users/
  → List of User objects
  → UseState for search/filter → Filtered list → HTML table

createMutation → adminApi.createUser(data)
  → POST /api/admin/users/
  → Modal form (name, email, role, department)
  → On success: invalidate ['users'] query

editMutation → adminApi.updateUser(id, data)
  → PATCH /api/admin/users/{id}/
  → Edit modal (role, department only)

deactivateMutation → adminApi.deactivateUser(id)
  → DELETE /api/admin/users/{id}/
  → Confirmation dialog
```

**Frontend State Management:**
| State | Type | Used For |
|---|---|---|
| `searchTerm` | string | Filter users by name/role/department |
| `isCreateModalOpen` | boolean | Create user modal visibility |
| `isEditModalOpen` | boolean | Edit user modal visibility |
| `userToEdit` | object | Reference to user being edited |
| `createForm` | object | Form fields for new user |
| `editForm` | object | Form fields for editing |

---

### 2.2 RoleManagement.tsx

**Data Flow:**
```
useQuery(['adminRoles']) → adminApi.getRoles()
  → GET /api/admin/roles/
  → Role list (left column) + Permissions matrix (right column)

createMutation → adminApi.createRole({name, description, permissions, is_active})
  → POST /api/admin/roles/

updateMutation → adminApi.updateRole(id, {permissions})
  → PATCH /api/admin/roles/{id}/
```

**Permission Matrix Rendering:**
```
Modules: Patient Records | Appointments | Billing & Finance | Staff Management | System Settings

Checkboxes per module: Create | Read | Update | Delete

Edge case: "System Administrator" role → all checkboxes checked + disabled
```

---

### 2.3-2.10 Other Tabs

All follow the same pattern:
| Tab | Backend Endpoint | Frontend Query Key | Mutation |
|---|---|---|---|
| DepartmentSetup | `/api/admin/departments/` | `['adminDepartments']` | createDepartment, updateDepartment |
| MasterData | `/api/admin/master-data/` | `['adminMasterData']` | createEntry, updateEntry |
| SystemSettings | `/api/admin/settings/` | `['adminSettings']` | createSetting, updateSetting |
| WorkflowSetup | `/api/admin/workflows/` | `['adminWorkflows']` | createWorkflow, updateWorkflow |
| DeviceIntegration | `/api/admin/devices/` | `['adminDevices']` | createDevice, updateDevice |
| SecurityAccess | `/api/admin/security/` | `['adminSecurity']` | createPolicy, updatePolicy |
| AuditLogs | `/api/admin/audit-logs/` | `['adminAuditLogs']` | (read-only, no mutations) |
| BackupRestore | `/api/admin/backups/` | `['adminBackups']` | createBackup, triggerBackup, restoreBackup |

---

## 3. Error Handling Patterns

### 3.1 Loading State
```tsx
{isLoading && (
  <div.bg-white.rounded-xl.p-12>
    <Loader2 className="animate-spin text-[#0A6253]" />
    <p>Loading...</p>
  </div>
)}
```

### 3.2 Error State
```tsx
{isError && (
  <div.bg-red-50.border.border-red-100.rounded-xl.p-8>
    <AlertCircle className="text-red-500" />
    <h3>Failed to load</h3>
    <p>{error.message}</p>
    <button onClick={() => queryClient.invalidateQueries(['key'])}>
      Try Again
    </button>
  </div>
)}
```

### 3.3 Empty State
```tsx
{filteredUsers.length === 0 && (
  <div.py-12.text-center>
    <Search className="text-gray-300" />
    <p>No users found</p>
  </div>
)}
```

### 3.4 Mutation Error (inside modal)
```tsx
{createMutation.isError && (
  <div.bg-red-50.text-red-600.rounded-lg>
    <AlertCircle /> {errorMessage}
  </div>
)}
```

---

## 4. Data Fallback Strategy

The frontend has a multi-tier fallback for when the backend is unavailable:

```
Level 1: React Query cache (staleTime: 30s)
Level 2: API call → backend
Level 3: MOCK_STATS (hardcoded in AdminDashboard.tsx)
Level 4: Empty arrays / zero values as default state
```

Example from AdminDashboard.tsx:
```typescript
const MOCK_STATS = {
  total_users: { count: 1245, growth: '+12' },
  active_users: { count: 1120, percentage: 90 },
  ...
};

const kpis = (!statsRes || isStatsError) ? MOCK_STATS : statsRes;
```

---

## 5. Visual Theme

| Element | Value |
|---|---|
| Primary color | `#0A6253` (emerald green) |
| Background | `#F8F9FA` |
| Card border | `border-gray-200` |
| Card shadow | `shadow-sm` (hover: `shadow-md`) |
| Success | `text-emerald-600` |
| Warning | `text-orange-600` |
| Danger | `text-red-600` |
| Info | `text-blue-600` |
| Font sizes | `text-[10px]` (labels), `text-xs` (body), `text-sm` (headers), `text-2xl` (KPIs) |
| Avatar fallback | `bg-emerald-100` with first initial |
