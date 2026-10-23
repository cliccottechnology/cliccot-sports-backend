import axios from 'axios';
import { clearSession, expiredLoginPath, getAccess, getExp, getRefresh, isExpired, onLoginPage, setSession } from './session';

const getBaseUrl = () => {
  // In development the Vite server proxies /api and /media to Django (see
  // vite.config.ts). Keeping the URL same-origin means the admin portal works
  // from localhost, a LAN IP, a phone, a forwarded port or a tunnel — instead
  // of hardcoding the machine's host and failing every call when it changes.
  const env = (import.meta as any)?.env || {};
  if (env.DEV) return '/api';

  // Production: an explicit public API URL wins; otherwise use the page's own
  // origin (served behind the same reverse proxy as the API). A loopback URL
  // baked in at build time is useless to remote browsers, so ignore it.
  const configured = String(env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  const loopback = /^https?:\/\/(127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(configured);
  if (configured && !loopback) {
    return configured.endsWith('/api') ? configured : `${configured}/api`;
  }
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/api`;
  }
  return 'http://127.0.0.1:8000/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

api.interceptors.request.use((cfg) => {
  const token = getAccess();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

async function hardLogout() {
  // Never loop: if we're already on a login screen, just clean state.
  clearSession();
  if (!onLoginPage()) window.location.href = expiredLoginPath();
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original: any = err.config;
    if (err.response?.status === 401 && !original._retried) {
      original._retried = true;
      // Past the absolute deadline the backend rejects refresh too — go
      // straight to the role login instead of retrying forever.
      if (isExpired(getExp())) {
        await hardLogout();
        return Promise.reject(err);
      }
      const refresh = getRefresh();
      if (refresh) {
        try {
          const { data } = await axios.post(`${getBaseUrl()}/auth/refresh/`, { refresh });
          // Refreshed tokens keep the SAME portal + absolute deadline.
          setSession(data.access, data.refresh || refresh, data.session_exp ?? getExp());
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          await hardLogout();
        }
      } else {
        await hardLogout();
      }
    }
    return Promise.reject(err);
  },
);

export default api;
export { hardLogout, getBaseUrl };
export const errMsg = (e: any): string => {
  const data = e?.response?.data;
  if (typeof data === 'string' && data.length < 200 && data.trim()) return data.trim();
  if (data?.message) return String(data.message);
  if (data?.detail) return String(data.detail);
  if (data && typeof data === 'object') {
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = data[firstKey];
      if (Array.isArray(val) && val.length) return `${firstKey}: ${val[0]}`;
      if (typeof val === 'string') return `${firstKey}: ${val}`;
    }
  }
  return e?.message || 'Request failed';
};
