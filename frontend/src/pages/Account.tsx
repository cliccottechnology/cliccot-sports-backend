import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button, DetailRows, Field, PageHeader, Section, Toast } from '../components/ui';

/** Self-service password change. Clears the first-login flag on the backend. */
export function ChangePasswordCard({ compact = false }: { compact?: boolean }) {
  const [oldP, setOldP] = useState('');
  const [newP, setNewP] = useState('');
  const [confirmP, setConfirmP] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setOk('');
    if (!oldP || !newP) { setErr('All fields are required.'); return; }
    if (newP.length < 8) { setErr('New password must be at least 8 characters.'); return; }
    if (newP !== confirmP) { setErr('New password and confirmation do not match.'); return; }
    if (newP === oldP) { setErr('New password must differ from the current password.'); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-password/', { old_password: oldP, new_password: newP });
      setOk('Password changed successfully.');
      setOldP(''); setNewP(''); setConfirmP('');
    } catch (e: any) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="jetz-card" style={{ margin: 0 }}>
      {!compact && (
        <>
          <div className="jetz-panel-title">Change password</div>
          <div className="jetz-panel-sub">Use at least 8 characters. Avoid your username or an easily guessed phrase.</div>
        </>
      )}
      <Toast msg={err} kind="danger" />
      {ok && <Toast msg={ok} kind="success" />}
      <div className="jetz-form-card" style={{ marginBottom: 0 }}>
        <Field label="Current password *" type="password" autoComplete="current-password" value={oldP} onChange={(e) => setOldP(e.target.value)} />
        <Field label="New password *" type="password" autoComplete="new-password" value={newP} onChange={(e) => setNewP(e.target.value)} hint="Minimum 8 characters" />
        <Field label="Confirm new password *" type="password" autoComplete="new-password" value={confirmP} onChange={(e) => setConfirmP(e.target.value)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <Button type="submit" variant="accent" disabled={busy}>
          <KeyRound style={{ width: 14, height: 14 }} /> {busy ? 'Saving…' : 'Update password'}
        </Button>
      </div>
    </form>
  );
}

export function Account() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader
        eyebrow="JETZ Academy / My Account"
        title="My Account"
        sub="Your profile and password. Password changes take effect immediately across all devices."
      />
      <Section title="Profile" sub="">
        <DetailRows
          rows={[
            ['Username', user?.username || '—'],
            ['Role', user?.role_name || 'Administrator'],
            ['Email', user?.email || '—'],
            ['School', user?.school_name || '—'],
          ]}
        />
      </Section>
      <Section title="Security" sub="Update the password you use to sign in.">
        <ChangePasswordCard />
      </Section>
    </div>
  );
}
