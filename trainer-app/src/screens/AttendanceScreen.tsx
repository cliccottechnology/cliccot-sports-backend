import React, { useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { bulkMark, roster, sessionMakeupMeta, type RosterRow, type SessionItem } from '../api';
import { AppHeader, Avatar, Badge, Btn, Card, EmptyState, ErrorBanner, IconBubble, SearchBar, Sub } from '../components/ui';
import Donut from '../components/Donut';
import { C, R, S, fmtDate, fmtTime, shadowSm } from '../theme';

const OPTS = [
  { k: 'present', label: 'P', bg: C.green, hint: 'Present' },
  { k: 'absent', label: 'A', bg: C.red, hint: 'Absent' },
  { k: 'late', label: 'L', bg: C.amber, hint: 'Late' },
  { k: 'leave', label: 'E', bg: C.navy, hint: 'Leave' },
];

const STATUS_LABEL: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  leave: 'Leave',
  not_marked: 'Not Marked',
};

export default function AttendanceScreen({
  session,
  onBack,
  onPhoto,
  onSaved,
}: {
  session: SessionItem;
  onBack: () => void;
  onPhoto: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [phase, setPhase] = useState<'mark' | 'confirm'>('mark');
  const [reason, setReason] = useState('');
  const [hadMarks, setHadMarks] = useState(false);
  const [makeupFor, setMakeupFor] = useState<number | null>(null);

  React.useEffect(() => {
    Promise.all([roster(String(session.id)), sessionMakeupMeta(String(session.id)).catch(() => ({ isMakeup: false, makeupFor: null }))])
      .then(([r, meta]) => {
        setRows(r);
        setHadMarks(r.some((x) => x.status && x.status !== 'not_marked'));
        setMakeupFor(meta.makeupFor);
      })
      .catch((e) => setErr(e?.response?.data?.message || e?.message || "Couldn't load roster."))
      .finally(() => setLoading(false));
  }, [session.id]);

  const setStatus = (student: number, status: string) =>
    setRows((rs) => rs.map((r) => (r.student === student ? { ...r, status } : r)));

  const markAll = (status: string) => setRows((rs) => rs.map((r) => ({ ...r, status })));

  const filtered = rows.filter(
    (r) =>
      !q.trim() ||
      r.name.toLowerCase().includes(q.trim().toLowerCase()) ||
      (r.student_id || '').toLowerCase().includes(q.trim().toLowerCase()),
  );

  const count = (k: string) => rows.filter((r) => r.status === k).length;
  const marked = rows.filter((r) => r.status && r.status !== 'not_marked').length;
  const pct = rows.length ? Math.round((marked / rows.length) * 100) : 0;

  const save = async () => {
    if (hadMarks && !reason.trim()) {
      setErr('This session already has saved marks — enter a correction reason to overwrite them.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const res = await bulkMark(
        session.id,
        rows.map((r) => ({ student: r.student, status: r.status, ...(makeupFor ? { makeup_for: makeupFor } : {}) })),
        hadMarks ? reason : undefined,
      );
      const failed = (res?.results || []).filter((x: any) => x.error);
      if (failed.length) {
        setErr(`${failed.length} record(s) rejected (${failed[0].error}). The rest were saved.`);
        return;
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.response?.data?.detail || e?.message || "Couldn't save attendance. Nothing was saved — check connection and retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        onBack={phase === 'confirm' ? () => setPhase('mark') : onBack}
        eyebrow={phase === 'confirm' ? 'STEP 2 OF 2 · CONFIRM' : 'STEP 1 OF 2 · MARK'}
        title={phase === 'confirm' ? 'Confirm attendance' : session.batch_name || 'Session'}
        subtitle={`${session.sport_name ? `${session.sport_name} · ` : ''}${fmtDate(session.date)} · ${fmtTime(session.start_time)} – ${fmtTime(session.end_time)}`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 14, padding: S.md }}>
          <Badge status={session.status} />
          <View style={{ flex: 1, marginLeft: S.md }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13.5 }}>{marked}/{rows.length} marked · {pct}%</Text>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', marginTop: 6, overflow: 'hidden' }}>
              <View style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: C.accent }} />
            </View>
          </View>
        </View>
      </AppHeader>

      {phase === 'mark' ? (
        <View style={{ flex: 1, paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.lg }}>
          <ErrorBanner msg={err} />
          <Card style={{ marginBottom: S.md, padding: S.md, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#F5C5A8', backgroundColor: C.accentTint }}>
            <IconBubble glyph="◎" bg="#fff" fg={C.accentDeep} size={48} />
            <View style={{ flex: 1, marginLeft: S.md }}>
              <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5 }}>AI Photo Attendance</Text>
              <Sub>Skip manual taps — capture one group photo.</Sub>
            </View>
            <Btn title="Open Camera" kind="accent" onPress={onPhoto} style={{ paddingVertical: 10, minHeight: 44, paddingHorizontal: 14 }} />
          </Card>
          {makeupFor ? (
            <Card style={{ marginBottom: S.md, borderWidth: 1.5, borderColor: '#F5C5A8', backgroundColor: C.accentTint }}>
              <Text style={{ fontWeight: '800', color: C.accentDeep, fontSize: 13.5 }}>Make-up session · linked to missed session #{makeupFor}</Text>
              <Sub>Marks are recorded against this session; the original absence stays on record.</Sub>
            </Card>
          ) : null}
          <SearchBar value={q} onChange={setQ} placeholder="Search roster by name or ID" />
          <View style={{ flexDirection: 'row', marginTop: S.sm, marginBottom: S.sm }}>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', color: C.faint, letterSpacing: 0.8 }}>ROSTER · {filtered.length}</Text>
            <Pressable onPress={() => markAll('present')} style={{ padding: 4 }}><Text style={{ color: C.green, fontWeight: '800', fontSize: 12.5 }}>All present</Text></Pressable>
            <Text style={{ color: C.line, marginHorizontal: 6 }}>·</Text>
            <Pressable onPress={() => markAll('not_marked')} style={{ padding: 4 }}><Text style={{ color: C.sub, fontWeight: '800', fontSize: 12.5 }}>Clear</Text></Pressable>
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(r) => String(r.student)}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            ListEmptyComponent={
              loading ? null : (
                <Card>
                  <EmptyState glyph="◉" title={rows.length ? 'No matches in this roster' : 'No students in this roster'} hint="Try a different search term." />
                </Card>
              )
            }
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: R.card,
                  padding: S.md,
                  marginBottom: S.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: item.status && item.status !== 'not_marked' ? C.greenBd : C.line,
                  ...shadowSm,
                }}
              >
                <View>
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.line }} />
                  ) : (
                    <Avatar name={item.name} size={44} />
                  )}
                  {item.hasRef ? (
                    <View style={{ position: 'absolute', right: -2, bottom: -2, width: 15, height: 15, borderRadius: 8, backgroundColor: C.green, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>✓</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flex: 1, marginLeft: S.md }}>
                  <Text style={{ fontWeight: '800', color: C.text, fontSize: 14 }} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Sub>{item.student_id || `ID ${item.student}`} · {STATUS_LABEL[item.status || 'not_marked']}</Sub>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  {OPTS.map((o) => {
                    const active = item.status === o.k;
                    return (
                      <Pressable
                        key={o.k}
                        onPress={() => setStatus(item.student, o.k)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        accessibilityLabel={`Mark ${item.name} ${o.hint}`}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          marginLeft: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: active ? o.bg : '#EEF1F6',
                          borderWidth: active ? 0 : 1,
                          borderColor: C.line,
                        }}
                      >
                        <Text style={{ color: active ? '#fff' : C.sub, fontWeight: '800', fontSize: 13 }}>
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          />
          <View style={{ paddingTop: S.sm }}>
            <Btn title={loading ? 'Loading roster…' : `Review & Save  (${marked}/${rows.length})`} onPress={() => { setErr(''); setPhase('confirm'); }} disabled={loading || rows.length === 0} kind="accent" />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.lg }}>
          <ErrorBanner msg={err} />
          <Card style={{ marginBottom: S.md }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: C.faint, letterSpacing: 1.2, marginBottom: 6 }}>ATTENDANCE MIX</Text>
            <Donut
              slices={[
                { label: 'Present', value: count('present'), color: C.green },
                { label: 'Late', value: count('late'), color: C.amber },
                { label: 'Leave', value: count('leave'), color: C.navy },
                { label: 'Absent', value: count('absent'), color: C.red },
                { label: 'Not marked', value: count('not_marked'), color: C.faint },
              ]}
              centerLabel={`${marked}/${rows.length}`}
              centerSub="marked"
            />
          </Card>
          <Card>
            <Text style={{ fontSize: 11, fontWeight: '800', color: C.faint, letterSpacing: 1.2, marginBottom: 6 }}>ATTENDANCE SUMMARY</Text>
            {['present', 'absent', 'late', 'leave', 'not_marked'].map((k, i, arr) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: C.line }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 9, backgroundColor: k === 'present' ? C.green : k === 'absent' ? C.red : k === 'late' ? C.amber : k === 'leave' ? C.navy : C.faint }} />
                <Text style={{ flex: 1, color: C.sub, fontWeight: '600', fontSize: 14 }}>{STATUS_LABEL[k]}</Text>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>{count(k)}</Text>
              </View>
            ))}
            {count('not_marked') > 0 ? (
              <View style={{ backgroundColor: C.amberSoft, borderRadius: 10, padding: 10, marginTop: S.sm }}>
                <Text style={{ color: C.amber, fontWeight: '700', fontSize: 13 }}>
                  {count('not_marked')} athlete(s) will stay Not Marked.
                </Text>
              </View>
            ) : null}
          </Card>
          {hadMarks ? (
            <Card style={{ marginTop: S.md, borderWidth: 1.5, borderColor: C.amberBd }}>
              <Text style={{ fontWeight: '800', color: C.text, marginBottom: 4 }}>Correction reason · required</Text>
              <Sub style={{ marginBottom: 8 }}>This session already has saved marks. Overwriting them is logged with your reason.</Sub>
              <SearchBar value={reason} onChange={(t) => { setReason(t); setErr(''); }} placeholder="e.g. Coach corrected after recount" />
            </Card>
          ) : null}
          <View style={{ height: S.md }} />
          <Btn title="Confirm & Save Attendance" kind="accent" onPress={save} loading={saving} />
          <View style={{ height: S.sm }} />
          <Btn title="Back to Marking" kind="ghost" onPress={() => setPhase('mark')} />
          <Sub style={{ textAlign: 'center', marginTop: S.sm }}>
            Attendance is saved only after the backend confirms it.
          </Sub>
        </View>
      )}
    </View>
  );
}
