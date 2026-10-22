import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ROUTE_PERMS, firstAllowed } from './api/rbac';
import { defaultLoginPath, getAccess } from './api/session';
import api from './api/client';
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
import { Attendance, Audit, Batches, Documents, Fees, Notifications, Parents, Payments, Reports, Sessions, Settings, Sports, Students, Timetable, TrainerAttendance, TrainerFees, Trainers, WhatsApp } from './pages/modules';
import Users, { PermissionMatrix } from './pages/Users';
import Roles from './pages/Roles';
import Schools from './pages/Schools';
import { Support } from './pages/Support';
import { Customization } from './pages/Customization';
import { Account } from './pages/Account';
import { NeedsRole, ParentHome, SessionGate, TrainerHome } from './pages/Portals';
import { LoginPage } from './components/ui';
import { Button, PageHeader } from './components/ui';

function Guard({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user && !getAccess()) return <Navigate to={defaultLoginPath()} />;
  return children;
}

function AccessDenied({ need }: { need: string }) {
  return (
    <div>
      <PageHeader title="Access denied" sub={`This screen needs the ${need} permission. Ask your Super Admin to grant it.`} />
      <div className="jetz-card">
        <p className="jetz-note" style={{ margin: 0 }}>
          Your account does not include <strong>{need}</strong>. The menu only lists screens you can open;
          typing a URL directly cannot bypass this — the backend rejects it too.
        </p>
      </div>
    </div>
  );
}

function NeedsPerm({ code, children }: { code: string; children: JSX.Element }) {
  // Permissions refresh on every navigation (see Layout), so a grant/revoke
  // lands without re-login. The backend enforces per request regardless.
  const { can } = useAuth();
  if (!can(code)) return <AccessDenied need={code} />;
  return children;
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const { logout } = useAuth();
  const [oldP, setOldP] = React.useState('');
  const [newP, setNewP] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.post('/auth/change-password/', { old_password: oldP, new_password: newP });
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Could not change password.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--jetz-navy)', padding: 20 }}>
      <form onSubmit={submit} className="jetz-card" style={{ width: 380, maxWidth: '100%', padding: 28 }}>
        <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>Set a new password</h1>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--jetz-muted)' }}>
          Your administrator issued a temporary password. Choose your own (min 8 characters) to continue.
        </p>
        {err && <div role="alert" className="jetz-alert jetz-alert-danger">{err}</div>}
        <label>
          <span className="jetz-label">Temporary password</span>
          <input className="jetz-input" type="password" value={oldP} onChange={(e) => setOldP(e.target.value)} autoComplete="current-password" />
        </label>
        <div style={{ height: 12 }} />
        <label>
          <span className="jetz-label">New password</span>
          <input className="jetz-input" type="password" value={newP} onChange={(e) => setNewP(e.target.value)} autoComplete="new-password" />
        </label>
        <div style={{ height: 18 }} />
        <Button type="submit" variant="accent" block disabled={busy}>{busy ? 'Saving…' : 'Set password & continue'}</Button>
        <div style={{ height: 8 }} />
        <Button variant="ghost" block onClick={() => logout()}>Log out</Button>
      </form>
    </div>
  );
}

function Landing() {
  // Dashboard for those who may see it; otherwise the first permitted
  // module (so a students-only admin never lands on Access Denied).
  const { user } = useAuth();
  const perms = user?.permissions;
  if (!perms || perms.includes('reports.view')) {
    return <NeedsPerm code="reports.view"><Dashboard /></NeedsPerm>;
  }
  const path = firstAllowed(perms);
  if (path) return <Navigate to={path} replace />;
  return <AccessDenied need="any module permission" />;
}

function Shell() {
  const { user, refresh } = useAuth();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => { refresh().finally(() => setReady(true)); }, []);
  if (!ready && getAccess()) {
    return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>Loading…</div>;
  }
  if (user?.must_change_password) {
    return <ChangePassword onDone={() => refresh()} />;
  }
  // Restricted admins land on their first permitted module instead of a
  // dashboard they may not see. Nobody permitted anywhere gets guidance.
  const R = (path: string, el: JSX.Element) => {
    const code = ROUTE_PERMS[path] || ROUTE_PERMS['/' + path] || 'reports.view';
    return <Route path={path} element={<NeedsPerm code={code}>{el}</NeedsPerm>} />;
  };
  return (
    <Routes>
      <Route path="/login" element={<LoginPage mode="admin" />} />
      <Route path="/admin/login" element={<LoginPage mode="admin" />} />
      <Route path="/super-admin/login" element={<LoginPage mode="super" />} />
      <Route path="/trainer/login" element={<LoginPage mode="trainer" />} />
      <Route path="/parent/login" element={<LoginPage mode="parent" />} />
      <Route path="/trainer" element={<Guard><><SessionGate /><NeedsRole role="coach"><TrainerHome /></NeedsRole></></Guard>} />
      <Route path="/parent" element={<Guard><><SessionGate /><NeedsRole role="parent"><ParentHome /></NeedsRole></></Guard>} />
      <Route path="/" element={<Guard><><SessionGate /><Layout /></></Guard>}>
        <Route index element={<Landing />} />
        {R('sports', <Sports />)}
        {R('students', <Students />)}
        {R('parents', <Parents />)}
        {R('documents', <Documents />)}
        {R('notifications', <Notifications />)}
        {R('batches', <Batches />)}
        {R('sessions', <Sessions />)}
        {R('timetable', <Timetable />)}
        {R('attendance', <Attendance />)}
        {R('trainer-attendance', <TrainerAttendance />)}
        {R('fees', <Fees />)}
        {R('payments', <Payments />)}
        {R('trainers', <Trainers />)}
        {R('trainer-fees', <TrainerFees />)}
        {R('reports', <Reports />)}
        {R('whatsapp', <WhatsApp />)}
        {R('users', <Users />)}
        {R('roles', <Roles />)}
        {R('schools', <Schools />)}
        {R('support', <Support />)}
        {R('customization', <Customization />)}
        {R('settings', <Settings />)}
        {R('audit', <Audit />)}
        <Route path="account" element={<Account />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}

export { PermissionMatrix };
