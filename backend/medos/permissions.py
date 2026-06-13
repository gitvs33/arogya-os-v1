from rest_framework.permissions import BasePermission, SAFE_METHODS


class HasRolePermission(BasePermission):
    """Custom DRF permission class that checks the user's role permissions.

    Subclasses should set `required_module` and `required_action`.
    """
    required_module = None
    required_action = 'read'

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        # Django superusers bypass all role checks
        if user.is_superuser:
            return True
        profile = getattr(user, 'hospital_profile', None)
        if not profile or not profile.role:
            return False
        perms = profile.role.permissions or {}
        module_perms = perms.get(self.required_module, [])
        return self.required_action in module_perms


class HasModuleAccess(HasRolePermission):
    """Convenience: read for GET/HEAD/OPTIONS, write for mutating methods.

    Usage::

        class PatientViewSet(HospitalScopedViewSet):
            permission_classes = [IsAuthenticated, HasPatientsAccess]

    Subclasses must set ``required_module``. The action is inferred:
    read for safe methods, write for everything else.
    """
    required_module = None

    def has_permission(self, request, view):
        # Bypass check for superusers
        if request.user.is_authenticated and request.user.is_superuser:
            return True
        # Check read first
        self.required_action = 'read'
        if not super().has_permission(request, view):
            return False
        # For safe methods, read is enough
        if request.method in SAFE_METHODS:
            return True
        # For mutating methods, also check write
        self.required_action = 'write'
        return super().has_permission(request, view)


# ── Convenience: Combined Read/Write Access Classes ─────────────────────────
# These inherit from HasModuleAccess which handles read/write inference.
# Safe methods → read, mutating methods → read + write.

class HasPatientsAccess(HasModuleAccess):
    required_module = 'patients'


class HasEncountersAccess(HasModuleAccess):
    required_module = 'encounters'


class HasAppointmentsAccess(HasModuleAccess):
    required_module = 'appointments'


class HasBillingAccess(HasModuleAccess):
    required_module = 'billing'


class HasPharmacyAccess(HasModuleAccess):
    required_module = 'pharmacy'


class HasLabAccess(HasModuleAccess):
    required_module = 'lab'


class HasWardAccess(HasModuleAccess):
    required_module = 'ward'


class HasNurseAccess(HasModuleAccess):
    required_module = 'nursing'


class HasTeleICUAccess(HasModuleAccess):
    required_module = 'teleicu'


class HasAlertsAccess(HasModuleAccess):
    required_module = 'alerts'


class HasReportsAccess(HasModuleAccess):
    required_module = 'reports'


class HasDashboardAccess(HasModuleAccess):
    required_module = 'dashboard'


class HasSyncAccess(HasModuleAccess):
    required_module = 'sync'


# ── Clinical Module Permission Subclasses ──────────────────────────────────
# Each module gets Read and Write variants.
# Write access implies Read access (SAFE_METHODS bypass on write classes).

class HasPatientsRead(HasRolePermission):
    required_module = 'patients'
    required_action = 'read'


class HasPatientsWrite(HasRolePermission):
    required_module = 'patients'
    required_action = 'write'


class HasEncountersRead(HasRolePermission):
    required_module = 'encounters'
    required_action = 'read'


class HasEncountersWrite(HasRolePermission):
    required_module = 'encounters'
    required_action = 'write'


class HasEncountersComplete(HasRolePermission):
    required_module = 'encounters'
    required_action = 'complete'


class HasAppointmentsRead(HasRolePermission):
    required_module = 'appointments'
    required_action = 'read'


class HasAppointmentsWrite(HasRolePermission):
    required_module = 'appointments'
    required_action = 'write'


class HasBillingRead(HasRolePermission):
    required_module = 'billing'
    required_action = 'read'


class HasBillingWrite(HasRolePermission):
    required_module = 'billing'
    required_action = 'write'


class HasPharmacyRead(HasRolePermission):
    required_module = 'pharmacy'
    required_action = 'read'


class HasPharmacyWrite(HasRolePermission):
    required_module = 'pharmacy'
    required_action = 'write'


class HasLabRead(HasRolePermission):
    required_module = 'lab'
    required_action = 'read'


class HasLabWrite(HasRolePermission):
    required_module = 'lab'
    required_action = 'write'


class HasLabApprove(HasRolePermission):
    required_module = 'lab'
    required_action = 'approve'


class HasReportsRead(HasRolePermission):
    required_module = 'reports'
    required_action = 'read'


class HasReportsExport(HasRolePermission):
    required_module = 'reports'
    required_action = 'export'


class HasDashboardRead(HasRolePermission):
    required_module = 'dashboard'
    required_action = 'read'


class HasSyncRead(HasRolePermission):
    required_module = 'sync'
    required_action = 'read'


class HasSyncWrite(HasRolePermission):
    required_module = 'sync'
    required_action = 'write'


class HasTeleICURead(HasRolePermission):
    required_module = 'teleicu'
    required_action = 'read'


class HasTeleICUWrite(HasRolePermission):
    required_module = 'teleicu'
    required_action = 'write'


class HasTeleICUMonitor(HasRolePermission):
    required_module = 'teleicu'
    required_action = 'monitor'


class HasAlertsRead(HasRolePermission):
    required_module = 'alerts'
    required_action = 'read'


class HasAlertsWrite(HasRolePermission):
    required_module = 'alerts'
    required_action = 'write'


class HasAlertsAcknowledge(HasRolePermission):
    required_module = 'alerts'
    required_action = 'acknowledge'


class HasAlertsResolve(HasRolePermission):
    required_module = 'alerts'
    required_action = 'resolve'


# ── Admin Permission Subclasses ─────────────────────────────────────────

class HasAdminRead(HasRolePermission):
    required_module = 'admin'
    required_action = 'read'


class HasAdminWrite(HasRolePermission):
    required_module = 'admin'
    required_action = 'write'


class HasAdminManageUsers(HasRolePermission):
    required_module = 'admin'
    required_action = 'manage_users'


class HasAdminManageRoles(HasRolePermission):
    required_module = 'admin'
    required_action = 'manage_roles'


# ── Ward / IPD Permission Subclasses ────────────────────────────────────────

class HasWardAccess(HasRolePermission):
    required_module = 'ward'
    required_action = 'read'


class HasWardWrite(HasRolePermission):
    required_module = 'ward'
    required_action = 'write'


class HasNurseAccess(HasRolePermission):
    required_module = 'nursing'
    required_action = 'read'


class HasNurseWrite(HasRolePermission):
    required_module = 'nursing'
    required_action = 'write'
