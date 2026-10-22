/* RBAC catalog mirror (backend: apps/accounts/rbac_catalog.py).
   Frontend visibility only — the backend re-checks everything per request. */

export type ModuleDef = { module: string; label: string; actions: { code: string; label: string; sensitive?: boolean }[] };

const A = (module: string, actions: [string, string, boolean?][]): ModuleDef => ({
  module,
  label: module.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  actions: actions.map(([a, label, sensitive]) => ({ code: `${module}.${a}`, label, sensitive: !!sensitive })),
});

export const RBAC_MODULES: ModuleDef[] = [
  A("schools", [["view", "View schools and branches"], ["create", "Create branches"], ["edit", "Edit branches"], ["archive", "Archive branches"], ["manage", "Onboard and manage schools", true]]),  A("sports", [["view", "View"], ["create", "Create"], ["edit", "Edit"], ["archive", "Archive"], ["export", "Export"]]),
  A("students", [["view", "View"], ["create", "Create"], ["edit", "Edit"], ["archive", "Archive"], ["export", "Export"]]),
  A("parents", [["view", "View"], ["create", "Create"], ["edit", "Edit"], ["archive", "Archive"], ["export", "Export"]]),
  A("coaches", [["view", "View"], ["create", "Create"], ["edit", "Edit"], ["archive", "Archive"], ["export", "Export"]]),
  A("batches", [["view", "View"], ["create", "Create"], ["edit", "Edit"], ["archive", "Archive"], ["export", "Export"]]),
  A("sessions", [["view", "View"], ["create", "Create"], ["edit", "Edit"], ["archive", "Archive"], ["export", "Export"]]),
  A("attendance", [["view", "View"], ["mark", "Mark"], ["correct", "Correct", true], ["export", "Export"]]),
  A("fees", [["view", "View"], ["create", "Create"], ["edit", "Edit"], ["adjust", "Approve adjustments", true], ["export", "Export"]]),
  A("payments", [["view", "View"], ["create", "Initiate"], ["verify", "Verify", true], ["refund", "Approve refunds", true], ["export", "Export"]]),
  A("trainer_fees", [["view", "View"], ["manage", "Configure rules", true], ["generate", "Generate"], ["verify", "Verify", true], ["pay", "Approve settlements", true], ["adjust", "Approve adjustments", true]]),
  A("whatsapp", [["view", "View log"], ["send", "Send"], ["manage", "Templates", true]]),
  A("reports", [["view", "View"], ["export", "Export"]]),
  A("notifications", [["view", "View"], ["send", "Send"]]),
  A("documents", [["view", "View"], ["create", "Upload"], ["edit", "Edit"], ["archive", "Archive"], ["export", "Export"]]),
  A("support", [["view", "View"], ["create", "Raise"], ["reply", "Reply"], ["manage", "Manage all tickets", true]]),
  A("customization", [["view", "View"], ["create", "Submit"], ["reply", "Comment / Reply"], ["review", "Review & Decide", true], ["manage", "Assign / Track / Reopen", true]]),
  A("users", [["view", "View"], ["create", "Create"], ["edit", "Edit"], ["activate", "Activate / deactivate", true], ["reset_password", "Reset passwords", true]]),
  A("roles", [["view", "View"], ["manage", "Manage roles", true]]),
  A("settings", [["view", "View"], ["edit", "Edit", true]]),
  A("audit", [["view", "View"]]),
];

/** View-only starter set for new school admins (mirrors backend SCHOOL_ADMIN_VIEWS). */
export const SCHOOL_ADMIN_VIEWS = RBAC_MODULES.flatMap((m) =>
  m.actions.filter((a) => a.code.endsWith(".view")).map((a) => a.code),
).filter((c) => !["schools.view", "users.view", "roles.view", "settings.view", "audit.view", "support.view", "customization.view"].includes(c));

export const ALL_CODES = RBAC_MODULES.flatMap((m) => m.actions.map((a) => a.code));

/** Route -> required view permission. Dashboard needs any reporting view. */
export const ROUTE_PERMS: Record<string, string> = {
  "/": "reports.view",
  "/schools": "schools.view",
  "/sports": "sports.view",
  "/students": "students.view",
  "/parents": "parents.view",
  "/batches": "batches.view",
  "/sessions": "sessions.view",
  "/timetable": "sessions.view",
  "/attendance": "attendance.view",
  "/trainer-attendance": "coaches.view",
  "/trainers": "coaches.view",
  "/documents": "documents.view",
  "/support": "support.view",
  "/customization": "customization.view",
  "/fees": "fees.view",
  "/payments": "payments.view",
  "/trainer-fees": "trainer_fees.view",
  "/reports": "reports.view",
  "/whatsapp": "whatsapp.view",
  "/notifications": "notifications.view",
  "/audit": "audit.view",
  "/users": "users.view",
  "/roles": "roles.view",
  "/settings": "settings.view",
};

export function can(perms: string[] | undefined, code: string): boolean {
  if (!perms) return true; // not yet loaded — backend still enforces
  return perms.includes(code);
}

/** First sidebar route the permission set may open (skips dashboard). */
export function firstAllowed(perms: string[] | undefined): string | null {
  if (!perms) return '/';
  for (const [path, code] of Object.entries(ROUTE_PERMS)) {
    if (path === '/') continue;
    if (perms.includes(code)) return path;
  }
  return null;
}

export type Portal = 'admin' | 'super' | 'trainer' | 'parent';

/** Portal links: one login per role. */
export const PORTAL_PATHS: Record<Portal, string> = {
  admin: '/login',
  super: '/super-admin/login',
  trainer: '/trainer/login',
  parent: '/parent/login',
};

/** Home route per role after login. */
export function homeFor(user: { is_superuser?: boolean; role_name?: string } | null): string {
  if (!user) return '/login';
  if (user.is_superuser === true || user.role_name === 'super_admin') return '/';
  if (user.role_name === 'coach') return '/trainer';
  if (user.role_name === 'parent') return '/parent';
  return '/';
}

/** Whether an authenticated user may use a portal. The backend verifies the
 *  real assigned role — never trust a role sent by the frontend. */
export function canUsePortal(
  user: { is_superuser?: boolean; role_name?: string } | null,
  portal: Portal,
): boolean {
  if (!user) return false;
  if (portal === 'admin') return true;
  if (portal === 'super') return user.is_superuser === true || user.role_name === 'super_admin';
  if (portal === 'trainer') return user.role_name === 'coach';
  return user.role_name === 'parent';
}

/** Effective codes for a role object ({permissions: [{code}]}) — for previews. */
export function roleCodes(role: { permissions?: { code: string }[] }): string[] {
  return (role.permissions || []).map((p) => p.code);
}
