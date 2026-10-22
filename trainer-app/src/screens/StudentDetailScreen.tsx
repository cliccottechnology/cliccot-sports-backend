import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { enrollReference, errMsg, mediaUrl, type RefPhoto } from '../api';
import { AppHeader, Avatar, Btn, Card, ErrorBanner, Field, IconBubble, Input, Sub, SuccessBanner } from '../components/ui';
import { pickPhotoWeb } from '../pickWeb';
import type { StudentEntry } from '../coach';
import { C, R, S } from '../theme';

export default function StudentDetailScreen({
  student,
  onBack,
  onChanged,
}: {
  student: StudentEntry;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [by, setBy] = useState('');
  const [angle, setAngle] = useState('front');
  const [consent, setConsent] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [saved, setSaved] = useState<RefPhoto | null>(null);

  const currentUri = saved?.image ? mediaUrl(saved.image) : mediaUrl(student.refImage);
  const enrolled = !!(currentUri || student.hasRef);

  const pick = async (cam: boolean) => {
    setErr('');
    if (Platform.OS === 'web') {
      const p = await pickPhotoWeb(cam);
      if (p?.uri) {
        setUri(p.uri);
        setSheet(false);
        setOk('');
      }
      return;
    }
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
    if (!res.canceled && res.assets?.[0]?.uri) {
      setUri(res.assets[0].uri);
      setSheet(false);
      setOk('');
    }
  };

  const enroll = async () => {
    if (!uri) return;
    if (!consent) {
      setErr('Consent is required to enroll a reference photo.');
      return;
    }
    if (!by.trim()) {
      setErr('Enter who gave consent (parent/guardian name).');
      return;
    }
    setBusy(true);
    setErr('');
    setOk('');
    try {
      const photo = await enrollReference(student.student, uri, by.trim(), 'reference.jpg', angle);
      setSaved(photo);
      setUri(null);
      setOk(`Reference photo (${angle}) enrolled. Add more angles so AI detects ${student.name.split(' ')[0]} easily.`);
      onChanged();
    } catch (e) {
      setErr(errMsg(e, 'Upload failed. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        onBack={onBack}
        eyebrow="ATHLETE PROFILE"
        title={student.name}
        subtitle={`${student.student_id || `#${student.student}`}${student.sport ? ` · ${student.sport}` : ''}${student.batch ? ` · ${student.batch}` : ''}`}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 40 }}>
        <ErrorBanner msg={err} />
        <SuccessBanner msg={ok} />

        <Card style={{ alignItems: 'center', paddingVertical: S.xl }}>
          {currentUri ? (
            <Image source={{ uri: currentUri }} style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: C.line, borderWidth: 3, borderColor: '#fff' }} />
          ) : (
            <Avatar name={student.name} size={110} />
          )}
          <View
            style={{
              marginTop: S.md,
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: enrolled ? C.greenSoft : C.greyBg,
              borderWidth: 1,
              borderColor: enrolled ? C.greenBd : C.greyBd,
            }}
          >
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: enrolled ? C.green : C.greyFg, letterSpacing: 0.6 }}>
              {enrolled
                ? `✓ AI-READY${student.refCount ? ` · ${student.refCount}/5 PHOTOS` : ''}`
                : '○ NO REFERENCE PHOTO'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: S.md }}>
            {['front', 'left', 'right'].map((a, i) => (
              <View key={a} style={{ backgroundColor: C.navyTint, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: C.navy }}>{['Front', 'Left', 'Right'][i]} {i === 0 ? '✓' : '○'}</Text>
              </View>
            ))}
          </View>
          <Sub style={{ textAlign: 'center', marginTop: S.sm, lineHeight: 19 }}>
            Enroll 2+ photos from different angles so AI matching detects this athlete easily. Adding a photo never removes existing ones.
          </Sub>
        </Card>

        <Card style={{ marginTop: S.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
            <IconBubble glyph={uri ? '✓' : '▣'} bg={uri ? C.greenSoft : C.navySoft} fg={uri ? C.green : C.navy} size={40} />
            <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15.5, marginLeft: S.md, flex: 1 }}>
              {uri ? 'Review & consent' : 'Enroll reference photo'}
            </Text>
          </View>
          {uri ? (
            <Image source={{ uri }} style={{ width: '100%', height: 250, borderRadius: R.btn, backgroundColor: C.line, marginBottom: S.md }} />
          ) : null}
          {!uri ? (
            <>
              <Btn title="▣  Take / Upload Photo" onPress={() => setSheet(true)} />
              {sheet ? (
                <View style={{ marginTop: S.md, backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: S.md, borderWidth: 1, borderColor: C.line }}>
                  <Pressable onPress={() => pick(true)} style={row}>
                    <Text style={rowTx}>▣  Camera — capture face photo</Text>
                    <Text style={{ color: C.faint, fontWeight: '900' }}>›</Text>
                  </Pressable>
                  <Pressable onPress={() => pick(false)} style={row}>
                    <Text style={rowTx}>▤  Photo Library — choose existing</Text>
                    <Text style={{ color: C.faint, fontWeight: '900' }}>›</Text>
                  </Pressable>
                  <Pressable onPress={() => setSheet(false)} style={[row, { borderBottomWidth: 0 }]}>
                    <Text style={[rowTx, { color: C.sub }]}>Cancel</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Field label="PHOTO ANGLE">
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {['front', 'left', 'right', 'other'].map((a) => (
                    <Pressable
                      key={a}
                      onPress={() => setAngle(a)}
                      style={{
                        paddingVertical: 9,
                        paddingHorizontal: 16,
                        borderRadius: 999,
                        backgroundColor: angle === a ? C.navy : C.greyBg,
                        borderWidth: 1.5,
                        borderColor: angle === a ? C.navy : 'transparent',
                      }}
                    >
                      <Text style={{ color: angle === a ? '#fff' : C.text, fontWeight: '800', fontSize: 13 }}>{a[0].toUpperCase() + a.slice(1)}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
              <Field label="CONSENTED BY (PARENT / GUARDIAN)">
                <Input value={by} onChangeText={(t) => { setBy(t); setErr(''); }} placeholder="Full name of consenting adult" />
              </Field>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md, backgroundColor: C.greenSoft, borderRadius: 12, padding: S.md, borderWidth: 1, borderColor: C.greenBd }}>
                <Switch value={consent} onValueChange={setConsent} trackColor={{ true: C.green, false: C.greyBd }} />
                <Text style={{ marginLeft: 10, color: C.text, fontWeight: '600', fontSize: 13, flex: 1, lineHeight: 18 }}>
                  Consent recorded for AI attendance matching
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <View style={{ flex: 1 }}>
                  <Btn title="Retake" kind="secondary" onPress={() => setSheet(true)} />
                </View>
                <View style={{ flex: 1.4 }}>
                  <Btn title="Enroll Photo" kind="accent" onPress={enroll} loading={busy} />
                </View>
              </View>
            </>
          )}
        </Card>
        <Sub style={{ marginTop: S.md, textAlign: 'center', lineHeight: 18 }}>
          Photos are access-controlled and used only for attendance verification. Enrollment requires recorded consent.
        </Sub>
      </ScrollView>
    </View>
  );
}

const row = { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const };
const rowTx = { fontSize: 14.5, fontWeight: '700' as const, color: '#102A56' };
