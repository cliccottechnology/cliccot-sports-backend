import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearSession,
  expiredLoginPath,
  fmtCountdown,
  getAccess,
  getExp,
  getRefresh,
  isExpired,
  isSuperOrigin,
  msUntilExpiry,
  portalFromPath,
  setSession,
} from './session';
import { canUsePortal, homeFor } from './rbac';

describe('session expiry helpers', () => {
  const NOW = 1_700_000_000_000;
  const exp = (msFromNow: number) => Math.floor((NOW + msFromNow) / 1000);
  it('computes remaining time', () => {
    expect(msUntilExpiry(exp(60_000), NOW)).toBe(60_000);
    expect(msUntilExpiry(null, NOW)).toBe(null);
  });
  it('detects expired sessions', () => {
    expect(isExpired(exp(-1_000), NOW)).toBe(true);
    expect(isExpired(exp(60_000), NOW)).toBe(false);
    expect(isExpired(null, NOW)).toBe(false);
  });
  it('formats countdowns', () => {
    expect(fmtCountdown(300_000)).toBe('5:00');
    expect(fmtCountdown(65_000)).toBe('1:05');
    expect(fmtCountdown(-5_000)).toBe('0:00');
  });
});

describe('super origin detection', () => {
  it('treats the super port as the super portal', () => {
    expect(isSuperOrigin('5174')).toBe(true);
    expect(isSuperOrigin('5173')).toBe(false);
    expect(isSuperOrigin('')).toBe(false);
  });
  it('lets an explicit env override the port', () => {
    expect(isSuperOrigin('5173', 'super')).toBe(true);
    expect(isSuperOrigin('5174', 'admin')).toBe(false);
  });
});

describe('role portals', () => {
  it('gates trainer and parent logins by real role', () => {
    expect(canUsePortal({ role_name: 'coach' }, 'trainer')).toBe(true);
    expect(canUsePortal({ role_name: 'parent' }, 'trainer')).toBe(false);
    expect(canUsePortal({ role_name: 'parent' }, 'parent')).toBe(true);
    expect(canUsePortal({ role_name: 'coach' }, 'parent')).toBe(false);
    expect(canUsePortal({ role_name: 'super_admin' }, 'trainer')).toBe(false);
  });
  it('routes each role home', () => {
    expect(homeFor({ role_name: 'coach' })).toBe('/trainer');
    expect(homeFor({ role_name: 'parent' })).toBe('/parent');
    expect(homeFor({ role_name: 'super_admin' })).toBe('/');
    expect(homeFor({ is_superuser: true })).toBe('/');
    expect(homeFor({ role_name: 'school_admin' })).toBe('/');
    expect(homeFor(null)).toBe('/login');
  });
});

describe('portal detection', () => {
  it('maps route prefixes to their portal', () => {
    expect(portalFromPath('/parent')).toBe('parent');
    expect(portalFromPath('/parent/login')).toBe('parent');
    expect(portalFromPath('/trainer')).toBe('trainer');
    expect(portalFromPath('/trainer/login')).toBe('trainer');
    expect(portalFromPath('/super-admin/login')).toBe('super');
    expect(portalFromPath('/')).toBe('admin');
    expect(portalFromPath('/students')).toBe('admin');
  });
  it('keeps admin routes that share a portal prefix in the admin portal', () => {
    // `/parents` (Parents module) and `/trainers` (Trainers module) must not
    // be mistaken for the parent/trainer portals — doing so swaps the auth jar,
    // nulls the admin user and bounces to the login page.
    expect(portalFromPath('/parents')).toBe('admin');
    expect(portalFromPath('/parents/123')).toBe('admin');
    expect(portalFromPath('/trainers')).toBe('admin');
    expect(portalFromPath('/trainers/new')).toBe('admin');
  });
  it('sends an expired session to its own portal login', () => {
    expect(expiredLoginPath('parent')).toBe('/parent/login?expired=1');
    expect(expiredLoginPath('trainer')).toBe('/trainer/login?expired=1');
    expect(expiredLoginPath('admin')).toBe('/login?expired=1');
  });
});

describe('per-portal session isolation', () => {
  // Minimal in-memory localStorage (node env has none).
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
    };
  });
  afterEach(() => { delete (globalThis as any).localStorage; });

  it('keeps each portal in its own keys', () => {
    setSession('parent-access', 'parent-refresh', 1000, 'parent');
    setSession('trainer-access', 'trainer-refresh', 2000, 'trainer');

    expect(getAccess('parent')).toBe('parent-access');
    expect(getRefresh('parent')).toBe('parent-refresh');
    expect(getAccess('trainer')).toBe('trainer-access');
    expect(getAccess('admin')).toBe(null);
  });

  it('clearing the parent session leaves the trainer session intact', () => {
    setSession('p', 'pr', 1000, 'parent');
    setSession('t', 'tr', 2000, 'trainer');

    clearSession('parent');

    expect(getAccess('parent')).toBe(null);
    expect(getExp('parent')).toBe(null);
    // Teacher's separate jar survives a parent logout.
    expect(getAccess('trainer')).toBe('t');
    expect(getRefresh('trainer')).toBe('tr');
    expect(getExp('trainer')).toBe(2000);
  });
});
