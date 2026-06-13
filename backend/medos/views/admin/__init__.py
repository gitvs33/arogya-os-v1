"""Admin views package — one module per entity.

Re-exports all views and the ``admin_router`` for URL inclusion.
"""
from rest_framework.routers import DefaultRouter

from .dashboard import (
    admin_kpis,
    admin_system_overview_chart,
    admin_module_status,
    admin_system_alerts,
    admin_user_activity,
    admin_audit_summary,
    admin_security_overview,
    admin_recent_activities,
    admin_database_storage,
    admin_license_info,
    admin_system_info,
    admin_stats,
)
from .users import AdminUserViewSet
from .roles import AdminRoleViewSet
from .departments import AdminDepartmentViewSet
from .master_data import AdminMasterDataViewSet
from .settings import AdminSystemSettingViewSet
from .workflows import AdminWorkflowViewSet
from .devices import AdminDeviceViewSet
from .security import AdminSecurityViewSet, AdminAuditLogViewSet
from .backups import AdminBackupViewSet
from .ward_setup import AdminWardSetupViewSet
from .lab_panels import AdminTestPanelViewSet

__all__ = [
    'admin_kpis',
    'admin_system_overview_chart',
    'admin_module_status',
    'admin_system_alerts',
    'admin_user_activity',
    'admin_audit_summary',
    'admin_security_overview',
    'admin_recent_activities',
    'admin_database_storage',
    'admin_license_info',
    'admin_system_info',
    'admin_stats',
    'AdminUserViewSet',
    'AdminRoleViewSet',
    'AdminDepartmentViewSet',
    'AdminMasterDataViewSet',
    'AdminSystemSettingViewSet',
    'AdminWorkflowViewSet',
    'AdminDeviceViewSet',
    'AdminSecurityViewSet',
    'AdminAuditLogViewSet',
    'AdminBackupViewSet',
    'AdminWardSetupViewSet',
    'AdminTestPanelViewSet',
    'admin_router',
]

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
admin_router.register(r'ward-setup', AdminWardSetupViewSet, basename='admin-ward-setup')
admin_router.register(r'lab-panels', AdminTestPanelViewSet, basename='admin-lab-panels')
