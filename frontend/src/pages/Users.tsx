import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Pencil, Power, ScrollText, ShieldCheck } from 'lucide-react';
import api, { errMsg } from '../api/client';
import { ALL_CODES, RBAC_MODULES, SCHOOL_ADMIN_VIEWS, roleCodes } from '../api/rbac';
import { useAuth } from '../contexts/AuthContext';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Drawer,
  Field,
  PageHeader,
  Section,
  Select,
  StatusBadge,
  Toast,
} from '../components/ui';

function toRows(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function usePaged(url: string, params: Record<string, any> = {}) {
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [err, setErr] = useState('');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params);
  useEffect(() => { setPage(1); }, [key]);
  useEffect(() => {
    let live = true;
    api.get(url, { params: { ...JSON.parse(key), page } })
      .then((r) => {
        if (!live) return;
        setRows(toRows(r.data));
        setCount(typeof r.data?.count === 'number' ? r.data.count : toRows(r.data).length);
        setErr('');
      })
      .catch((e) => live && setErr(errMsg(e)));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key, page, tick]);
  return { rows, count, err, page, setPage: (n: number) => setPage(Math.max(1, n)), reload: () => setTick((t) => t + 1) };
}

function useOptions(url: string) {
  const [opts, setOpts] = useState<any[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => { api.get(url).then((r) => setOpts(toRows(r.data))).catch(() => {}); }, [url, tick]);
  return { opts, reloadOpts: () => setTick((t) => t + 1) };
}

