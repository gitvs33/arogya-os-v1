import { getStoredUser } from '../api/client';

export function canAccess(module: string, action: string = 'read'): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'System Administrator') return true;
  if (module === 'ward') return true; // Temporary bypass until DB is seeded
  const permissions = user.role_permissions;
  if (!permissions) return false;
  return permissions[module]?.includes(action) ?? false;
}

export function hasAnyAccess(module: string): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'System Administrator') return true;
  if (module === 'ward') return true; // Temporary bypass until DB is seeded
  const permissions = user.role_permissions;
  if (!permissions) return false;
  const modulePerms = permissions[module];
  return Array.isArray(modulePerms) && modulePerms.length > 0;
}

export function canAccessFeature(feature: string): boolean {
  const user = getStoredUser();
  if (!user || !user.hospital) return true; // Default to true if not on SaaS yet

  const plan = user.hospital.plan || 'basic';

  const planTiers: Record<string, string[]> = {
    basic: ['dashboard', 'encounters', 'patients', 'appointments', 'pharmacy', 'billing', 'admin', 'ward'],
    professional: ['dashboard', 'encounters', 'patients', 'appointments', 'pharmacy', 'billing', 'admin', 'teleicu', 'lab', 'reports', 'advanced-admin', 'ward'],
    enterprise: ['dashboard', 'encounters', 'patients', 'appointments', 'pharmacy', 'billing', 'admin', 'teleicu', 'lab', 'reports', 'ai-scribe', 'advanced-admin', 'enterprise-admin', 'ward'],
  };

  const allowedFeatures = planTiers[plan] || planTiers.basic;
  return allowedFeatures.includes(feature);
}
