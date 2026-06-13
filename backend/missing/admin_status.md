# Admin Panel Backend Requirements

The following endpoints are required in the backend to fully support the Admin Panel tabs. Currently, most of these return mocked data on the frontend or are missing in `admin_views.py`.

## 1. User Management
- `GET /admin/users/`: List all users with pagination, search, and role filtering.
- `POST /admin/users/`: Create a new user.
- `PATCH /admin/users/{id}/`: Update user details or status (active/inactive).
- `POST /admin/users/{id}/reset_password/`: Trigger a password reset.

## 2. Role & Permissions Management
- `GET /admin/roles/`: List all roles and their associated permissions.
- `POST /admin/roles/`: Create a new role.
- `PATCH /admin/roles/{id}/`: Update role permissions.
- `GET /admin/permissions/`: List all available system permissions for assignment.

## 3. Department Setup
- `GET /admin/departments/`: List all departments (clinical, operational, administrative).
- `POST /admin/departments/`: Create a new department.
- `PATCH /admin/departments/{id}/`: Update department head, status, and capacities.

## 4. System Settings (Expanded Module)
*Note: System Settings is now an expanded dropdown module containing the following configuration endpoints:*

- **General Settings / Hospital Profile**: `GET /settings/hospital-profile/`, `PATCH /settings/hospital-profile/`
- **Module Settings**:
  - `GET /settings/billing/`, `PATCH /settings/billing/`
  - `GET /settings/pharmacy/`, `PATCH /settings/pharmacy/`
  - `GET /settings/laboratory/`, `PATCH /settings/laboratory/`
  - `GET /settings/teleicu/`, `PATCH /settings/teleicu/`
- **Notifications**: `GET /settings/notifications/` (gateway config), `PATCH /settings/notifications/`
- **Integrations & Webhooks**: `GET /settings/integrations/`, `PATCH /settings/integrations/`, `GET /settings/webhooks/`, `POST /settings/webhooks/`
- **Data Management**: `GET /settings/data-policies/`, `PATCH /settings/data-policies/`
- **Localization**: `GET /settings/localization/` (timezone, language, currency), `PATCH /settings/localization/`
- **Templates**: `GET /settings/templates/` (print templates for invoices/prescriptions), `POST /settings/templates/`, `PATCH /settings/templates/{id}/`

## 5. Security & Access
- `GET /admin/security-policies/`: Retrieve password policies, MFA requirements, session timeouts.
- `PATCH /admin/security-policies/`: Update security policies.
- `GET /admin/active-sessions/`: List all currently active user sessions.
- `POST /admin/active-sessions/{id}/terminate/`: Terminate a specific user session.

## 6. Audit Logs
- `GET /admin/audit-logs/`: List system-wide audit logs with filters (user, action, date, module).

## 7. Backup & Restore
- `GET /admin/backups/`: List all automated and manual system backups.
- `POST /admin/backups/create/`: Trigger a manual backup.
- `POST /admin/backups/{id}/restore/`: Initiate a system restore from a backup.
- `GET /admin/backups/schedule/`: Retrieve the automated backup schedule.
- `PATCH /admin/backups/schedule/`: Update the backup schedule.

## 8. Master Data
- `GET /admin/master-data/categories/`: List all lookup categories (e.g., Encounter Types, Document Types).
- `GET /admin/master-data/{category}/`: List items within a specific category.
- `POST /admin/master-data/{category}/`: Add a new lookup item.
- `PATCH /admin/master-data/{category}/{id}/`: Update a lookup item.

## 9. Workflow Setup
- `GET /admin/workflows/`: List automated workflows (e.g., Lab Approval, Discharge).
- `POST /admin/workflows/`: Create a new workflow rule.
- `PATCH /admin/workflows/{id}/`: Update workflow steps and approvals.

## 10. Device Integration
- `GET /admin/devices/`: List integrated bedside monitors, lab machines, etc.
- `POST /admin/devices/`: Register a new device.
- `PATCH /admin/devices/{id}/`: Update device status/configuration.
- `POST /admin/devices/{id}/sync/`: Trigger a manual data sync with the device.