export function PermissionMatrix({ codes, onChange, disabled }: {
  codes: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}) {
  const set = new Set(codes);
  const toggle = (code: string) => {
    const next = new Set(set);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(ALL_CODES.filter((c) => next.has(c)));
  };
  const allViews = RBAC_MODULES.flatMap((m) => m.actions.filter((a) => a.code.endsWith('.view')).map((a) => a.code));
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onChange([...new Set([...codes, ...allViews])])}>
          Select all views
        </Button>
        <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onChange(codes.filter((c) => c.endsWith('.view')))}>
          Revoke all optional
        </Button>
        <span style={{ alignSelf: 'center', fontSize: 12.5, color: 'var(--jetz-muted)' }}>
          {codes.length} permission{codes.length === 1 ? '' : 's'} selected
        </span>
      </div>
      {RBAC_MODULES.map((m) => (
        <div key={m.module} className="jetz-card" style={{ marginBottom: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>{m.label}</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {m.actions.map((a) => (
              <label key={a.code} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: disabled ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={set.has(a.code)}
                  disabled={disabled}
                  onChange={() => toggle(a.code)}
                  style={{ width: 16, height: 16, accentColor: 'var(--jetz-accent)' }}
                />
                {a.label}
                {a.sensitive && (
                  <span className="jetz-badge jetz-badge-red" title="Sensitive: audited, grant sparingly">sensitive</span>
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function randomTemp(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join('');
}

const fmtDT = (v: any) => (v ? String(v).slice(0, 16).replace('T', ' ') : '—');

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  academy_admin: 'Academy Admin',
  school_admin: 'School Admin',
  coach: 'Coach',
  parent: 'Parent',
};
const roleLabel = (u: any) => {
  const raw = u.role_name || '';
  if (!raw) return '—';
  return ROLE_LABELS[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
};

export default function Users() {
  const { can, isSuper, user, refresh } = useAuth();
  const nav = useNavigate();
  const { rows, count, err, page, setPage, reload } = usePaged('/users/');
  const { opts: roles, reloadOpts: reloadRoles } = useOptions('/users/roles/');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  // create form
  const [form, setForm] = useState({ username: '', password: '', role: '', school: '' });
  const [schools, setSchools] = useState<any[]>([]);
  useEffect(() => { api.get('/schools/', { params: { page_size: 100 } }).then((r) => setSchools(toRows(r.data))).catch(() => {}); }, []);
  const schoolName = (id: any) => schools.find((s: any) => String(s.id) === String(id))?.name || '—';
  const [viewSel, setViewSel] = useState<string[]>(SCHOOL_ADMIN_VIEWS);
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string } | null>(null);

  // edit / actions
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ username: '', first_name: '', last_name: '', email: '', phone: '', role: '', school: '', is_active: true });
  const [confirmToggle, setConfirmToggle] = useState<any>(null);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [permUser, setPermUser] = useState<any>(null);
  const [permCodes, setPermCodes] = useState<string[]>([]);
  const [permRoleId, setPermRoleId] = useState<number | null>(null);
  const [permBusy, setPermBusy] = useState(false);

  const reloadAll = () => { reload(); reloadRoles(); };
  const roleOf = (u: any) => roles.find((r: any) => r.id === (u.role ?? u.role_id)) || roles.find((r: any) => r.name === u.role_name);
  const permsOf = (u: any) => {
    if ((u.role_name === 'super_admin') || u.is_superuser) return ALL_CODES;
    return roleOf(u)?.permissions?.map((p: any) => p.code) || u.permissions || [];
  };

  const assignableRoles = roles.filter((r: any) =>
    isSuper() || !['super_admin', 'academy_admin'].includes(r.name));
  const usesTemplate = form.role === '__school_admin__';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk(''); setCreatedCreds(null);
    if (busy) return;
    if (!form.username.trim()) { setMsg('Username is required.'); return; }
    if (!form.password || form.password.length < 8) { setMsg('Set a temporary password (min 8 characters). The account must change it at first login.'); return; }
    if (!form.role) { setMsg('Pick a role.'); return; }
    if (usesTemplate && !form.school) { setMsg('Pick the school this admin belongs to.'); return; }
    setBusy(true);
    try {
      let roleId: number;
      if (usesTemplate) {
        const tpl = roles.find((r: any) => r.name === 'school_admin');
        if (!tpl) throw new Error('school_admin template role is missing — contact support.');
        const { data: clone } = await api.post('/users/roles/', {
          name: `admin_${form.username.trim()}`, description: `Individual permissions for ${form.username.trim()}`,
          permission_codes: viewSel,
        });
        roleId = clone.id;
      } else {
        roleId = Number(form.role);
      }
      try {
        await api.post('/users/', { username: form.username.trim(), password: form.password, role: roleId, ...(form.school ? { school: Number(form.school) } : {}) });
      } catch (e: any) {
        if (usesTemplate) await api.delete(`/users/roles/${roleId}/`).catch(() => {});
        throw e;
      }
      setCreatedCreds({ username: form.username.trim(), password: form.password });
      setOk(`Account ${form.username.trim()} created${form.school ? ` for ${schoolName(form.school)}` : ''} with view-only access. Share the temporary password securely — it is shown once.`);
      setForm({ username: '', password: '', role: '', school: '' });
      setViewSel(SCHOOL_ADMIN_VIEWS);
      reloadAll();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };

  const startEdit = (u: any) => {
    setEditing(u); setMsg(''); setOk('');
    setEditForm({ username: u.username || '', first_name: u.first_name || '', last_name: u.last_name || '', email: u.email || '', phone: u.phone || '', role: u.role ? String(u.role) : '', school: u.school ? String(u.school) : '', is_active: u.is_active !== false });
  };
  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.username.trim()) { setMsg('Username is required.'); return; }
    setBusy(true); setMsg(''); setOk('');
    try {
      const { data } = await api.patch(`/users/${editing.id}/`, { ...editForm, username: editForm.username.trim(), role: editForm.role ? Number(editForm.role) : null, school: editForm.school ? Number(editForm.school) : null });
      if (data.username && user && data.id === user.id) await refresh();
      setOk(`Account ${data.username} updated — changes apply on their very next request.`);
      setEditing(null); reloadAll();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };

  const toggleActive = async () => {
    if (!confirmToggle) return;
    const u = confirmToggle;
    setConfirmToggle(null); setMsg(''); setOk('');
    try {
      await api.patch(`/users/${u.id}/`, { is_active: !u.is_active });
      setOk(u.is_active ? `Account ${u.username} deactivated — signed out everywhere immediately.` : `Account ${u.username} reactivated.`);
      reloadAll();
    } catch (e: any) { setMsg(errMsg(e)); }
  };

  const doReset = async () => {
    if (!resetTarget) return;
    setMsg(''); setOk(''); setResetResult(null);
    try {
      const { data } = await api.post(`/users/${resetTarget.id}/reset_password/`, {});
      setResetResult(data.temporary_password);
      setOk(`Temporary password set for ${resetTarget.username}. They must change it at next login.`);
      reloadAll();
    } catch (e: any) { setMsg(errMsg(e)); }
  };

  const openPerms = (u: any) => {
    const role = roleOf(u);
    setPermUser(u);
    setPermRoleId(role?.id ?? null);
    setPermCodes(role ? roleCodes(role) : (u.permissions || []));
    setMsg(''); setOk('');
  };
  const makeIndividual = async () => {
    if (!permUser) return;
    setPermBusy(true); setMsg(''); setOk('');
    try {
      const { data: clone } = await api.post('/users/roles/', {
        name: `admin_${permUser.username}`, description: `Individual permissions for ${permUser.username}`,
        permission_codes: permCodes,
      });
      await api.patch(`/users/${permUser.id}/`, { role: clone.id });
      setOk(`Individual role created for ${permUser.username}.`);
      setPermRoleId(clone.id);
      reloadAll();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setPermBusy(false); }
  };
  const savePerms = async () => {
    if (!permRoleId) return;
    if (!window.confirm('Apply these permission changes? Sensitive grants take effect on the very next request and are audit-logged.')) return;
    setPermBusy(true); setMsg(''); setOk('');
    try {
      await api.patch(`/users/roles/${permRoleId}/`, { permission_codes: permCodes });
      setOk('Permissions saved — effective immediately, no re-login needed.');
      reloadAll();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setPermBusy(false); }
  };

  const canCreate = can('users.create');
  const canEdit = can('users.edit');
  const canReset = can('users.reset_password');
  const permRole = roles.find((r: any) => r.id === permRoleId);
  const sharedWarning = permRole && (permRole.member_count ?? 0) > 1;

  return (
    <div>
      <PageHeader title="Users & Roles" sub={`${count} accounts · view-only by default · changes apply instantly`} actions={<Button size="sm" variant="secondary" onClick={reloadAll}>Refresh</Button>} />
      <Toast msg={err || msg} />
      {ok && <Toast msg={ok} kind="success" />}
      {createdCreds && (
        <div className="jetz-card" style={{ marginBottom: 14, borderLeft: '4px solid var(--jetz-accent)' }}>
          <div className="jetz-panel-title">Share these credentials once — then forget them</div>
          <p className="jetz-note">Username <strong>{createdCreds.username}</strong> · Temporary password <strong>{createdCreds.password}</strong> · must be changed at first login.</p>
          <Button size="sm" variant="secondary" onClick={() => setCreatedCreds(null)}>Dismiss</Button>
        </div>
      )}

      {canCreate && (
        <Section title="Create admin account" sub="Starts view-only · you pick exactly which modules they see · password must change at first login">
          <form onSubmit={submit} className="jetz-card" style={{ marginBottom: 0 }}>
            <div className="jetz-form-card" style={{ marginBottom: 0 }}>
              <Field label="Username *" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              <Field label="Temporary password *" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <Button type="button" variant="secondary" onClick={() => setForm({ ...form, password: randomTemp() })}>Generate</Button>
              <label><span className="jetz-label">Role *</span>                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required>
                  <option value="">— pick a role —</option>
                  {isSuper() && <option value="__school_admin__">School admin — individual view-only (recommended)</option>}
                  {!isSuper() && <option value="__school_admin__" disabled>School admin (super admin only)</option>}
                  {assignableRoles.filter((r: any) => !['school_admin', 'super_admin', 'academy_admin'].includes(r.name)).map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                  {isSuper() && assignableRoles.filter((r: any) => r.name === 'academy_admin').map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name} — full access</option>
                  ))}
                </Select>
              </label>
              <label><span className="jetz-label">School {usesTemplate ? '*' : '(optional)'}</span>
                <Select value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} required={usesTemplate}>
                  <option value="">— global staff (all schools) —</option>
                  {schools.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </label>
              <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Creating…' : 'Create admin'}</Button>
            </div>
            {usesTemplate && (
              <div style={{ marginTop: 12 }}>
                <div className="jetz-panel-title" style={{ marginBottom: 8 }}>Modules this admin may view (grant more later per action)</div>
                <PermissionMatrix codes={viewSel} onChange={setViewSel} />
              </div>
            )}
          </form>
        </Section>
      )}

      <Section title="Accounts" sub="Status, role, last login — actions need their own permissions">
        <DataTable
          columns={['Username', 'Name', 'Role', 'School', 'Status', 'Permissions', 'Last login', 'Created', 'Actions']}
          rows={rows.map((u: any) => {
            const pcs = permsOf(u);
            const isSuperRow = pcs.length >= ALL_CODES.length;
            return [
              <span key={'u' + u.id} style={{ fontWeight: 700, color: 'var(--jetz-navy)' }}>{u.username}</span>,
              [u.first_name, u.last_name].filter(Boolean).join(' ') || '—',
              <span key={'r' + u.id} style={{ whiteSpace: 'nowrap' }}>{roleLabel(u)}</span>,
              <span key={'s' + u.id} style={{ whiteSpace: 'nowrap' }}>{u.school_name || schoolName(u.school) || '—'}</span>,
              <StatusBadge key={u.id} value={u.is_active === false ? 'inactive' : 'active'} />,
              <span key={'p' + u.id} className={isSuperRow ? 'jetz-mini-pill super' : 'jetz-mini-pill'}>{isSuperRow ? '★ all' : `${pcs.length} granted`}</span>,
              <span key={'l' + u.id} className="jetz-dt">{fmtDT(u.last_login)}</span>,
              <span key={'c' + u.id} className="jetz-dt">{fmtDT(u.date_joined)}</span>,
              <span key={'a' + u.id} className="jetz-row-actions">
                {can('roles.manage') ? <button type="button" className="jetz-icon-btn jetz-icon-btn-sm" title={`Permissions — ${u.username}`} aria-label={`Permissions for ${u.username}`} onClick={() => openPerms(u)}><ShieldCheck /></button> : null}
                {canEdit ? <button type="button" className="jetz-icon-btn jetz-icon-btn-sm" title={`Edit — ${u.username}`} aria-label={`Edit ${u.username}`} onClick={() => startEdit(u)}><Pencil /></button> : null}
                {canEdit ? <button type="button" className={`jetz-icon-btn jetz-icon-btn-sm${u.is_active === false ? '' : ' danger'}`} title={u.is_active === false ? `Activate — ${u.username}` : `Deactivate — ${u.username}`} aria-label={`${u.is_active === false ? 'Activate' : 'Deactivate'} ${u.username}`} onClick={() => setConfirmToggle(u)}><Power /></button> : null}
                {canReset ? <button type="button" className="jetz-icon-btn jetz-icon-btn-sm" title={`Reset password — ${u.username}`} aria-label={`Reset password for ${u.username}`} onClick={() => { setResetTarget(u); setResetResult(null); }}><KeyRound /></button> : null}
                <button type="button" className="jetz-icon-btn jetz-icon-btn-sm" title={`Audit history — ${u.username}`} aria-label={`Audit history for ${u.username}`} onClick={() => nav(`/audit?user=${u.id}`)}><ScrollText /></button>
              </span>,
            ];
          })}
          empty="No accounts found."
        />
      </Section>

      {editing && (
        <Drawer title={`Edit ${editing.username}`} onClose={() => setEditing(null)}>
          <div className="jetz-form-card">
            <Field label="Username *" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} required />
            <Field label="First name" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
            <Field label="Last name" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
            <Field label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            <Field label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            <label><span className="jetz-label">Role</span>
              <Select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="">— none —</option>
                {assignableRoles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </label>
            <label><span className="jetz-label">School</span>
              <Select value={editForm.school} onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}>
                <option value="">— global staff (all schools) —</option>
                {schools.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} style={{ width: 18, height: 18 }} />
              <span className="jetz-label" style={{ margin: 0 }}>Active</span>
            </label>
          </div>
          <p className="jetz-note">Role and status apply on their very next request. You cannot edit your own role or deactivate yourself — ask another administrator.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="accent" onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Drawer>
      )}

      {permUser && (
        <Drawer title={`Permissions — ${permUser.username}`} onClose={() => setPermUser(null)}>
          <p className="jetz-note">
            Editing role <strong>{permRole?.name || '—'}</strong>
            {sharedWarning ? ` — shared by ${permRole.member_count} accounts, changes affect all of them.` : ' (individual role).'}
          </p>
          {sharedWarning && (
            <div style={{ marginBottom: 12 }}>
              <Button size="sm" variant="accent" onClick={makeIndividual} disabled={permBusy}>Make individual (clone role for this admin)</Button>
            </div>
          )}
          <PermissionMatrix codes={permCodes} onChange={setPermCodes} disabled={permBusy} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button variant="accent" onClick={savePerms} disabled={permBusy}>{permBusy ? 'Saving…' : 'Save changes'}</Button>
            <Button variant="secondary" onClick={() => setPermUser(null)}>Close</Button>
          </div>
        </Drawer>
      )}

      {confirmToggle && (
        <ConfirmDialog
          title={confirmToggle.is_active ? `Deactivate ${confirmToggle.username}?` : `Reactivate ${confirmToggle.username}?`}
          message={confirmToggle.is_active
            ? 'They will be signed out everywhere immediately — admin panel and trainer app. Records and history are kept.'
            : 'They regain access immediately with their existing password.'}
          confirmLabel={confirmToggle.is_active ? 'Deactivate' : 'Activate'}
          danger={confirmToggle.is_active}
          onConfirm={toggleActive}
          onCancel={() => setConfirmToggle(null)}
        />
      )}

      {resetTarget && (
        <ConfirmDialog
          title={`Reset password for ${resetTarget.username}?`}
          message="A new temporary password is set. They must change it at next login. The old password stops working at once."
          confirmLabel="Reset password"
          danger
          onConfirm={doReset}
          onCancel={() => { setResetTarget(null); }}
        />
      )}
      {resetResult && (
        <Drawer title="Temporary password — shown once" onClose={() => setResetResult(null)}>
          <p className="jetz-note">Share this securely, then forget it. It is never stored or shown again.</p>
          <div className="jetz-card" style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, textAlign: 'center' }}>{resetResult}</div>
          <div style={{ marginTop: 12 }}><Button variant="secondary" onClick={() => setResetResult(null)}>Done</Button></div>
        </Drawer>
      )}
    </div>
  );
}
