import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { academyBrand, API_BASE, DEFAULT_BRAND, type AcademyBrand, errMsg, health, login, setTokens } from '../api';
import { Btn, ErrorBanner } from '../components/ui';
import { C, S, shadowLg, shadowSm } from '../theme';

export default function LoginScreen({ onDone }: { onDone: (user: any) => void }) {
  const [u, setU] = useState('coach1');
  const [p, setP] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [online, setOnline] = useState<boolean | null>(null);
  const [brand, setBrand] = useState<AcademyBrand>(DEFAULT_BRAND);
  const brandName = brand.name.trim();
  const brandTag = brand.tagline.trim();

  React.useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const ok = await health();
      if (!active) return;
      setOnline(ok);
      if (!ok) timer = setTimeout(check, 5000);
    };
    check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  React.useEffect(() => {
    academyBrand().then(setBrand).catch(() => {});
  }, []);

  const submit = async () => {
    if (!u.trim() || !p) {
      setErr('Enter your username and password to continue.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const data = await login(u.trim(), p);
      setTokens(data.access || '', data.refresh || '');
      onDone(data.user);
    } catch (e) {
      const st = (e as any)?.response?.status;
      setErr(st === 401 ? 'Invalid username or password. Please try again.' : errMsg(e, 'Login failed. Check your connection and retry.'));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    try {
      const { api } = await import('../api');
      const { data } = await api.post('/auth/password-reset/', {});
      setInfo(data?.detail || 'Password resets are handled by your academy administrator.');
    } catch (e) {
      setInfo(errMsg(e, 'Password resets are handled by your academy administrator.'));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.navyDeep }}>
      {/* premium hero */}
      <View style={{ paddingTop: 64, paddingHorizontal: S.xl, paddingBottom: 26, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -90, top: -110, backgroundColor: 'rgba(255,107,44,0.30)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, left: -80, bottom: -140, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', ...shadowLg }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 28 }}>{(brandName.charAt(0) || '★').toUpperCase()}</Text>
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            {brandName ? (
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 19, letterSpacing: 1.2 }} numberOfLines={1}>{brandName.toUpperCase()}</Text>
            ) : null}
            {brandTag ? (
              <Text style={{ color: 'rgba(255,255,255,0.72)', fontWeight: '700', fontSize: 11, letterSpacing: 1.6 }} numberOfLines={1}>{brandTag.toUpperCase()}</Text>
            ) : null}
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginRight: 7, backgroundColor: online === null ? 'rgba(255,255,255,0.5)' : online ? '#22C55E' : '#F87171' }} />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>{online === null ? 'CHECKING…' : online ? 'ONLINE' : 'OFFLINE'}</Text>
          </View>
        </View>
        <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -0.6, marginTop: 22 }}>Coach Login</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 6, lineHeight: 20 }}>
          Your training day, athletes and attendance — in one premium workspace.
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          {['Sessions', 'Attendance', 'Reports'].map((t) => (
            <View key={t} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>✓ {t}</Text>
            </View>
          ))}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: S.xl, paddingBottom: 28, marginTop: -6 }}
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
        >
          <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 14 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line }} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.navy }}>Welcome back, Coach</Text>
          <Text style={{ fontSize: 13.5, color: C.sub, marginTop: 3, marginBottom: S.lg }}>Sign in with your academy account to continue.</Text>

          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: S.lg, borderWidth: 1, borderColor: C.line, ...shadowSm }}>
            <ErrorBanner msg={err} />
            {info ? (
              <View style={{ backgroundColor: C.navySoft, borderWidth: 1, borderColor: '#BFD0EA', borderRadius: 12, padding: S.md, marginBottom: S.md }}>
                <Text style={{ color: C.navy, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>{info}</Text>
              </View>
            ) : null}
            <Text style={styles.cap}>USERNAME</Text>
            <View style={styles.box}>
              <Text style={styles.ico}>@</Text>
              <LoginInput
                value={u}
                onChangeText={(t: string) => { setU(t); setErr(''); }}
                placeholder="coach1"
                editable={!busy}
              />
            </View>
            <Text style={[styles.cap, { marginTop: S.md }]}>PASSWORD</Text>
            <View style={styles.box}>
              <Text style={styles.ico}>•••</Text>
              <LoginInput
                value={p}
                onChangeText={(t: string) => { setP(t); setErr(''); }}
                placeholder="Enter password"
                secureTextEntry={!show}
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={submit}
              />
              <Pressable onPress={() => setShow((s) => !s)} accessibilityRole="button" style={{ padding: 8, backgroundColor: C.navyTint, borderRadius: 8 }}>
                <Text style={{ color: C.navy, fontWeight: '800', fontSize: 12 }}>{show ? 'HIDE' : 'SHOW'}</Text>
              </Pressable>
            </View>
            <Pressable onPress={forgot} style={{ alignSelf: 'flex-end', marginTop: S.sm, padding: 4 }}>
              <Text style={{ color: C.navy, fontWeight: '700', fontSize: 13 }}>Forgot password?</Text>
            </Pressable>
            <View style={{ height: S.md }} />
            <Btn title={busy ? 'Signing in…' : 'Sign In Securely'} onPress={submit} loading={busy} kind="accent" />
            <Text style={{ textAlign: 'center', color: C.faint, fontSize: 12, marginTop: 10 }}>Protected by academy access controls</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: S.lg }}>
            {online === null ? (
              <ActivityIndicator size="small" color={C.faint} />
            ) : (
              <Text style={{ fontSize: 12.5, color: C.sub, fontWeight: '600' }}>
                {online ? '●  Backend connected — ready to sync' : '●  Backend unreachable — check network'}
              </Text>
            )}
          </View>
          <Text style={{ marginTop: 8, fontSize: 11, color: C.faint, textAlign: 'center' }}>{API_BASE}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function LoginInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={C.faint}
      autoCapitalize="none"
      autoCorrect={false}
      style={[styles.inline]}
      {...props}
    />
  );
}

const styles = {
  cap: { fontSize: 11, fontWeight: '800' as const, color: C.faint, letterSpacing: 1.4, marginBottom: 7 },
  box: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#F6F9FD',
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  ico: { color: C.sub, fontWeight: '800' as const, fontSize: 14, marginRight: 9 },
  inline: { flex: 1, backgroundColor: 'transparent', borderWidth: 0, paddingVertical: 14, paddingHorizontal: 0, fontSize: 15, color: C.text },
};
