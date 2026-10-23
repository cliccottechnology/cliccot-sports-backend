/* Session state: one login = one absolute 60-minute session, server-issued.
   The backend is authoritative (session_exp claim enforced per request);
   these helpers only drive UX: countdown, warning, and role-aware redirects.

   Token isolation: each portal (admin / super / trainer / parent) keeps its
   OWN storage keys, so a parent signing in on a shared browser never
   overwrites — or logs out — the teacher/admin session, and vice versa. The
   active portal is derived from the current route (plus the super-admin
   origin), so every helper defaults to the right jar automatically. Roles are
   never trusted from storage: the backend re-verifies per request. */

export type Portal = 'admin' | 'super' | 'trainer' | 'parent';

export const PORTAL_LOGIN: Record<Portal, string> = {
  admin: '/login',
  super: '/super-admin/login',
  trainer: '/trainer/login',
  parent: '/parent/login',
};

export const WARN_MS = 5 * 60 * 1000;

/** Dev convention: the Super Admin runs on a second origin for extra isolation. */
export const SUPER_ORIGIN_PORT = '5174';

function vitePortalEnv(): string | undefined {
  try {
    return (import.meta as any)?.env?.VITE_PORTAL as string | undefined;
  } catch {
    return undefined;
  }
}

export function isSuperOrigin(port?: string, env?: string): boolean {
  if (env === 'super') return true;
  if (env && env !== '') return false;
  return (port ?? '') === SUPER_ORIGIN_PORT;
}

/** Non-role-specific routes on this origin resolve to admin — or super on the
 *  dedicated super-admin origin (same build served on a second port). */
const ORIGIN_PORTAL: Portal =
  typeof window !== 'undefined' && isSuperOrigin(window.location.port, vitePortalEnv())
    ? 'super'
    : 'admin';

/** Portal for a given path. Trainer/parent/super prefixes win; everything else
 *  falls back to the origin's default portal. Matches the exact portal route or
 *  a sub-path only — never admin routes that merely share a prefix
 *  (e.g. `/parents`, `/trainers` must stay in the admin portal). */
export function portalFromPath(path: string): Portal {
  if (path === '/parent' || path.startsWith('/parent/')) return 'parent';
  if (path === '/trainer' || path.startsWith('/trainer/')) return 'trainer';
  if (path === '/super-admin' || path.startsWith('/super-admin/')) return 'super';
  return ORIGIN_PORTAL;
}

export function activePortal(): Portal {
  if (typeof window === 'undefined') return 'admin';
  return portalFromPath(window.location.pathname);
}

type Keys = { access: string; refresh: string; exp: string; user: string };

function keysFor(portal: Portal): Keys {
  return {
    access: `jetz_${portal}_access`,
    refresh: `jetz_${portal}_refresh`,
    exp: `jetz_${portal}_exp`,
    user: `jetz_${portal}_user`,
  };
}

// Pre-isolation keys (single shared jar). Migrated once, per portal, so a
// deploy does not silently log everyone out.
const LEGACY = {
  access: 'jetz_access',
  refresh: 'jetz_refresh',
  exp: 'jetz_session_exp',
  portal: 'jetz_portal',
  user: 'jetz_user',
};

function migrateLegacy(portal: Portal) {
  try {
    const k = keysFor(portal);
    if (localStorage.getItem(k.access)) return;
    const legacyPortal = portalFromPath(localStorage.getItem(LEGACY.portal) || '/login');
    if (legacyPortal !== portal) return;
    const access = localStorage.getItem(LEGACY.access);
    if (!access) return;
    localStorage.setItem(k.access, access);
    const refresh = localStorage.getItem(LEGACY.refresh);
    if (refresh) localStorage.setItem(k.refresh, refresh);
    const exp = localStorage.getItem(LEGACY.exp);
    if (exp) localStorage.setItem(k.exp, exp);
    const user = localStorage.getItem(LEGACY.user);
    if (user) localStorage.setItem(k.user, user);
  } catch {
    /* storage unavailable (private mode / SSR) — ignore */
  }
}

