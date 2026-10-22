import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { changeMyPassword, errMsg } from '../api';
import { Btn, Card, ErrorBanner, Field, H1, Input, Sub } from './ui';
import { C, S } from '../theme';

/** Blocks the whole app until a temporary password is replaced. */
export default function ForcePasswordChange({ onDone, onLogout }: { onDone: () => void; onLogout: () => void }) {
  const [oldP, setOldP] = useState('');
  const [newP, setNewP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!oldP || !newP) {
      setErr('Enter your temporary password and choose a new one.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await changeMyPassword(oldP, newP);
      onDone();
    } catch (e) {
      setErr(errMsg(e, 'Could not change password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.navyDeep, justifyContent: 'center', padding: S.xl }}>
      <H1 style={{ color: '#fff' }}>Set a new password</H1>
      <Sub style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4, marginBottom: S.lg }}>
        Your administrator issued a temporary password. Choose your own (min 8 characters) to continue.
      </Sub>
      <Card>
        <ErrorBanner msg={err} />
        <Field label="Temporary password">
          <Input value={oldP} onChangeText={(t) => { setOldP(t); setErr(''); }} placeholder="Issued password" secureTextEntry editable={!busy} />
        </Field>
        <Field label="New password">
          <Input value={newP} onChangeText={(t) => { setNewP(t); setErr(''); }} placeholder="Min 8 characters" secureTextEntry editable={!busy} onSubmitEditing={submit} />
        </Field>
        <Btn title="Set password & continue" kind="accent" onPress={submit} loading={busy} />
        <View style={{ height: S.sm }} />
        <Btn title="Log out" kind="ghost" onPress={onLogout} />
      </Card>
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center', marginTop: S.md }}>
        You cannot use the app until this is done.
      </Text>
    </View>
  );
}
