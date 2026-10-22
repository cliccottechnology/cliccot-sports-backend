import React, { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';
import { SCHOOL_ADMIN_VIEWS } from '../api/rbac';
import { useAuth } from '../contexts/AuthContext';
import { Button, ConfirmDialog, DataTable, Drawer, Field, PageHeader, Section, StatusBadge, Toast } from '../components/ui';
import { PermissionMatrix } from './Users';

function toRows(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function randomTemp(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join('');
}

export default function Schools() {
  const { can, isSuper } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', address: '', phone: '', email: '', is_active: true });
  const [confirmToggle, setConfirmToggle] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  // onboarding wizard
  const [onboarding, setOnboarding] = useState(false);
  const [sForm, setSForm] = useState({ name: '', code: '', address: '', phone: '', email: '' });
  const [aForm, setAForm] = useState({ username: '', password: '' });
  const [viewSel, setViewSel] = useState<string[]>(SCHOOL_ADMIN_VIEWS);
  const [creds, setCreds] = useState<{ school: string; username: string; password: string } | null>(null);

  const load = async () => {
    setErr('');
    try {
      const { data } = await api.get('/schools/', { params: { page_size: 100 } });
      setRows(toRows(data));
    } catch (e: any) { setErr(errMsg(e)); }
  };
  useEffect(() => { load(); }, []);

  const canManage = can('schools.manage');

  const startEdit = (s: any) => {
    setEditing(s); setMsg(''); setOk('');
    setEditForm({ name: s.name || '', code: s.code || '', address: s.address || '', phone: s.phone || '', email: s.email || '', is_active: s.is_active !== false });
  };
  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.name.trim() || !editForm.code.trim()) { setMsg('Name and code are required.'); return; }
    setBusy(true); setMsg(''); setOk('');
    try {
      await api.patch(`/schools/${editing.id}/`, { ...editForm, name: editForm.name.trim(), code: editForm.code.trim() });
      setOk(`School ${editForm.name.trim()} saved.`);
      setEditing(null); load();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };
  const toggleActive = async () => {
    if (!confirmToggle) return;
    const s = confirmToggle;
    setConfirmToggle(null); setMsg(''); setOk('');
    try {
      await api.patch(`/schools/${s.id}/`, { is_active: !s.is_active });
      setOk(s.is_active ? `School ${s.name} deactivated — its users are locked out immediately.` : `School ${s.name} reactivated.`);
      load();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true); setMsg(''); setOk('');
    try {
      await api.delete(`/schools/${confirmDelete.id}/`);
      setOk(`School ${confirmDelete.name} deleted.`);
      setConfirmDelete(null); load();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };

  const onboard = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk(''); setCreds(null);
    if (busy) return;
    if (!sForm.name.trim() || !sForm.code.trim()) { setMsg('School name and code are required.'); return; }
    if (!aForm.username.trim()) { setMsg('Admin username is required.'); return; }
    if (!aForm.password || aForm.password.length < 8) { setMsg('Set a temporary admin password (min 8 characters).'); return; }
    setBusy(true);
    let schoolId = 0;
    try {
      const { data: school } = await api.post('/schools/', {
        name: sForm.name.trim(), code: sForm.code.trim().toUpperCase(),
        address: sForm.address, phone: sForm.phone, email: sForm.email,
      });
      schoolId = school.id;
      try {
        const { data: clone } = await api.post('/users/roles/', {
          name: `admin_${aForm.username.trim()}`, description: `Admin of ${school.name}`,
          permission_codes: viewSel,
        });
        await api.post('/users/', {
          username: aForm.username.trim(), password: aForm.password,
          role: clone.id, school: schoolId,
        });
      } catch (e: any) {
        await api.delete(`/schools/${schoolId}/`).catch(() => {});
        throw e;
      }
      setCreds({ school: sForm.name.trim(), username: aForm.username.trim(), password: aForm.password });
      setOk(`School ${sForm.name.trim()} onboarded with a view-only admin. Share the credentials once.`);
      setSForm({ name: '', code: '', address: '', phone: '', email: '' });
      setAForm({ username: '', password: '' });
      setViewSel(SCHOOL_ADMIN_VIEWS);
      setOnboarding(false);
      load();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Schools" sub={`${rows.length} onboarded · each school sees only its own data`} actions={<span style={{ display: 'flex', gap: 8 }}><Button size="sm" variant="secondary" onClick={load}>Refresh</Button>{canManage && <Button size="sm" variant="accent" onClick={() => setOnboarding((v) => !v)}>Onboard school</Button>}</span>} />
      <Toast msg={err || msg} />
      {ok && <Toast msg={ok} kind="success" />}
      {creds && (
        <div className="jetz-card" style={{ marginBottom: 14, borderLeft: '4px solid var(--jetz-accent)' }}>
          <div className="jetz-panel-title">Share once — {creds.school} admin</div>
          <p className="jetz-note">Username <strong>{creds.username}</strong> · Temporary password <strong>{creds.password}</strong> · must change at first login · view-only.</p>
          <Button size="sm" variant="secondary" onClick={() => setCreds(null)}>Dismiss</Button>
        </div>
      )}

      {onboarding && canManage && (
        <form onSubmit={onboard} className="jetz-card" style={{ marginBottom: 14 }}>
          <div className="jetz-panel-title">Onboard a new school</div>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <Field label="School name *" placeholder="Greenfield Sports School" value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} required />
            <Field label="Code *" placeholder="GFS" value={sForm.code} onChange={(e) => setSForm({ ...sForm, code: e.target.value })} required />
            <Field label="Address" value={sForm.address} onChange={(e) => setSForm({ ...sForm, address: e.target.value })} />
            <Field label="Phone" value={sForm.phone} onChange={(e) => setSForm({ ...sForm, phone: e.target.value })} />
            <Field label="Email" type="email" value={sForm.email} onChange={(e) => setSForm({ ...sForm, email: e.target.value })} />
            <Field label="Admin username *" value={aForm.username} onChange={(e) => setAForm({ ...aForm, username: e.target.value })} required />
            <Field label="Temporary password *" type="password" value={aForm.password} onChange={(e) => setAForm({ ...aForm, password: e.target.value })} required />
            <Button type="button" variant="secondary" onClick={() => setAForm({ ...aForm, password: randomTemp() })}>Generate</Button>
            <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Onboarding…' : 'Onboard school + admin'}</Button>
            <Button type="button" variant="ghost" onClick={() => setOnboarding(false)}>Cancel</Button>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="jetz-panel-title" style={{ marginBottom: 8 }}>Admin may view (grant more later per action)</div>
            <PermissionMatrix codes={viewSel} onChange={setViewSel} />
          </div>
        </form>
      )}

      <Section title="Onboarded schools" sub="Deactivating a school locks out its users immediately · schools with data cannot be deleted">
        <DataTable
          columns={['School', 'Code', 'Students', 'Batches', 'Coaches', 'Users', 'Status', 'Actions']}
          rows={rows.map((s: any) => [
            s.name, s.code, s.student_count ?? '—', s.batch_count ?? '—', s.coach_count ?? '—', s.user_count ?? '—',
            <StatusBadge key={s.id} value={s.is_active ? 'active' : 'inactive'} />,
            <span key={'a' + s.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {canManage && <Button size="sm" variant="secondary" onClick={() => startEdit(s)}>Edit</Button>}
              {canManage && <Button size="sm" variant="secondary" onClick={() => setConfirmToggle(s)}>{s.is_active ? 'Deactivate' : 'Activate'}</Button>}
              {canManage && isSuper() && <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(s)}>Delete</Button>}
            </span>,
          ])}
          empty="No schools yet — onboard the first one above."
        />
      </Section>

      {editing && (
        <Drawer title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="jetz-form-card">
            <Field label="Name *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            <Field label="Code *" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} required />
            <Field label="Address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            <Field label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            <Field label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button variant="accent" onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Drawer>
      )}

      {confirmToggle && (
        <ConfirmDialog
          title={confirmToggle.is_active ? `Deactivate ${confirmToggle.name}?` : `Reactivate ${confirmToggle.name}?`}
          message={confirmToggle.is_active
            ? 'Every user of this school is locked out immediately. All records are kept.'
            : 'Its users regain access immediately.'}
          confirmLabel={confirmToggle.is_active ? 'Deactivate' : 'Activate'}
          danger={confirmToggle.is_active}
          onConfirm={toggleActive}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.name}?`}
          message="Only empty schools can be deleted. This cannot be undone."
          confirmLabel="Delete school"
          danger
          busy={busy}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
