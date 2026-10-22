import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { invalidateCoachData, loadCoachData, type CoachData } from '../coach';
import { sports, sessionAttendance, roster, changeSessionStatus, type SessionItem, type Sport } from '../api';
import { AppHeader, Badge, Btn, Card, Chip, EmptyState, ErrorBanner, Eyebrow, SkeletonCard, StatCard } from '../components/ui';
import { C, S, fmtDate, fmtTime } from '../theme';

export default function SessionsScreen({
  onScan,
  onManual,
}: {
  onScan: (s: SessionItem) => void;
  onManual: (s: SessionItem) => void;
}) {
  const [data, setData] = useState<CoachData | null>(null);
  const [sportList, setSportList] = useState<Sport[]>([]);
  const [sport, setSport] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [todayOnly, setTodayOnly] = useState(false);
  const [sel, setSel] = useState<SessionItem | null>(null);
  const [counts, setCounts] = useState({ students: 0, marked: 0, present: 0, absent: 0 });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  const markCompleted = async () => {
    if (!sel) return;
    setCompleting(true);
    setErr('');
    try {
      const updated = await changeSessionStatus(sel.id, 'completed');
      setSel(updated);
      invalidateCoachData();
      const fresh = await loadCoachData(true);
      setData(fresh);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.response?.data?.message || e?.message || 'Could not complete session.');
    } finally {
      setCompleting(false);
    }
  };

  React.useEffect(() => {
    Promise.all([loadCoachData(), sports()])
      .then(([d, sp]) => {
        setData(d);
        setSportList(sp);
        const first = d.today[0] || d.my[0] || null;
        setSel(first);
      })
      .catch((e: any) => setErr(e?.response?.data?.message || e?.message || "Couldn't load sessions."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!sel) return;
    let live = true;
    (async () => {
      try {
        const [rows, recs] = await Promise.all([roster(String(sel.id)), sessionAttendance(sel.id)]);
        if (!live) return;
        setCounts({
          students: rows.length,
          marked: recs.filter((r) => r.status !== 'not_marked').length,
          present: recs.filter((r) => r.status === 'present').length,
          absent: recs.filter((r) => r.status === 'absent').length,
        });
      } catch {
        /* keep previous */
      }
    })();
    return () => {
      live = false;
    };
  }, [sel]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const list = (data?.my || []).filter(
    (s) =>
      (sport === 'ALL' || s.sport_name === sport) &&
      (status === 'ALL' || s.status === status) &&
      (!todayOnly || s.date === todayStr),
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        eyebrow="TRAINING SCHEDULE"
        title="Sessions"
        subtitle="Pick a sport, choose a session, then start check-in."
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 30 }}>
        <ErrorBanner msg={err} />
        <Eyebrow>SPORT</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: S.md }}>
          {['ALL', ...sportList.map((s) => s.name)].map((name) => (
            <Chip key={name} label={name === 'ALL' ? 'All sports' : name} active={sport === name} onPress={() => { setSport(name); setSel(null); }} />
          ))}
        </View>

        <Eyebrow>STATUS</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: S.md }}>
          {['ALL', 'scheduled', 'in_progress', 'completed', 'cancelled'].map((name) => (
            <Chip
              key={name}
              label={name === 'ALL' ? 'All' : name.replace('_', ' ')}
              active={status === name}
              onPress={() => { setStatus(name); setSel(null); }}
            />
          ))}
          <Chip label={todayOnly ? '✓ Today only' : 'Today only'} active={todayOnly} accent onPress={() => { setTodayOnly((v) => !v); setSel(null); }} />
        </View>

        <Eyebrow>TRAINING SESSION · {list.length}</Eyebrow>
        <View style={{ height: 8 }} />
        {loading ? (
          <View style={{ gap: 8 }}><SkeletonCard /><SkeletonCard /></View>
        ) : list.length === 0 ? (
          <Card><EmptyState glyph="◷" title="No sessions match" hint="Try clearing the sport or status filters." /></Card>
        ) : (
          list.slice(0, 12).map((s) => {
            const active = sel?.id === s.id;
            return (
              <Pressable key={s.id} onPress={() => setSel(s)} accessibilityRole="radio" accessibilityState={{ checked: active }}>
                <Card
                  style={{
                    marginBottom: S.sm,
                    padding: S.md,
                    borderWidth: 2,
                    borderColor: active ? C.accent : C.line,
                    backgroundColor: active ? C.accentTint : '#fff',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 4, height: 44, borderRadius: 2, backgroundColor: active ? C.accent : C.line, marginRight: S.md }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15 }} numberOfLines={1}>
                        {s.batch_name} · {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                      </Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                        {s.sport_name} · {fmtDate(s.date)}
                        {s.location_name ? ` · ${s.location_name}` : ''}
                        {s.assigned ? ` · ${s.assigned.length} athletes` : ''}
                      </Text>
                    </View>
                    <Badge status={s.status} />
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}

        {sel ? (
          <Card style={{ marginTop: S.md, padding: S.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: C.faint, letterSpacing: 1.2 }}>SELECTED SESSION</Text>
                <Text style={{ fontWeight: '800', color: C.navy, fontSize: 16, marginTop: 3 }} numberOfLines={1}>
                  {sel.batch_name} · {fmtDate(sel.date)}
                </Text>
                <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                  {sel.sport_name} · {fmtTime(sel.start_time)} – {fmtTime(sel.end_time)}
                </Text>
              </View>
              <Badge status={sel.status} />
            </View>
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md }}>
              <StatCard glyph="◉" value={String(counts.students)} label="Enrolled" tint={C.navySoft} fg={C.navy} />
              <StatCard glyph="✓" value={String(counts.marked)} label="Marked" tint={C.tealSoft} fg={C.teal} />
              <StatCard glyph="●" value={String(counts.present)} label="Present" tint={C.greenSoft} fg={C.green} />
              <StatCard glyph="✕" value={String(counts.absent)} label="Absent" tint={C.redSoft} fg={C.red} />
            </View>
            <View style={{ height: S.md }} />
            {sel.status === 'completed' ? (
              <View style={{ backgroundColor: C.greenSoft, borderRadius: 12, padding: S.md, borderWidth: 1, borderColor: C.greenBd, marginBottom: S.md, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: C.green, fontWeight: '800', fontSize: 13.5, flex: 1 }}>✓ Session Completed · Attendance Saved</Text>
              </View>
            ) : null}

            {sel.status !== 'completed' ? (
              <>
                <Btn title="◎  Start AI Attendance Scan" kind="accent" onPress={() => onScan(sel)} />
                <View style={{ height: S.sm }} />
                <Btn title="Manual Attendance" kind="secondary" onPress={() => onManual(sel)} />
                {counts.marked > 0 ? (
                  <>
                    <View style={{ height: S.sm }} />
                    <Btn title={completing ? 'Completing…' : '✓  Finalize & Mark as Completed'} kind="accent" onPress={markCompleted} loading={completing} />
                  </>
                ) : null}
              </>
            ) : (
              <Btn title="Review / Update Attendance" kind="secondary" onPress={() => onManual(sel)} />
            )}
            <Pressable onPress={async () => { invalidateCoachData(); setLoading(true); try { setData(await loadCoachData(true)); } finally { setLoading(false); } }} style={{ alignSelf: 'center', marginTop: S.md, padding: 8 }}>
              <Text style={{ color: C.navy, fontWeight: '800', fontSize: 13 }}>⟳  Refresh roster stats</Text>
            </Pressable>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
