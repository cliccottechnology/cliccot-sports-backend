import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { photoAnalyze, roster, type Analysis, type SessionItem } from '../api';
import { pickPhotoWeb } from '../pickWeb';
import { AppHeader, Btn, Card, ErrorBanner, IconBubble, Sub } from '../components/ui';
import WebCamera from '../components/WebCamera';
import { C, R, S, fmtDate, fmtTime, shadowSm } from '../theme';

const TIPS = [
  { glyph: '☀', title: 'Face good light', hint: 'Avoid harsh backlight behind the group.' },
  { glyph: '◉', title: 'Fit everyone in', hint: 'One wide frame with all athletes visible.' },
  { glyph: '◎', title: 'Hold steady', hint: 'Keep faces clear, uncovered and in focus.' },
];

const sheetRow = {
  paddingVertical: 16,
  borderBottomWidth: 1,
  borderBottomColor: '#E3EAF3',
} as const;

export default function PhotoScreen({
  session,
  onBack,
  onAnalyzed,
}: {
  session: SessionItem;
  onBack: () => void;
  onAnalyzed: (a: Analysis, uri: string) => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [liveCam, setLiveCam] = useState(false);
  const [phase, setPhase] = useState<'intro' | 'sheet' | 'preview'>('intro');

  React.useEffect(() => {
    roster(String(session.id))
      .then((r) => setCount(r.length))
      .catch(() => setCount(0));
  }, [session.id]);

  const useAsset = (u?: string) => {
    if (u) {
      setUri(u);
      setPhase('preview');
    }
  };

  const openCamera = async () => {
    setErr('');
    if (Platform.OS === 'web') {
      // Live in-browser camera (PC webcam / phone browser). The old file
      // picker path could never show a live view on desktop.
      setLiveCam(true);
      return;
    }
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) {
      setErr('Camera permission is required. Enable it in system settings and retry.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (!res.canceled) useAsset(res.assets?.[0]?.uri);
  };

  const openLibrary = async () => {
    setErr('');
    if (Platform.OS === 'web') {
      const p = await pickPhotoWeb(false);
      if (p) useAsset(p.uri);
      return;
    }
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!lib.granted) {
      setErr('Photo library permission is required to upload a group photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: false });
    if (!res.canceled) useAsset(res.assets?.[0]?.uri);
  };

  const analyze = async () => {
    if (!uri) return;
    setBusy(true);
    setErr('');
    try {
      const data = await photoAnalyze(session.id, uri);
      onAnalyzed(data, uri);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.response?.data?.message || e?.message || 'Analysis failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const steps = ['Capture', 'Review', 'Confirm'];
  const stepIdx = phase === 'intro' ? 0 : phase === 'sheet' ? 0 : 1;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        onBack={onBack}
        eyebrow="AI ATTENDANCE · PHOTO CHECK-IN"
        title="AI Photo Attendance"
        subtitle={`${session.batch_name} · ${fmtDate(session.date)} · ${fmtTime(session.start_time)}`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          {steps.map((s, i) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', flex: i < 2 ? 1 : undefined }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: i <= stepIdx ? C.accent : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: i <= stepIdx ? '#fff' : 'rgba(255,255,255,0.7)', fontWeight: '900', fontSize: 11 }}>{i + 1}</Text>
                </View>
                <Text style={{ color: i <= stepIdx ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: '800', fontSize: 12, marginLeft: 6 }}>{s}</Text>
              </View>
              {i < 2 ? <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 }} /> : null}
            </View>
          ))}
        </View>
      </AppHeader>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 40 }}>
        <ErrorBanner msg={err} />
        {liveCam ? (
          <WebCamera
            onCapture={(dataUrl) => {
              setLiveCam(false);
              useAsset(dataUrl);
            }}
            onClose={() => setLiveCam(false)}
          />
        ) : null}
        {phase === 'intro' ? (
          <>
            <Card style={{ borderWidth: 1.5, borderColor: count === 0 ? C.redBd : C.navy }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconBubble glyph="◉" bg={count === 0 ? C.redSoft : C.navySoft} fg={count === 0 ? C.red : C.navy} size={52} />
                <View style={{ flex: 1, marginLeft: S.md }}>
                  <Text style={{ fontWeight: '800', color: C.text, fontSize: 16 }}>
                    {count === null ? 'Loading roster…' : `${count} athlete${count === 1 ? '' : 's'} enrolled`}
                  </Text>
                  <Sub style={{ marginTop: 2 }}>
                    {count === 0
                      ? 'This session has nobody to check in.'
                      : 'One clear group photo checks in the whole batch.'}
                  </Sub>
                </View>
              </View>
              {count === 0 ? (
                <View style={{ backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.redBd, borderRadius: 12, padding: S.md, marginTop: S.md }}>
                  <Text style={{ color: C.red, fontWeight: '800', fontSize: 13.5, marginBottom: 4 }}>
                    No athletes are assigned to this session
                  </Text>
                  <Text style={{ color: C.sub, fontSize: 12.5, lineHeight: 18 }}>
                    Attendance cannot be taken against an empty roster. Ask your academy admin to add
                    athletes to <Text style={{ fontWeight: '800' }}>{session.batch_name}</Text> (Students
                    → Batch), then reopen this screen. A photo analysis would otherwise have nobody to
                    match against.
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: S.md, gap: 8 }}>
                  {TIPS.map((t) => (
                    <View key={t.title} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.line }}>
                      <IconBubble glyph={t.glyph} size={36} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ fontWeight: '800', color: C.text, fontSize: 13.5 }}>{t.title}</Text>
                        <Text style={{ color: C.sub, fontSize: 12.5 }}>{t.hint}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Card>
            <View style={{ height: S.md }} />
            <Btn
              title="◎  Start AI Attendance Scan"
              kind="accent"
              disabled={count === 0}
              onPress={() => setPhase('sheet')}
            />
            <Sub style={{ textAlign: 'center', marginTop: S.md }}>
              The photo is stored as audit evidence. Nothing is saved until you review and confirm.
            </Sub>
          </>
        ) : phase === 'sheet' ? (
          <>
            <Card style={{ padding: S.md }}>
              <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15, marginBottom: S.sm, paddingHorizontal: 4 }}>
                Choose photo source
              </Text>
              <Pressable onPress={openCamera} accessibilityRole="button" style={({ pressed }) => [{ backgroundColor: C.navyDeep, borderRadius: 14, padding: S.lg, flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, pressed && { opacity: 0.9 }]}>
                <IconBubble glyph="▣" bg="rgba(255,107,44,0.25)" fg="#FFB37E" size={48} />
                <View style={{ flex: 1, marginLeft: S.md }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>Camera</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginTop: 2 }}>Capture the group right now</Text>
                </View>
                <Text style={{ color: '#FFB37E', fontWeight: '900', fontSize: 20 }}>›</Text>
              </Pressable>
              <Pressable onPress={openLibrary} accessibilityRole="button" style={({ pressed }) => [{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: S.lg, flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.9 }]}>
                <IconBubble glyph="▤" size={48} />
                <View style={{ flex: 1, marginLeft: S.md }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.navy }}>Photo library</Text>
                  <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>Upload an existing group photo</Text>
                </View>
                <Text style={{ color: C.faint, fontWeight: '900', fontSize: 20 }}>›</Text>
              </Pressable>
              <Pressable onPress={() => setPhase('intro')} accessibilityRole="button" style={[sheetRow, { borderBottomWidth: 0, alignItems: 'center' }]}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.sub }}>Cancel</Text>
              </Pressable>
            </Card>
            <Sub style={{ textAlign: 'center', marginTop: S.md }}>
              Use a clear, well-lit group photo for the most reliable review.
            </Sub>
          </>
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
                <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15, flex: 1 }}>Review the photo</Text>
                <View style={{ backgroundColor: C.greenSoft, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 }}>
                  <Text style={{ color: C.green, fontWeight: '800', fontSize: 11.5 }}>READY TO ANALYZE</Text>
                </View>
              </View>
              {uri ? (
                <Image
                  source={{ uri }}
                  style={{ width: '100%', height: 300, borderRadius: R.btn, backgroundColor: C.line }}
                  resizeMode="cover"
                />
              ) : null}
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md }}>
                <View style={{ flex: 1 }}>
                  <Btn title="Retake" kind="secondary" onPress={() => setPhase('sheet')} />
                </View>
                <View style={{ flex: 1.4 }}>
                  <Btn title={busy ? 'Analyzing…' : 'Analyze Photo'} kind="accent" onPress={analyze} loading={busy} />
                </View>
              </View>
            </Card>
            <View style={[{ backgroundColor: '#fff', borderRadius: 14, padding: S.md, marginTop: S.md, borderWidth: 1, borderColor: C.line }, shadowSm]}>
              <Text style={{ color: C.sub, fontSize: 12.5, textAlign: 'center', lineHeight: 18 }}>
                {busy ? 'Uploading and analyzing — this can take up to a minute. Please stay on this screen…' : 'AI will suggest matches. You always make the final call.'}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
