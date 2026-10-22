import { describe, expect, it } from 'vitest';
import { ALL_CODES, RBAC_MODULES, ROUTE_PERMS, SCHOOL_ADMIN_VIEWS, can, canUsePortal, firstAllowed, roleCodes } from './rbac';

describe('rbac catalog', () => {
  it('covers every nav route with a view permission', () => {
    for (const code of Object.values(ROUTE_PERMS)) {
      expect(ALL_CODES, code).toContain(code);
    }
  });
  it('school admin starter set is view-only', () => {
    expect(SCHOOL_ADMIN_VIEWS.length).toBeGreaterThan(10);
    for (const c of SCHOOL_ADMIN_VIEWS) expect(c.endsWith('.view')).toBe(true);
    expect(SCHOOL_ADMIN_VIEWS).not.toContain('users.view');
    expect(SCHOOL_ADMIN_VIEWS).not.toContain('settings.view');
    expect(SCHOOL_ADMIN_VIEWS).not.toContain('audit.view');
  });
  it('sensitive actions are flagged', () => {
    const sensitive = RBAC_MODULES.flatMap((m) => m.actions.filter((a) => a.sensitive).map((a) => a.code));
    expect(sensitive).toContain('users.reset_password');
    expect(sensitive).toContain('payments.refund');
    expect(sensitive).toContain('attendance.correct');
  });
});

describe('can()', () => {
  it('grants only listed codes once loaded', () => {
    expect(can(['students.view'], 'students.view')).toBe(true);
    expect(can(['students.view'], 'students.create')).toBe(false);
  });
  it('is permissive before load (backend still enforces)', () => {
    expect(can(undefined, 'students.create')).toBe(true);
  });
});

describe('roleCodes()', () => {
  it('extracts codes for previews', () => {
    expect(roleCodes({ permissions: [{ code: 'a.b' }] })).toEqual(['a.b']);
    expect(roleCodes({})).toEqual([]);
  });
});

describe('firstAllowed()', () => {
  it('lands restricted admins on their first permitted module', () => {
    expect(firstAllowed(['students.view'])).toBe('/students');
    expect(firstAllowed(['fees.view', 'students.view'])).toBe('/students');
  });
  it('returns null when nothing is permitted', () => {
    expect(firstAllowed([])).toBe(null);
  });
  it('defaults to dashboard while loading', () => {
    expect(firstAllowed(undefined)).toBe('/');
  });
});

describe('canUsePortal()', () => {
  it('opens the admin portal to everyone signed in', () => {
    expect(canUsePortal({ role_name: 'school_admin' }, 'admin')).toBe(true);
    expect(canUsePortal({ role_name: 'super_admin' }, 'admin')).toBe(true);
  });
  it('restricts the super portal to super admins', () => {
    expect(canUsePortal({ role_name: 'super_admin' }, 'super')).toBe(true);
    expect(canUsePortal({ is_superuser: true }, 'super')).toBe(true);
    expect(canUsePortal({ role_name: 'school_admin' }, 'super')).toBe(false);
    expect(canUsePortal({ role_name: 'academy_admin' }, 'super')).toBe(false);
    expect(canUsePortal(null, 'super')).toBe(false);
  });
});
