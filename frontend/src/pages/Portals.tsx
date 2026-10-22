import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { fmtCountdown, getExp, isExpired, WARN_MS } from '../api/session';
import { useAuth } from '../contexts/AuthContext';
import { useAcademyBrand } from '../api/settings';
import {
  Button,
  Card,
  CardGrid,
  DataTable,
  Empty,
  Loading,
  PageHeader,
  Section,
  StatCard,
  StatusBadge,
  Toast,
  formatINR,
  formatNum,
} from '../components/ui';

/* ---------- role guard: URL typing alone never grants a portal ---------- */
export function NeedsRole({ role, children }: { role: 'coach' | 'parent'; children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role_name !== role && !(role === 'coach' && user.is_superuser) && !(role === 'parent' && user.is_superuser)) {
    return (
      <div>
        <PageHeader title="Access denied" sub="This portal is role-locked." />
        <div className="jetz-card"><p className="jetz-note" style={{ margin: 0 }}>Your account is not a {role} account.</p></div>
      </div>
    );
  }
  return children;
}

/* ---------- session countdown: warning banner, then forced logout ------- */
export function SessionGate() {
  const { user, logout } = useAuth();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!user) return;
    const check = () => {
      const exp = getExp();
      if (isExpired(exp)) logout();
      else setTick((t) => t + 1);
    };
    check();
    const t = setInterval(check, 15000);
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  if (!user) return null;
  const exp = getExp();
  if (exp === null) return null;
  const ms = exp * 1000 - Date.now();
  if (ms <= 0 || ms > WARN_MS) return null;
  return (
    <div role="alert" className="jetz-alert jetz-alert-warning" style={{ margin: '12px 24px 0' }}>
      Session ends in {fmtCountdown(ms)} — save your work. You will be signed out automatically.
    </div>
  );
}

function PortalShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const brandName = useAcademyBrand().name.trim();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--jetz-bg)' }}>
      <header className="jetz-topbar">
        <div className="jetz-topbar-main">
          {brandName ? <div className="jetz-page-eyebrow">{brandName}</div> : null}
          <div className="jetz-topbar-heading"><span className="jetz-topbar-page">{title}</span></div>
          <div className="jetz-topbar-greet">{sub} · signed in as <strong>{user?.username}</strong></div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => logout()}>Log out</Button>
      </header>
      <main className="jetz-content">{children}</main>
    </div>
  );
}

function toRows(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

/* ================= TRAINER PORTAL ================= */
export function TrainerHome() {
  const [me, setMe] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [att, setAtt] = useState<any[]>([]);
  const [earn, setEarn] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data: coach } = await api.get('/coaches/me/');
        if (!live) return;
        setMe(coach);
        const [s, a, e] = await Promise.all([
          api.get('/sessions/', { params: { coach: coach.id, ordering: 'date', page_size: 10 } }),
          api.get('/attendance/', { params: { page_size: 10 } }),
          api.get('/trainer-fees/payables/earnings/', { params: { period: 'month' } }),
        ]);
        if (!live) return;
        setSessions(toRows(s.data));
        setAtt(toRows(a.data));
        setEarn(e.data);
      } catch (e: any) {
        if (live) setErr(errMsg(e));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);
  if (loading) return <PortalShell title="Trainer" sub="Loading"><Loading label="Loading your dashboard…" /></PortalShell>;
  return (
    <PortalShell title="Trainer dashboard" sub={me ? `${me.first_name || ''} ${me.last_name || ''} · ${me.trainer_id || ''}` : ''}>
      {err && <Toast msg={err} kind="danger" />}
      <Section title="This month" sub="Sessions taken and earnings">
        <CardGrid>
          <StatCard label="Sessions taken" value={formatNum(earn?.sessions_taken ?? 0)} icon={<span>◷</span>} />
          <StatCard label="Earned" value={formatINR((earn?.payable_amount || 0) + (earn?.paid_amount || 0))} icon={<span>₹</span>} accent />
          <StatCard label="Paid out" value={formatINR(earn?.paid_amount || 0)} icon={<span>✓</span>} />
        </CardGrid>
      </Section>
      <Section title="My sessions" sub="Assigned sessions, newest first">
        <DataTable
          columns={['Date', 'Batch', 'Time', 'Status']}
          rows={sessions.map((s: any) => [s.date, s.batch_name || '-', `${s.start_time || ''}–${s.end_time || ''}`, <StatusBadge key={s.id} value={s.status} />])}
          empty="No sessions assigned yet."
        />
      </Section>
      <Section title="Recent attendance" sub="Latest check-ins you marked">
        <DataTable
          columns={['Date', 'Student', 'Status']}
          rows={att.slice(0, 10).map((a: any) => [a.marked_at?.slice(0, 10) || '-', a.student_name || `#${a.student}`, <StatusBadge key={a.id} value={a.status} />])}
          empty="No attendance marked yet."
        />
      </Section>
    </PortalShell>
  );
}

