import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client';
import {
  clearSession,
  expiredLoginPath,
  getAccess,
  getExp,
  getRefresh,
  isExpired,
  onLoginPage,
  PORTAL_LOGIN,
  portalFromPath,
  readUser,
  setSession,
  setUser as persistUser,
  type Portal,
} from '../api/session';

export type AuthUser = {
  id?: number;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: number | null;
  role_name?: string;
  school?: number | null;
  school_name?: string;
  is_superuser?: boolean;
  must_change_password?: boolean;
  parent_id?: number | null;
  permissions?: string[];
} | null;

type AuthCtxType = {
  user: AuthUser;
  portal: Portal;
  login(u: string, p: string, portal?: Portal): Promise<AuthUser>;
  logout(to?: string): void;
  refresh(): Promise<void>;
  can(code: string): boolean;
  isSuper(): boolean;
};

const AuthCtx = createContext<AuthCtxType | null>(null);

const expired = (e: any) => e?.response?.status === 401 && e?.response?.data?.code === 'account_disabled';

/* Each portal authenticates through its own endpoint. Admin and super share the
   academy login; trainer and parent have dedicated, role-verified endpoints. */
const LOGIN_ENDPOINT: Record<Portal, string> = {
  admin: '/auth/login/',
  super: '/auth/login/',
  trainer: '/auth/trainer/login/',
  parent: '/auth/parent/login/',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const portal = portalFromPath(location.pathname);
  const [user, setUser] = useState<AuthUser>(() => readUser(portal));

  const logout = useCallback(async (to?: string) => {
    const p = portalFromPath(window.location.pathname);
    // Best-effort server revocation (blacklists THIS refresh token), then
    // clear only this portal's storage. The teacher/admin jar is untouched.
    try {
      const refresh = getRefresh(p);
      if (refresh) await api.post('/auth/logout/', { refresh });
    } catch { /* already gone — still clean up locally */ }
    clearSession(p);
    setUser(null);
    window.location.href = to || PORTAL_LOGIN[p];
  }, []);

  const refresh = useCallback(async () => {
    const p = portalFromPath(window.location.pathname);
    if (!getAccess(p)) return;
    if (isExpired(getExp(p))) {
      // Refreshing the page must not resurrect an expired session.
      clearSession(p);
      setUser(null);
      if (!onLoginPage()) window.location.href = expiredLoginPath(p);
      return;
    }
    try {
      const { data } = await api.get('/auth/me/');
      persistUser(data, p);
      setUser(data);
    } catch (e: any) {
      if (expired(e)) logout();
    }
  }, [logout]);

  // Route/portal change → load that portal's own stored identity. Other
  // portals' sessions live in separate keys and are never touched here.
  useEffect(() => {
    const stored = readUser<AuthUser>(portal);
    setUser(stored);
    // A token without a cached identity (fresh tab / cleared user) → re-hydrate.
    if (!stored && getAccess(portal)) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal]);

  const login = async (username: string, password: string, targetPortal: Portal = portal): Promise<AuthUser> => {
    const { data } = await api.post(LOGIN_ENDPOINT[targetPortal], { username, password });
    setSession(data.access, data.refresh, data.session_exp ?? null, targetPortal);
    persistUser(data.user, targetPortal);
    setUser(data.user);
    return data.user;
  };

  // Permissions arrive pre-expanded from the backend (manage → granular),
  // so this is a plain membership check. Backend re-checks per request.
  const can = useCallback((code: string) => !user?.permissions || user.permissions.includes(code), [user]);
  const isSuper = useCallback(
    () => !!user && (user.is_superuser === true || user.role_name === 'super_admin'),
    [user],
  );
  return (
    <AuthCtx.Provider value={{ user, portal, login, logout, refresh, can, isSuper }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
};
