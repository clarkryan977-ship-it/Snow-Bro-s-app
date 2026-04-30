import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── Request interceptor: attach token from localStorage (remember me) or sessionStorage ──
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: on 401/403 clear stale tokens and redirect to login ──
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Only auto-logout if the request carried a token (i.e. session was active)
      const hadToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (hadToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        // Redirect to login unless already there or on a public page
        const pub = ['/login', '/register', '/reset-password', '/portal-setup', '/pay', '/book', '/apply'];
        const isPublic = pub.some(p => window.location.pathname.startsWith(p));
        if (!isPublic) window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
