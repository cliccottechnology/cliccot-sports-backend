import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { bulkMark, type Analysis, type SessionItem } from '../api';
import { AppHeader, Avatar, Badge, Btn, Card, ErrorBanner, IconBubble, Sub } from '../components/ui';
import { C, R, S } from '../theme';

const FINAL = ['present', 'absent', 'late', 'leave'] as const;
const FINAL_LABEL: Record<string, string> = { present: 'P', absent: 'A', late: 'L', leave: 'E' };

function defaultFor(s: Analysis['suggestions'][number]): string {
  // SAAPT matching rules — never punish an athlete for missing evidence:
  // 1. Face recognized in photo -> Auto-mark Present
  if (s.suggestion === 'verified') return 'present';
  // 2. Enrolled athlete whose face WAS searched and not seen -> Absent candidate.
  //    Only a real negative (a reference photo exists to compare against) may
  //    become absent; this is still just a default the coach can override.
  if (s.has_reference && s.suggestion === 'not_detected') return 'absent';
  // 3. No reference photo (never compared) or uncertain review -> leave Not
  //    Marked. Absence can only be asserted for an athlete the AI could
  //    actually compare; everyone else needs the trainer's manual call.
  return 'not_marked';
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 10, minWidth: 72 }}>
      <Text style={{ fontSize: 18, fontWeight: '900', color }}>{value}</Text>
      <Text style={{ fontSize: 9, fontWeight: '800', color: C.faint, letterSpacing: 0.3, marginTop: 3, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function Group({
  title,
  hint,
  color,
  items,
  finals,
  setFinal,
}: {
  title: string;
  hint: string;
  color: string;
  items: Analysis['suggestions'];
  finals: Record<number, string>;
  setFinal: (id: number, v: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
        <View style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: color, marginRight: 7 }} />
        <Text style={{ fontWeight: '800', color: C.text, fontSize: 15.5 }}>
          {title} · {items.length}
        </Text>
      </View>
      <Text style={{ color: C.sub, fontSize: 12.5, marginBottom: S.sm }}>{hint}</Text>
      {items.map((s) => {
        const decided = !!finals[s.student];
        return (
          <Card key={s.student} style={{ marginBottom: S.sm, padding: S.md, borderWidth: decided ? 1 : 1.5, borderColor: decided ? C.line : C.amberBd }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={s.name} size={44} />
              <View style={{ flex: 1, marginLeft: S.md }}>
                <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5 }} numberOfLines={1}>
                  {s.name}
                </Text>
                <Sub>
                  {s.student_ref || `#${s.student}`}
                  {s.confidence != null ? ` · ${Math.round(s.confidence * 100)}% match` : ''}
                </Sub>
              </View>
              <Badge status={finals[s.student] || s.suggestion} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <View
                style={{
                  paddingVertical: 3,
                  paddingHorizontal: 9,
                  borderRadius: 999,
                  backgroundColor: s.has_reference ? C.greenSoft : C.amberSoft,
                  borderWidth: 1,
                  borderColor: s.has_reference ? C.greenBd : C.amberBd,
                }}
              >
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: s.has_reference ? C.green : C.amber }}>
                  {s.has_reference ? (s.suggestion === 'verified' ? '✓ AI FACE MATCHED' : '✓ REF PHOTO ON FILE') : '○ NO REF PHOTO (NOT ENROLLED)'}
                </Text>
              </View>
            </View>
            {!s.has_reference ? (
              <Sub style={{ marginTop: 6, color: C.amber }}>No reference photo on file. Tap buttons below to adjust status.</Sub>
            ) : null}
            <Sub style={{ marginTop: 6, fontStyle: 'italic' }}>{s.reason}</Sub>
            <View style={{ flexDirection: 'row', marginTop: S.sm }}>
              {FINAL.map((f) => {
                const active = finals[s.student] === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFinal(s.student, f)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={`Confirm ${s.name} ${f}`}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      marginRight: f === 'leave' ? 0 : 6,
                      borderRadius: 11,
                      alignItems: 'center',
                      backgroundColor: active ? (f === 'present' ? C.green : f === 'absent' ? C.red : C.navy) : '#EEF1F6',
                      borderWidth: active ? 0 : 1,
                      borderColor: C.line,
                    }}
                  >
                    <Text style={{ color: active ? '#fff' : C.sub, fontWeight: '800', fontSize: 11.5 }}>
                      {FINAL_LABEL[f] ?? f.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => setFinal(s.student, 'not_marked')}
              accessibilityRole="radio"
              accessibilityState={{ checked: !finals[s.student] || finals[s.student] === 'not_marked' }}
              accessibilityLabel={`Leave ${s.name} not marked`}
              style={{ marginTop: 6, paddingVertical: 8, borderRadius: 11, alignItems: 'center', backgroundColor: !finals[s.student] || finals[s.student] === 'not_marked' ? C.faint : '#EEF1F6', borderWidth: 1, borderColor: C.line }}
            >
              <Text style={{ color: !finals[s.student] || finals[s.student] === 'not_marked' ? '#fff' : C.sub, fontWeight: '800', fontSize: 11 }}>
                NOT MARKED
              </Text>
            </Pressable>
          </Card>
        );
      })}
    </View>
  );
}

