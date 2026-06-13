"""Admin serializers package — one module per entity, mirrors views/admin/.

All serializers are re-exported so ``from medos.admin_serializers import ...``
and ``from medos.serializers.admin import ...`` both work.
"""
from .dashboard import (
    KPIEntrySerializer, AdminKPISerializer,
    SystemOverviewPointSerializer, AdminModuleSerializer,
    SystemAlertSerializer, UserActivitySerializer,
    AuditCategorySerializer, AuditSummarySerializer,
    SecurityOverviewSerializer, RecentActivitySerializer,
    DatabaseStorageSerializer, LicenseInfoSerializer,
    SystemInfoSerializer,
)
from .users import AdminUserSerializer, AdminUserCreateSerializer
from .roles import AdminRoleSerializer
from .departments import DepartmentSerializer
from .master_data import MasterDataEntrySerializer
from .settings import SystemSettingSerializer
from .workflows import WorkflowDefinitionSerializer
from .devices import DeviceIntegrationSerializer
from .security import SecurityPolicySerializer, AuditLogSerializer
from .backups import BackupRecordSerializer
from .ward_setup import AdminWardSerializer, AdminWardDetailSerializer, AdminBedSerializer
from .lab_panels import AdminTestPanelSerializer, AdminTestPanelDetailSerializer, AdminTestParameterSerializer

__all__ = [
    'KPIEntrySerializer', 'AdminKPISerializer',
    'SystemOverviewPointSerializer', 'AdminModuleSerializer',
    'SystemAlertSerializer', 'UserActivitySerializer',
    'AuditCategorySerializer', 'AuditSummarySerializer',
    'SecurityOverviewSerializer', 'RecentActivitySerializer',
    'DatabaseStorageSerializer', 'LicenseInfoSerializer',
    'SystemInfoSerializer',
    'AdminUserSerializer', 'AdminUserCreateSerializer',
    'AdminRoleSerializer',
    'DepartmentSerializer',
    'MasterDataEntrySerializer',
    'SystemSettingSerializer',
    'WorkflowDefinitionSerializer',
    'DeviceIntegrationSerializer',
    'SecurityPolicySerializer', 'AuditLogSerializer',
    'BackupRecordSerializer',
    'AdminWardSerializer', 'AdminWardDetailSerializer', 'AdminBedSerializer',
    'AdminTestPanelSerializer', 'AdminTestPanelDetailSerializer', 'AdminTestParameterSerializer',
]