/* ================= PARENT PORTAL ================= */
export function ParentHome() {
  const [students, setStudents] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [att, setAtt] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data } = await api.get('/students/', { params: { page_size: 50 } });
        if (!live) return;
        const kids = toRows(data);
        setStudents(kids);
        if (kids[0]) setSel(kids[0]);
        const { data: n } = await api.get('/notifications/', { params: { page_size: 10 } });
        if (live) setNotes(toRows(n.data));
      } catch (e: any) {
        if (live) setErr(errMsg(e));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!sel) return;
    let live = true;
    (async () => {
      try {
        const [a, f, s, c] = await Promise.all([
          api.get('/attendance/', { params: { student: sel.id, page_size: 10 } }),
          api.get('/fees/', { params: { student: sel.id, page_size: 10 } }),
          api.get('/sessions/', { params: { student: sel.id, ordering: 'date', page_size: 5 } }),
          api.get('/students/certificates/', { params: { student: sel.id, page_size: 10 } }).catch(() => ({ data: [] })),
        ]);
        if (!live) return;
        setAtt(toRows(a.data));
        setFees(toRows(f.data));
        setSessions(toRows(s.data));
        setCerts(toRows(c.data));
      } catch (e: any) {
        if (live) setErr(errMsg(e));
      }
    })();
    return () => { live = false; };
  }, [sel?.id]);
  if (loading) return <PortalShell title="Parent" sub="Loading"><Loading label="Loading your dashboard…" /></PortalShell>;
  if (!students.length && !loading) {
    return (
      <PortalShell title="Parent dashboard" sub="No linked students">
        {err && <Toast msg={err} kind="danger" />}
        <Empty title="No linked athletes" message="No students are linked to this account yet. Ask your academy admin to link them." />
      </PortalShell>
    );
  }
  const due = fees.filter((f: any) => !['paid', 'cancelled', 'refunded'].includes(f.status));
  return (
    <PortalShell title="Parent dashboard" sub={`${students.length} linked athlete${students.length === 1 ? '' : 's'}`}>
      {err && <Toast msg={err} kind="danger" />}
      <div className="jetz-filterbar">
        {students.map((s: any) => (
          <Button key={s.id} size="sm" variant={sel?.id === s.id ? 'accent' : 'secondary'} onClick={() => setSel(s)}>
            {s.first_name} ({s.student_id})
          </Button>
        ))}
      </div>
      {sel && (
        <>
          <Section title={`${sel.first_name}'s attendance`} sub="Latest check-ins">
            <DataTable
              columns={['Date', 'Session', 'Status']}
              rows={att.slice(0, 10).map((a: any) => [a.marked_at?.slice(0, 10) || '-', a.session_name || `Session ${a.session}`, <StatusBadge key={a.id} value={a.status} />])}
              empty="No attendance records yet."
            />
          </Section>
          <Section title="Upcoming sessions" sub="Scheduled training">
            <DataTable
              columns={['Date', 'Session', 'Time', 'Trainer', 'Status']}
              rows={sessions.map((s: any) => [s.date, `Session ${s.slot ?? 1}`, `${s.start_time || ''}–${s.end_time || ''}`, s.coach_name || '-', <StatusBadge key={s.id} value={s.status} />])}
              empty="No upcoming sessions."
            />
          </Section>
          <Section title="Fees" sub={due.length ? `${due.length} open fee(s)` : 'All settled'}>
            <DataTable
              columns={['Period', 'Amount', 'Paid', 'Status']}
              rows={fees.map((f: any) => [f.period_label, formatINR(f.amount), formatINR(f.paid_total ?? 0), <StatusBadge key={f.id} value={f.status} />])}
              empty="No fees allocated."
            />
          </Section>
          <Section title="Certificates" sub={certs.length ? `${certs.length} issued` : 'Milestone certificates appear here'}>
            {certs.length ? certs.map((c: any) => (
              <div key={c.id} className="jetz-card" style={{ marginBottom: 8 }}>
                <strong>{c.title}</strong>
                <p className="jetz-note" style={{ margin: '4px 0 0' }}>
                  {c.sport_name || 'Sport'} · {c.period_from} → {c.period_to} · No. {c.certificate_no || '—'}
                  {c.file ? <> · <a href={c.file} target="_blank" rel="noreferrer">Open PDF</a></> : null}
                </p>
              </div>
            )) : <Empty title="No certificates yet" message="Issued certificates for this athlete appear here." />}
          </Section>
          <Section title="Notices" sub="Latest academy messages">
            {notes.length ? notes.slice(0, 5).map((n: any) => (
              <div key={n.id} className="jetz-card" style={{ marginBottom: 8 }}>
                <strong>{n.title}</strong>
                <p className="jetz-note" style={{ margin: '4px 0 0' }}>{n.message}</p>
              </div>
            )) : <Empty title="No notices" message="Academy announcements appear here." />}
          </Section>
        </>
      )}
    </PortalShell>
  );
}
