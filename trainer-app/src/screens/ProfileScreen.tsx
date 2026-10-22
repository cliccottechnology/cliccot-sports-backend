import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { academyBrand, API_BASE, coachMe, DEFAULT_BRAND, mediaUrl, myCertificates, myCheckins, setMyOffDays, updateMyProfile, uploadMyPhoto, type AcademyBrand, type Certificate, type CheckIn, type CoachMe, type Me } from '../api';
import { loadCoachData, type CoachData } from '../coach';
import { AppHeader, Avatar, Btn, Card, ErrorBanner, Field, IconBubble, Input, SectionHeader, SuccessBanner } from '../components/ui';
import { C, S } from '../theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ProfileScreen({ user, onLogout, onProfileSaved }: { user: Me; onLogout: () => void; onProfileSaved?: (u: Partial<Me>) => void }) {
  const [coach, setCoach] = useState<CoachMe | null>(null);
  const [data, setData] = useState<CoachData | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [pick, setPick] = useState<number[]>([]);
  const [editingOffs, setEditingOffs] = useState(false);
  const [savingOffs, setSavingOffs] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [fFirst, setFFirst] = useState('');
  const [fLast, setFLast] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [brand, setBrand] = useState<AcademyBrand>(DEFAULT_BRAND);

  const refreshCoach = async () => {
    try {
      const c = await coachMe();
      setCoach(c);
      return c;
    } catch {
      setCoach(null);
      return null;
    }
  };

  React.useEffect(() => {
    refreshCoach();
    academyBrand().then(setBrand).catch(() => {});
    myCertificates().then(setCerts).catch(() => {});
    myCheckins().then(setCheckins).catch(() => setCheckins([]));
    loadCoachData()
      .then(setData)
      .catch((e: any) => setErr(e?.response?.data?.message || e?.message || "Couldn't load profile data."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    [coach?.first_name, coach?.last_name].filter(Boolean).join(' ') || user.username;
  const sports = [...new Set((data?.my || []).map((s) => s.sport_name).filter(Boolean))];
  const batches = [...new Set((data?.my || []).map((s) => s.batch_name).filter(Boolean))];
  const offs = (coach?.weekly_off_days || []).map((d) => DAYS[d] || `Day ${d}`).join(', ') || '—';
  const active = coach ? coach.is_active !== false : true;

  const togglePick = (d: number) =>
    setPick((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].slice(-2)));

  const startEditProfile = () => {
    setFFirst(coach?.first_name || user.first_name || '');
    setFLast(coach?.last_name || user.last_name || '');
    setFPhone(coach?.phone || '');
    setFEmail(coach?.email || user.email || '');
    setErr('');
    setOk('');
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    const phone = fPhone.trim();
    const email = fEmail.trim();
    if (!fFirst.trim()) {
      setErr('First name is required.');
      return;
    }
    if (phone && !/^[+\d][\d\s-]{5,}$/.test(phone)) {
      setErr('Enter a valid phone number.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('Enter a valid email address.');
      return;
    }
    setSavingProfile(true);
    setErr('');
    setOk('');
    try {
      const res = await updateMyProfile({ first_name: fFirst.trim(), last_name: fLast.trim(), phone, email });
      setCoach(res.coach);
      onProfileSaved?.(res.user);
      const changed = Object.keys(res.changed || {});
      setOk(changed.length ? `Profile updated (${changed.join(', ')}).` : 'No changes — profile already up to date.');
      setEditingProfile(false);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Couldn't save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const pickPhoto = async (cam: boolean) => {
    setErr('');
    setOk('');
    const perm = cam
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErr('Permission required. Enable it in system settings and retry.');
      return;
    }
    const res = cam
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    const picked = !res.canceled ? res.assets?.[0]?.uri : undefined;
    setPhotoSheet(false);
    if (!picked) return;
    setUploadingPhoto(true);
    try {
      const updated = await uploadMyPhoto(picked);
      setCoach(updated);
      setOk('Profile photo updated.');
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Couldn't upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveOffs = async () => {
    if (pick.length !== 2) {
      setErr('Pick exactly two week-off days — any days you prefer.');
      return;
    }
    setSavingOffs(true);
    setErr('');
    setOk('');
    try {
      const updated = await setMyOffDays([...pick].sort((a, b) => a - b));
      setCoach(updated);
      setOk(`Week-offs set to ${FULL_DAYS[pick[0]]} & ${FULL_DAYS[pick[1]]}.`);
      setEditingOffs(false);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Couldn't save week-offs.");
    } finally {
      setSavingOffs(false);
    }
  };

  const rows: { glyph: string; k: string; v: string }[] = [
    { glyph: '@', k: 'Username', v: user.username },
    { glyph: '#', k: 'Trainer ID', v: coach?.trainer_id || '—' },
    { glyph: '★', k: 'Role', v: user.role_name || 'Coach' },
    { glyph: '☎', k: 'Phone', v: coach?.phone || '—' },
    { glyph: '✉', k: 'Email', v: coach?.email || user.email || '—' },
    { glyph: '⚡', k: 'Sports', v: coach?.sports?.length ? coach.sports.join(', ') : sports.join(', ') || '—' },
    { glyph: '◷', k: 'Weekly off-days', v: offs },
    { glyph: '▤', k: 'My batches', v: batches.length ? batches.join(', ') : '—' },
    { glyph: '◉', k: 'My athletes', v: String(data?.students.length ?? '—') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader eyebrow="COACH ACCOUNT" title="My Profile" subtitle="Your identity across the academy" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 30 }}>
        <ErrorBanner msg={err} />
        <SuccessBanner msg={ok} />
        <Card style={{ alignItems: 'center', paddingVertical: S.xl }}>
          <Pressable onPress={() => setPhotoSheet(true)} accessibilityRole="button" accessibilityLabel="Change profile photo">
            <Avatar name={name} size={84} ring uri={mediaUrl(coach?.photo)} />
            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: C.accent, borderRadius: 999, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{uploadingPhoto ? '…' : '✎'}</Text>
            </View>
          </Pressable>
          <Text style={{ fontSize: 21, fontWeight: '800', color: C.navy, marginTop: S.md, letterSpacing: -0.3 }}>{name}</Text>
          <Text style={{ color: C.sub, fontSize: 13, marginTop: 3 }}>{brand.name} · Coach</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: active ? C.greenSoft : C.greyBg, borderWidth: 1, borderColor: active ? C.greenBd : C.greyBd, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? C.green : C.greyFg, marginRight: 7 }} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: active ? C.green : C.greyFg }}>{active ? 'ACTIVE COACH' : 'INACTIVE'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md, width: '100%' }}>
            <View style={{ flex: 1, backgroundColor: C.navyTint, borderRadius: 14, padding: S.md, alignItems: 'center', borderWidth: 1, borderColor: C.line }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: C.navy }}>{data?.students.length ?? '—'}</Text>
              <Text style={{ fontSize: 11.5, color: C.sub, fontWeight: '700' }}>Athletes</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.navyTint, borderRadius: 14, padding: S.md, alignItems: 'center', borderWidth: 1, borderColor: C.line }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: C.navy }}>{batches.length || '—'}</Text>
              <Text style={{ fontSize: 11.5, color: C.sub, fontWeight: '700' }}>Batches</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.navyTint, borderRadius: 14, padding: S.md, alignItems: 'center', borderWidth: 1, borderColor: C.line }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: C.navy }}>{sports.length || '—'}</Text>
              <Text style={{ fontSize: 11.5, color: C.sub, fontWeight: '700' }}>Sports</Text>
            </View>
          </View>
        </Card>

        {photoSheet ? (
          <Card style={{ marginTop: S.md }}>
            <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15, marginBottom: S.sm }}>Profile photo</Text>
            <Btn title="Take photo" onPress={() => pickPhoto(true)} />
            <View style={{ height: S.sm }} />
            <Btn title="Choose from library" kind="secondary" onPress={() => pickPhoto(false)} />
            <View style={{ height: S.sm }} />
            <Btn title="Cancel" kind="ghost" onPress={() => setPhotoSheet(false)} />
          </Card>
        ) : null}

        <SectionHeader title="My week-offs" hint="Pick any two days — not fixed to Sat/Sun" />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconBubble glyph="◷" size={40} />
            <View style={{ flex: 1, marginLeft: S.md }}>
              <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15 }}>Current: {offs}</Text>
              <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>Sessions avoid these days when assigning you.</Text>
            </View>
          </View>
          {!editingOffs ? (
            <View style={{ marginTop: S.md }}>
              <Btn
                title="Choose my week-offs"
                kind="secondary"
                onPress={() => { setPick([...(coach?.weekly_off_days || [])]); setErr(''); setOk(''); setEditingOffs(true); }}
              />
            </View>
          ) : (
            <View style={{ marginTop: S.md }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.faint, letterSpacing: 0.8, marginBottom: 8 }}>
                PICK EXACTLY 2 · {pick.length}/2 SELECTED
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {DAYS.map((d, i) => {
                  const isActive = pick.includes(i);
                  return (
                    <Pressable
                      key={d}
                      onPress={() => togglePick(i)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isActive }}
                      accessibilityLabel={`${FULL_DAYS[i]} ${isActive ? 'selected' : ''}`}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 0,
                        width: 56,
                        borderRadius: 11,
                        alignItems: 'center',
                        backgroundColor: isActive ? C.navy : C.greyBg,
                        borderWidth: 1.5,
                        borderColor: isActive ? C.navy : 'transparent',
                      }}
                    >
                      <Text style={{ color: isActive ? '#fff' : C.text, fontWeight: '800', fontSize: 12.5 }}>{d}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md }}>
                <View style={{ flex: 1 }}>
                  <Btn title="Cancel" kind="ghost" onPress={() => setEditingOffs(false)} />
                </View>
                <View style={{ flex: 1.5 }}>
                  <Btn title={savingOffs ? 'Saving…' : 'Save week-offs'} kind="accent" onPress={saveOffs} loading={savingOffs} disabled={pick.length !== 2} />
                </View>
              </View>
            </View>
          )}
        </Card>

        <SectionHeader title="My certificates" hint="Issued by the institute for your completed work" />
        {certs.length === 0 ? (
          <Card><Text style={{ color: C.sub, fontSize: 13.5, textAlign: 'center' }}>No certificates yet — they appear here when issued.</Text></Card>
        ) : (
          certs.map((ct) => (
            <Card key={ct.id} style={{ marginBottom: S.sm, padding: S.md, flexDirection: 'row', alignItems: 'center' }}>
              <IconBubble glyph="★" bg={C.goldSoft} fg={C.amber} size={44} />
              <View style={{ flex: 1, marginLeft: S.md }}>
                <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5 }} numberOfLines={1}>{ct.title}</Text>
                <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                  {ct.period_from} → {ct.period_to} · {ct.sessions_completed} sessions
                </Text>
              </View>
            </Card>
          ))
        )}

        <SectionHeader title="Details" hint="Synced from your academy record" />
        {!editingProfile ? (
          <View style={{ marginBottom: S.sm }}>
            <Btn title="Edit profile" kind="secondary" onPress={startEditProfile} />
          </View>
        ) : (
          <Card style={{ marginBottom: S.sm }}>
            <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15, marginBottom: S.sm }}>
              Edit contact details
            </Text>
            <Text style={{ color: C.sub, fontSize: 12.5, marginBottom: S.md }}>
              Name, phone and email only. Trainer ID, sports and batches are managed by the academy.
            </Text>
            <Field label="First name">
              <Input value={fFirst} onChangeText={(t) => { setFFirst(t); setErr(''); }} placeholder="First name" />
            </Field>
            <Field label="Last name">
              <Input value={fLast} onChangeText={(t) => { setFLast(t); setErr(''); }} placeholder="Last name" />
            </Field>
            <Field label="Phone">
              <Input value={fPhone} onChangeText={(t) => { setFPhone(t); setErr(''); }} placeholder="+91 …" keyboardType="phone-pad" />
            </Field>
            <Field label="Email">
              <Input value={fEmail} onChangeText={(t) => { setFEmail(t); setErr(''); }} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" />
            </Field>
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md }}>
              <View style={{ flex: 1 }}>
                <Btn title="Cancel" kind="ghost" onPress={() => setEditingProfile(false)} />
              </View>
              <View style={{ flex: 1.5 }}>
                <Btn title={savingProfile ? 'Saving…' : 'Save changes'} kind="accent" onPress={saveProfile} loading={savingProfile} />
              </View>
            </View>
          </Card>
        )}
        <Card style={{ paddingVertical: S.sm, paddingHorizontal: S.lg }}>
          {rows.map((r, i) => (
            <View key={r.k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: C.line }}>
              <IconBubble glyph={r.glyph} size={34} />
              <Text style={{ flex: 1, color: C.sub, fontWeight: '600', fontSize: 13.5, marginLeft: S.md }}>{r.k}</Text>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 13.5, flex: 1.4, textAlign: 'right' }} numberOfLines={2}>{r.v}</Text>
            </View>
          ))}
          <Text style={{ color: C.faint, fontSize: 11.5, marginTop: S.sm, marginBottom: 4 }}>{API_BASE}</Text>
        </Card>

        <SectionHeader title="My check-ins" hint="Your own session attendance" />
        <Card style={{ paddingVertical: S.sm, paddingHorizontal: S.lg }}>
          {checkins.length === 0 ? (
            <Text style={{ color: C.sub, fontSize: 13.5, paddingVertical: 6 }}>
              No check-ins yet — tap CHECK IN on today's sessions.
            </Text>
          ) : (
            checkins.slice(0, 10).map((c, i) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i === Math.min(checkins.length, 10) - 1 ? 0 : 1, borderBottomColor: C.line }}>
                <IconBubble glyph="✓" bg={C.greenSoft} fg={C.green} size={34} />
                <View style={{ flex: 1, marginLeft: S.md }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 13.5 }} numberOfLines={1}>
                    {c.batch_name || `Session ${c.session}`}
                  </Text>
                  <Text style={{ color: C.sub, fontSize: 12.5 }}>
                    {(c.session_date || '') + (c.marked_at ? ` · ${c.marked_at.slice(11, 16)}` : '')} · {c.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>

        <View style={{ height: S.md }} />
        <Btn title="Log Out" kind="danger" onPress={onLogout} />
        <Text style={{ textAlign: 'center', color: C.faint, fontSize: 12, marginTop: 10 }}>Signed in as {user.username}</Text>
      </ScrollView>
    </View>
  );
}
