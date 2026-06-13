"""Canonical permission module registry.

Single source of truth for every module, its display name, and the
valid actions per module. Used by:

- Permission metadata endpoint (frontend renders the matrix dynamically)
- seed_roles command (seed data stays in sync)
- Permission enforcement checks (validates actions against this list)

Add a new entry here when you add a new module that needs role-based access.
Then add the corresponding HasRolePermission subclass in permissions.py.
"""
from dataclasses import dataclass, field
from typing import List


@dataclass
class PermissionModule:
    """Descriptor for one permission module in the matrix."""
    id: str
    name: str
    actions: List[str]


# ── Canonical Module Registry ───────────────────────────────────────────────
# The order here influences display order in the frontend matrix.
# Module IDs become the keys in Role.permissions JSON.
# Actions are the valid values for that key.

PERMISSION_MODULES = [
    PermissionModule('patients',     'Patient Records',      ['read', 'write', 'delete']),
    PermissionModule('encounters',   'Encounters / EMR',     ['read', 'write', 'delete', 'complete']),
    PermissionModule('appointments', 'Appointments',         ['read', 'write', 'delete']),
    PermissionModule('billing',      'Billing & Finance',    ['read', 'write', 'delete']),
    PermissionModule('pharmacy',     'Pharmacy',             ['read', 'write', 'delete']),
    PermissionModule('lab',          'Laboratory',           ['read', 'write', 'delete', 'approve']),
    PermissionModule('ward',         'Ward / IPD',           ['read', 'write']),
    PermissionModule('nursing',      'Nursing',              ['read', 'write']),
    PermissionModule('teleicu',      'TeleICU',              ['read', 'write', 'monitor']),
    PermissionModule('alerts',       'Medical Alerts',       ['read', 'write', 'acknowledge', 'resolve']),
    PermissionModule('reports',      'Reports & Analytics',  ['read', 'export']),
    PermissionModule('dashboard',    'Dashboard',            ['read']),
    PermissionModule('sync',         'Data Sync',            ['read', 'write']),
    PermissionModule('admin',        'System Administration', ['read', 'write', 'manage_users', 'manage_roles']),
]


def get_module_ids() -> List[str]:
    """Return all registered module IDs."""
    return [m.id for m in PERMISSION_MODULES]


def get_module(id: str) -> PermissionModule | None:
    """Return the PermissionModule for a given ID, or None."""
    for m in PERMISSION_MODULES:
        if m.id == id:
            return m
    return None


def actions_for_module(id: str) -> List[str]:
    """Return valid actions for a module. Empty list if unknown."""
    mod = get_module(id)
    return mod.actions if mod else []


def all_actions() -> List[str]:
    """Return the union of all actions across every module."""
    seen = set()
    result = []
    for m in PERMISSION_MODULES:
        for a in m.actions:
            if a not in seen:
                seen.add(a)
                result.append(a)
    return result
