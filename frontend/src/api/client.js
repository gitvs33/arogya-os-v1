import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach auth token from sessionStorage to every request
client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('medos_token');
  if (token) {
    config.headers['Authorization'] = `Token ${token}`;
  }
  return config;
});

// Handle 401/403 globally — redirect to login if token expired
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('medos_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