export function getAccess(portal: Portal = activePortal()): string | null {
  migrateLegacy(portal);
  const token = localStorage.getItem(keysFor(portal).access);
  if (token) return token;
  if (portal === 'admin') return localStorage.getItem(keysFor('super').access);
  if (portal === 'super') return localStorage.getItem(keysFor('admin').access);
  return null;
}

export function getRefresh(portal: Portal = activePortal()): string | null {
  migrateLegacy(portal);
  const token = localStorage.getItem(keysFor(portal).refresh);
  if (token) return token;
  if (portal === 'admin') return localStorage.getItem(keysFor('super').refresh);
  if (portal === 'super') return localStorage.getItem(keysFor('admin').refresh);
  return null;
}

export function readUser<T = any>(portal: Portal = activePortal()): T | null {
  migrateLegacy(portal);
  try {
    const raw = localStorage.getItem(keysFor(portal).user);
    if (raw) return JSON.parse(raw);
    if (portal === 'admin') {
      const superUser = localStorage.getItem(keysFor('super').user);
      if (superUser) return JSON.parse(superUser);
    }
    if (portal === 'super') {
      const adminUser = localStorage.getItem(keysFor('admin').user);
      if (adminUser) return JSON.parse(adminUser);
    }
    return null;
  } catch {
    return null;
  }
}

export function setUser(user: unknown, portal: Portal = activePortal()) {
  const json = JSON.stringify(user);
  localStorage.setItem(keysFor(portal).user, json);
  if (portal === 'super') localStorage.setItem(keysFor('admin').user, json);
  if (portal === 'admin') localStorage.setItem(keysFor('super').user, json);
}

export function setSession(
  access: string,
  refresh: string,
  sessionExp: number | null,
  portal: Portal = activePortal(),
) {
  const setFor = (p: Portal) => {
    const k = keysFor(p);
    localStorage.setItem(k.access, access);
    localStorage.setItem(k.refresh, refresh);
    if (sessionExp) localStorage.setItem(k.exp, String(sessionExp));
    else localStorage.removeItem(k.exp);
  };
  setFor(portal);
  if (portal === 'super') setFor('admin');
  if (portal === 'admin') setFor('super');
}

/** Clear ONE portal's session. Other portals (e.g. the teacher's) are untouched. */
export function clearSession(portal: Portal = activePortal()) {
  const clearFor = (p: Portal) => {
    const k = keysFor(p);
    localStorage.removeItem(k.access);
    localStorage.removeItem(k.refresh);
    localStorage.removeItem(k.exp);
    localStorage.removeItem(k.user);
  };
  clearFor(portal);
  if (portal === 'super') clearFor('admin');
  if (portal === 'admin') clearFor('super');
}

export function getExp(portal: Portal = activePortal()): number | null {
  migrateLegacy(portal);
  let v = Number(localStorage.getItem(keysFor(portal).exp) || 0);
  if (!v && portal === 'admin') v = Number(localStorage.getItem(keysFor('super').exp) || 0);
  if (!v && portal === 'super') v = Number(localStorage.getItem(keysFor('admin').exp) || 0);
  return v > 0 ? v : null;
}

/** Milliseconds until the server-issued deadline (server timestamps are UTC seconds). */
export function msUntilExpiry(expUnixSec: number | null, nowMs = Date.now()): number | null {
  if (!expUnixSec) return null;
  return expUnixSec * 1000 - nowMs;
}

export function isExpired(expUnixSec: number | null, nowMs = Date.now()): boolean {
  const ms = msUntilExpiry(expUnixSec, nowMs);
  return ms !== null && ms <= 0;
}

/** Where an expired session goes: its OWN role login, with a reason flag. */
export function expiredLoginPath(portal: Portal = activePortal()): string {
  return `${PORTAL_LOGIN[portal]}?expired=1`;
}

export function onLoginPage(): boolean {
  const p = typeof window !== 'undefined' ? window.location.pathname : '/';
  return (
    p === '/login' ||
    p.startsWith('/super-admin/login') ||
    p.startsWith('/admin/login') ||
    p.startsWith('/trainer/login') ||
    p.startsWith('/parent/login')
  );
}

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function defaultLoginPath(): string {
  if (typeof window === 'undefined') return '/login';
  return ORIGIN_PORTAL === 'super' ? '/super-admin/login' : '/login';
}
