import axios from 'axios';
import { clearSession, expiredLoginPath, getAccess, getExp, getRefresh, isExpired, onLoginPage, setSession } from './session';

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
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
          const { data } = await axios.post('/api/auth/refresh/', { refresh });
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
export { hardLogout };
export const errMsg = (e: any) => e?.response?.data?.message || e?.response?.data?.detail || 'Request failed';
