import React, { useState } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button, ConfirmDialog, DataTable, Drawer, Field, PageHeader, Toast } from '../components/ui';
import { PermissionMatrix } from './Users';

const SYSTEM_ROLES = ['super_admin', 'academy_admin', 'coach', 'parent'];

export default function Roles() {
  const { isSuper } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const load = async () => {
    setErr('');
    try {
      const { data } = await api.get('/users/roles/');
      setRoles(Array.isArray(data) ? data : data.results || []);
    } catch (e: any) { setErr(errMsg(e)); }
  };
  React.useEffect(() => { load(); }, []);

  const openEdit = (r: any) => {
    setEditing(r);
    setCodes((r.permissions || []).map((p: any) => p.code));
    setMsg('');
    setOk('');
  };
  const setMsg = (m: string) => setErr(m);
  const saveEdit = async () => {
    if (!editing) return;
    if (!window.confirm('Apply these permission changes? They take effect on the very next request for every member and are audit-logged.')) return;
    setBusy(true); setErr(''); setOk('');
    try {
      await api.patch(`/users/roles/${editing.id}/`, { permission_codes: codes });
      setOk(`Role ${editing.name} updated.`);
      setEditing(null);
      load();
    } catch (e: any) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };
  const createRole = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setOk('');
    if (!form.name.trim()) { setErr('Role name is required.'); return; }
    if (SYSTEM_ROLES.includes(form.name.trim())) { setErr('That name is reserved for a system role.'); return; }
    setBusy(true);
    try {
      await api.post('/users/roles/', { name: form.name.trim(), description: form.description, permission_codes: newCodes });
      setOk(`Role ${form.name.trim()} created.`);
      setForm({ name: '', description: '' });
      setNewCodes([]);
      setCreating(false);
      load();
    } catch (e: any) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };
  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true); setErr(''); setOk('');
    try {
      await api.delete(`/users/roles/${confirmDelete.id}/`);
      setOk(`Role ${confirmDelete.name} deleted.`);
      setConfirmDelete(null);
      load();
    } catch (e: any) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Roles & Permissions" sub="System roles are protected · custom roles carry one admin's individual set" actions={<span style={{ display: 'flex', gap: 8 }}><Button size="sm" variant="secondary" onClick={load}>Refresh</Button>{isSuper() && <Button size="sm" variant="accent" onClick={() => setCreating((v) => !v)}>New custom role</Button>}</span>} />
      <Toast msg={err} />
      {ok && <Toast msg={ok} kind="success" />}

      {creating && (
        <form onSubmit={createRole} className="jetz-card" style={{ marginBottom: 14 }}>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <Field label="Role name *" placeholder="e.g. front_desk" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Field label="Description" placeholder="What is this role for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Creating…' : 'Create role'}</Button>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="jetz-panel-title" style={{ marginBottom: 8 }}>Starting permissions</div>
            <PermissionMatrix codes={newCodes} onChange={setNewCodes} />
          </div>
        </form>
      )}

      <DataTable
        columns={['Role', 'Type', 'Members', 'Permissions', 'Actions']}
        rows={roles.map((r: any) => {
          const sys = SYSTEM_ROLES.includes(r.name);
          return [
            r.name,
            sys ? 'system' : 'custom',
            r.member_count ?? '—',
            `${(r.permissions || []).length} granted`,
            <span key={'a' + r.id} style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" onClick={() => openEdit(r)}>Permissions</Button>
              {isSuper() && !sys && <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(r)}>Delete</Button>}
            </span>,
          ];
        })}
        empty="No roles found."
      />

      {editing && (
        <Drawer title={`Permissions — ${editing.name}`} onClose={() => setEditing(null)}>
          {SYSTEM_ROLES.includes(editing.name) && (
            <p className="jetz-note">System role{editing.name === 'super_admin' ? ' — structurally omnipotent, edits here cannot lock out a Super Admin' : ' — changes affect every member instantly'}. Rename/delete are blocked.</p>
          )}
          <PermissionMatrix codes={codes} onChange={setCodes} disabled={busy} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {isSuper() && <Button variant="accent" onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>}
            <Button variant="secondary" onClick={() => setEditing(null)}>Close</Button>
          </div>
          {!isSuper() && <p className="jetz-note">Only a super admin can apply role changes.</p>}
        </Drawer>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete role ${confirmDelete.name}?`}
          message="Only empty custom roles can be deleted. Members must be moved first."
          confirmLabel="Delete role"
          danger
          busy={busy}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
