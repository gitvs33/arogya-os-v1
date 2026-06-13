import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// ── Supabase client ─────────────────────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Axios HTTP client ──────────────────────────────────────────────────────

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send HttpOnly auth cookies automatically
});


// Handle 401/403 globally — redirect to login
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('medos_user');
      sessionStorage.removeItem('medos_user');
      window.location.href = '/login';
    }
    
    if (error.response?.status === 403) {
      const user = getStoredUser();
      if (user && user.hospital && !user.hospital.is_active) {
        window.location.href = '/suspended';
        return Promise.reject(error);
      }
      sessionStorage.setItem('access_denied_message', 'You do not have permission to access that page.');
      window.location.href = '/';
    }
    
    return Promise.reject(error);
  }
);

export default client;

// ── Auth helpers ────────────────────────────────────────────────────────────

export async function fetchCurrentUser() {
  const response = await client.get('/auth/me/');
  return response.data;
}

export function getStoredUser() {
  const stored =
    localStorage.getItem('medos_user') ||
    sessionStorage.getItem('medos_user');
  return stored ? JSON.parse(stored) : null;
}

export function getStoredRoleSnapshotHash() {
  const user = getStoredUser();
  return user?.role_snapshot_hash || null;
}

export function clearAuth() {
  sessionStorage.removeItem('medos_user');
  localStorage.removeItem('medos_user');
}