export default function ReviewScreen({
  session,
  analysis,
  photoUri,
  onBack,
  onDone,
}: {
  session: SessionItem;
  analysis: Analysis;
  photoUri: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [finals, setFinals] = useState<Record<number, string>>(() =>
    Object.fromEntries(analysis.suggestions.map((s) => [s.student, defaultFor(s)])),
  );
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const setFinal = (id: number, v: string) => { setFinals((f) => ({ ...f, [id]: v })); setErr(''); };
  const undecided = analysis.suggestions.filter((s) => !finals[s.student]);
  const decided = analysis.suggestions.length - undecided.length;

  const assignAll = (status: string) =>
    setFinals((f) => {
      const next = { ...f };
      analysis.suggestions.forEach((s) => { next[s.student] = status; });
      return next;
    });

  const assignNotEnrolled = (status: string) =>
    setFinals((f) => {
      const next = { ...f };
      analysis.suggestions.filter((s) => !s.has_reference).forEach((s) => { next[s.student] = status; });
      return next;
    });

  // Calculate live counts
  const presentCount = analysis.suggestions.filter((s) => finals[s.student] === 'present').length;
  const absentCount = analysis.suggestions.filter((s) => finals[s.student] === 'absent').length;
  const notMarkedCount = analysis.suggestions.filter((s) => !finals[s.student] || finals[s.student] === 'not_marked').length;
  const verifiedStudents = analysis.suggestions.filter((s) => s.suggestion === 'verified');
  const absentCandidates = analysis.suggestions.filter((s) => s.has_reference && s.suggestion === 'not_detected');
  const notEnrolledStudents = analysis.suggestions.filter((s) => !s.has_reference);
  const notEnrolledCount = analysis.not_enrolled_count ?? notEnrolledStudents.length;
  const totalStudents = analysis.total_students ?? analysis.suggestions.length;

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      const items = analysis.suggestions.map((s) => ({
        student: s.student,
        // Fall back to the same evidence-based default, never a blanket absent.
        status: finals[s.student] || defaultFor(s),
      }));
      await bulkMark(session.id, items);
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Couldn't save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const pct = analysis.suggestions.length ? Math.round((decided / analysis.suggestions.length) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        onBack={onBack}
        eyebrow="AI ATTENDANCE · SAAPT REVIEW"
        title="Review & Submit Attendance"
        subtitle={`${session.batch_name} · ${verifiedStudents.length} face matches · ${absentCandidates.length} not detected`}
      >
        <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 14, padding: S.md }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13.5 }}>
            {presentCount} Present · {absentCount} Absent · {notMarkedCount} Not Marked · {totalStudents} Total Roster
          </Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', marginTop: 6, overflow: 'hidden' }}>
            <View style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: '#22C55E' }} />
          </View>
        </View>
      </AppHeader>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 40 }}>
        <ErrorBanner msg={err} />

        {/* 1-Click Primary Action Card */}
        <Card style={{ marginBottom: S.md, padding: S.md, backgroundColor: '#F0FDF4', borderColor: '#86EFAC', borderWidth: 1.5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <IconBubble glyph="⚡" size={36} bg={C.green} fg="#fff" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontWeight: '900', color: C.green, fontSize: 16 }}>
                1-Click Attendance Ready
              </Text>
              <Sub style={{ color: C.text }}>
                Matched faces marked Present. Unmatched enrolled athletes marked Absent.
                {notMarkedCount > 0
                  ? ` ${notMarkedCount} without a reference photo stay Not Marked — set them below.`
                  : ''}
              </Sub>
            </View>
          </View>

          <Btn
            title="✓ Confirm & Submit Attendance (1-Click)"
            onPress={save}
            loading={saving}
            kind="accent"
            style={{ backgroundColor: C.green }}
          />
        </Card>

        {/* Photo and Stats Card */}
        <Card style={{ marginBottom: S.md, padding: S.md }}>
          <Image
            source={{ uri: photoUri }}
            style={{ width: '100%', height: 180, borderRadius: R.btn, backgroundColor: C.line }}
            resizeMode="cover"
          />

          {/* SAAPT 4-metric Summary Banner */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: S.md }}>
            <Stat label="PRESENT (MATCHED)" value={verifiedStudents.length} color={C.green} />
            <Stat label="ABSENT NOT SEEN" value={absentCandidates.length} color={C.red} />
            <Stat label="NOT ENROLLED" value={notEnrolledCount} color={notEnrolledCount > 0 ? C.amber : C.faint} />
            <Stat label="TOTAL ROSTER" value={totalStudents} color={C.navy} />
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: S.sm, flexWrap: 'wrap' }}>
            {analysis.possible_duplicate ? (
              <View style={{ flex: 1, minWidth: '100%', backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBd, borderRadius: 10, padding: 10 }}>
                <Text style={{ color: C.amber, fontWeight: '700', fontSize: 12.5 }}>
                  Possible duplicate of an earlier submission (photo #{analysis.possible_duplicate}).
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.greenBd, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
              <Text style={{ color: C.green, fontWeight: '800', fontSize: 12 }}>
                ✓ {verifiedStudents.length} AI FACE MATCHES
              </Text>
            </View>
            {absentCandidates.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.redBd, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text style={{ color: C.red, fontWeight: '800', fontSize: 12 }}>
                  ✗ {absentCandidates.length} NOT DETECTED (ABSENT)
                </Text>
              </View>
            ) : null}
            {notEnrolledCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberBd, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text style={{ color: C.amber, fontWeight: '800', fontSize: 12 }}>
                  ○ {notEnrolledCount} NOT ENROLLED
                </Text>
              </View>
            ) : null}
          </View>

          {analysis.notes.map((n) => (
            <View key={n.slice(0, 24)} style={{ flexDirection: 'row', marginTop: 8 }}>
              <IconBubble glyph="✦" size={26} bg={C.navyTint} fg={C.navy} />
              <Sub style={{ flex: 1, marginLeft: 8 }}>{n}</Sub>
            </View>
          ))}
        </Card>

        {/* Quick Batch Adjustment Helpers */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md }}>
          <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '800', color: C.faint, letterSpacing: 0.6 }}>
            QUICK ACTIONS
          </Text>
          <Pressable onPress={() => assignAll('present')} style={{ padding: 6 }}>
            <Text style={{ color: C.green, fontWeight: '800', fontSize: 12.5 }}>All Present</Text>
          </Pressable>
          <Text style={{ color: C.line, marginHorizontal: 6 }}>·</Text>
          <Pressable onPress={() => assignNotEnrolled('present')} style={{ padding: 6 }}>
            <Text style={{ color: C.navy, fontWeight: '800', fontSize: 12.5 }}>Not Enrolled Present</Text>
          </Pressable>
          <Text style={{ color: C.line, marginHorizontal: 6 }}>·</Text>
          <Pressable onPress={() => assignNotEnrolled('absent')} style={{ padding: 6 }}>
            <Text style={{ color: C.red, fontWeight: '800', fontSize: 12.5 }}>Not Enrolled Absent</Text>
          </Pressable>
        </View>

        {/* 1. Verified Matches */}
        <Group
          title="Verified Matches · Present"
          hint="AI detected and recognized their face in the photo (similarity ≥ 90%)."
          color={C.green}
          items={verifiedStudents}
          finals={finals}
          setFinal={setFinal}
        />

        {/* 2. Absent Candidates */}
        {absentCandidates.length > 0 ? (
          <Group
            title="Absent Candidates · Not in Photo"
            hint="Enrolled reference photo on file, but face was not detected in this photo."
            color={C.red}
            items={absentCandidates}
            finals={finals}
            setFinal={setFinal}
          />
        ) : null}

        {/* 3. Not Enrolled Athletes */}
        {notEnrolledStudents.length > 0 ? (
          <Group
            title="Not Enrolled Athletes (No Reference Photo)"
            hint="No reference photo enrolled, so the AI cannot compare them. They stay Not Marked until you set a status."
            color={C.amber}
            items={notEnrolledStudents}
            finals={finals}
            setFinal={setFinal}
          />
        ) : null}

        {/* Bottom Submit Button */}
        <Btn
          title={`✓ Confirm & Submit Attendance (${presentCount} Present${notMarkedCount > 0 ? ` · ${notMarkedCount} Not Marked` : ''})`}
          onPress={save}
          loading={saving}
          kind="accent"
        />
        <Sub style={{ textAlign: 'center', marginTop: S.sm }}>
          Athletes left Not Marked are saved as pending — never as absent. Submitting finalizes the session, notifies Admin, and sends parent arrival notices.
        </Sub>
      </ScrollView>
    </View>
  );
}
