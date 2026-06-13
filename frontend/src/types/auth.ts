export interface Hospital {
  id: string;
  name: string;
  slug: string;
  plan: 'basic' | 'professional' | 'enterprise';
  is_active: boolean;
}

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  role_permissions: Record<string, string[]>;
  role_snapshot_hash: string;
  hospital: Hospital;
  is_staff: boolean;
  token?: string;
}
