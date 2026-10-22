import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  AppHeader,
  Avatar,
  Btn,
  Card,
  Chip,
  ErrorBanner,
  Field,
  IconBubble,
  Input,
  SectionHeader,
  SkeletonCard,
  SuccessBanner,
} from '../components/ui';
import { C, S } from '../theme';
import { childName } from '../util';
import { useChildren } from '../children';
import {
  academyBrand,
  changeMyPassword,
  DEFAULT_BRAND,
  errMsg,
  mediaUrl,
  parentMe,
  updateParentMe,
  type AcademyBrand,
  type Me,
  type ParentProfile,
} from '../api';

const PREFS = [
  { k: 'whatsapp', label: 'WhatsApp' },
  { k: 'sms', label: 'SMS' },
  { k: 'email', label: 'Email' },
];

export default function ProfileScreen({
  user,
  selChildId,
  onSelectChild,
  onSupport,
  onLogout,
}: {
  user: Me;
  selChildId: number | null;
  onSelectChild: (id: number) => void;
  onSupport: () => void;
  onLogout: () => void;
}) {
  const { kids } = useChildren(selChildId, onSelectChild);
  const [profile, setProfile] = React.useState<ParentProfile | null>(null);
  const [brand, setBrand] = React.useState<AcademyBrand>(DEFAULT_BRAND);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [ok, setOk] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  // editable form state
  const [f, setF] = React.useState({
    first_name: '',
    last_name: '',
    mobile: '',
    whatsapp: '',
    email: '',
    address: '',
    emergency_contact: '',
    communication_preference: 'whatsapp',
  });

  // password change
  const [pwdOpen, setPwdOpen] = React.useState(false);
  const [oldP, setOldP] = React.useState('');
  const [newP, setNewP] = React.useState('');
  const [pwdErr, setPwdErr] = React.useState('');
  const [pwdOk, setPwdOk] = React.useState('');
  const [pwdBusy, setPwdBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setErr('');
    try {
      const [p, b] = await Promise.all([
        parentMe(),
        academyBrand().catch(() => DEFAULT_BRAND),
      ]);
      setBrand(b);
      setProfile(p);
      setF({
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        mobile: p.mobile || '',
        whatsapp: p.whatsapp || '',
        email: p.email || '',
        address: p.address || '',
        emergency_contact: p.emergency_contact || '',
        communication_preference: p.communication_preference || 'whatsapp',
      });
    } catch (e: any) {
      setErr(errMsg(e, 'Could not load your profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setErr('');
    setOk('');
    try {
      const p = await updateParentMe({
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        mobile: f.mobile.trim(),
        whatsapp: f.whatsapp.trim(),
        email: f.email.trim(),
        address: f.address.trim(),
        emergency_contact: f.emergency_contact.trim(),
        communication_preference: f.communication_preference,
      });
      setProfile(p);
      setEditing(false);
      setOk('Contact details updated.');
    } catch (e: any) {
      setErr(errMsg(e, 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
  };

  const changePwd = async () => {
    if (!oldP || !newP) {
      setPwdErr('Enter your current and new password.');
      return;
    }
    setPwdBusy(true);
    setPwdErr('');
    setPwdOk('');
    try {
      await changeMyPassword(oldP, newP);
      setPwdOk('Password updated.');
      setOldP('');
      setNewP('');
    } catch (e: any) {
      setPwdErr(errMsg(e, 'Could not change password.'));
    } finally {
      setPwdBusy(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user.username;
  const rel = profile?.relationship ? profile.relationship.charAt(0).toUpperCase() + profile.relationship.slice(1) : '';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        eyebrow="MY ACCOUNT"
        title={fullName}
        subtitle={[user.username, rel].filter(Boolean).join(' · ')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.sm }}>
          <Avatar name={fullName} size={56} ring />
          <View style={{ marginLeft: S.md, flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14.5 }}>{user.username}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12.5, marginTop: 2 }}>
              {kids.length} linked child{kids.length === 1 ? '' : 'ren'}
            </Text>
          </View>
        </View>
      </AppHeader>

      <ScrollView
        contentContainerStyle={{ padding: S.lg, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.navy]} />}
      >
        <ErrorBanner msg={err} />
        <SuccessBanner msg={ok} />
        {loading ? (
          <SkeletonCard />
        ) : (
          <>
            <SectionHeader
              title="Contact details"
              hint="Used for academy communication"
              action={
                !editing ? (
                  <Btn title="Edit" kind="secondary" onPress={() => { setEditing(true); setOk(''); }} style={{ minHeight: 40, paddingVertical: 8, paddingHorizontal: 16 }} />
                ) : undefined
              }
            />
            <Card>
              {editing ? (
                <>
                  <Field label="First name">
                    <Input value={f.first_name} onChangeText={(t) => setF({ ...f, first_name: t })} editable={!saving} />
                  </Field>
                  <Field label="Last name">
                    <Input value={f.last_name} onChangeText={(t) => setF({ ...f, last_name: t })} editable={!saving} />
                  </Field>
                  <Field label="Mobile">
                    <Input value={f.mobile} onChangeText={(t) => setF({ ...f, mobile: t })} keyboardType="phone-pad" editable={!saving} />
                  </Field>
                  <Field label="WhatsApp">
                    <Input value={f.whatsapp} onChangeText={(t) => setF({ ...f, whatsapp: t })} keyboardType="phone-pad" editable={!saving} />
                  </Field>
                  <Field label="Email">
                    <Input value={f.email} onChangeText={(t) => setF({ ...f, email: t })} keyboardType="email-address" editable={!saving} />
                  </Field>
                  <Field label="Address">
                    <Input value={f.address} onChangeText={(t) => setF({ ...f, address: t })} multiline editable={!saving} style={{ minHeight: 70, textAlignVertical: 'top' }} />
                  </Field>
                  <Field label="Emergency contact">
                    <Input value={f.emergency_contact} onChangeText={(t) => setF({ ...f, emergency_contact: t })} editable={!saving} />
                  </Field>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: C.text, marginBottom: 8, letterSpacing: 0.6 }}>PREFERRED CHANNEL</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: S.md }}>
                    {PREFS.map((p) => (
                      <Chip
                        key={p.k}
                        label={p.label}
                        active={f.communication_preference === p.k}
                        onPress={() => setF({ ...f, communication_preference: p.k })}
                      />
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                    <View style={{ flex: 1 }}>
                      <Btn title="Cancel" kind="secondary" onPress={() => { setEditing(false); load(); }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn title="Save" kind="accent" onPress={save} loading={saving} />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Row label="First name" value={profile?.first_name} />
                  <Row label="Last name" value={profile?.last_name} />
                  <Row label="Relationship" value={rel} />
                  <Row label="Mobile" value={profile?.mobile} />
                  <Row label="WhatsApp" value={profile?.whatsapp} />
                  <Row label="Email" value={profile?.email} />
                  <Row label="Address" value={profile?.address} />
                  <Row label="Emergency contact" value={profile?.emergency_contact} />
                  <Row label="Preferred channel" value={profile?.communication_preference} />
                </>
              )}
            </Card>

            <SectionHeader title="My children" hint="Linked athletes" />
            {kids.length === 0 ? (
              <Card><Text style={{ color: C.sub, fontSize: 13.5 }}>No children linked to this account yet.</Text></Card>
            ) : (
              <Card>
                {kids.map((k, i) => (
                  <View key={k.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.line }}>
                    <Avatar name={childName(k)} size={38} uri={mediaUrl(k.photo)} />
                    <View style={{ flex: 1, marginLeft: S.md }}>
                      <Text style={{ fontWeight: '800', color: C.text, fontSize: 14 }}>{childName(k)}</Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 1 }}>
                        {k.student_id}{k.sport_name ? ` · ${k.sport_name}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            <SectionHeader title="Security" hint="Keep your account safe" />
            <Card>
              {pwdOpen ? (
                <>
                  <ErrorBanner msg={pwdErr} />
                  <SuccessBanner msg={pwdOk} />
                  <Field label="Current password">
                    <Input value={oldP} onChangeText={(t) => { setOldP(t); setPwdErr(''); }} secureTextEntry editable={!pwdBusy} />
                  </Field>
                  <Field label="New password">
                    <Input value={newP} onChangeText={(t) => { setNewP(t); setPwdErr(''); }} secureTextEntry editable={!pwdBusy} />
                  </Field>
                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                    <View style={{ flex: 1 }}>
                      <Btn title="Cancel" kind="secondary" onPress={() => { setPwdOpen(false); setPwdErr(''); setPwdOk(''); }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn title="Update" kind="primary" onPress={changePwd} loading={pwdBusy} />
                    </View>
                  </View>
                </>
              ) : (
                <Btn title="Change password" kind="secondary" onPress={() => setPwdOpen(true)} />
              )}
            </Card>

            <SectionHeader title="Academy" hint="Contact your academy" />
            <Card>
              {brand.phone ? <Row label="Phone" value={brand.phone} /> : null}
              {brand.email ? <Row label="Email" value={brand.email} /> : null}
              {brand.address ? <Row label="Address" value={brand.address} /> : null}
              {brand.timings ? <Row label="Training hours" value={brand.timings} /> : null}
              {!brand.phone && !brand.email && !brand.address && !brand.timings ? (
                <Text style={{ color: C.sub, fontSize: 13.5 }}>
                  Contact details appear here once your academy adds them in Settings.
                </Text>
              ) : null}
            </Card>

            <SectionHeader title="Support" hint="We are here to help" />
            <Card>
              <Btn title="Help & Support tickets" kind="primary" onPress={onSupport} />
            </Card>

            <View style={{ marginTop: S.xl }}>
              <Btn title="Log out" kind="danger" onPress={onLogout} />
            </View>
            <Text style={{ textAlign: 'center', color: C.faint, fontSize: 11.5, marginTop: S.md }}>
              {user.username} · Parent access · v1.0.0
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 }}>
      <Text style={{ color: C.sub, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', flexShrink: 1, textAlign: 'right', marginLeft: 12 }}>
        {value && value.length ? value : '—'}
      </Text>
    </View>
  );
}
