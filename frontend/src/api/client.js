import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add CSRF token if available
client.interceptors.request.use((config) => {
  const csrf = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrftoken='))
    ?.split('=')[1];
  if (csrf) {
    config.headers['X-CSRFToken'] = csrf;
  }
  // Include credentials for session auth
  config.withCredentials = true;
  return config;
});

// Handle 401/403 globally
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
