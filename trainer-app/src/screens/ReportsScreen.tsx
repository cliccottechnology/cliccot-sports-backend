import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { loadCoachData, type CoachData } from '../coach';
import { AppHeader, Avatar, Badge, Card, Chip, EmptyState, ErrorBanner, SectionHeader, SkeletonCard, StatCard } from '../components/ui';
import { C, S, fmtDate } from '../theme';

const STATUS_FILTERS = ['all', 'present', 'absent', 'late', 'leave'] as const;

export default function ReportsScreen() {
  const [data, setData] = useState<CoachData | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [sport, setSport] = useState<string>('all');

  React.useEffect(() => {
    loadCoachData()
      .then(setData)
      .catch((e: any) => setErr(e?.response?.data?.message || e?.message || "Couldn't load reports."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sports = [...new Set((data?.my || []).map((s) => s.sport_name).filter(Boolean))] as string[];
  const sessById = new Map((data?.my || []).map((s) => [s.id, s]));
  const today = new Date().toISOString().slice(0, 10);

  const hist = (data?.history || []).filter(
    (r) =>
      (status === 'all' || r.status === status) &&
      (sport === 'all' || sessById.get(r.session)?.sport_name === sport),
  );
  const present = (data?.history || []).filter((r) => r.status === 'present').length;
  const absent = (data?.history || []).filter((r) => r.status === 'absent').length;
  const allHist = data?.history || [];
  const rate = allHist.length ? Math.round((present / allHist.length) * 100) : 0;

  const pastSessions = (data?.my || [])
    .filter((s) => (s.date && s.date < today) || s.status === 'completed' || s.status === 'cancelled')
    .filter((s) => sport === 'all' || s.sport_name === sport)
    .slice(0, 15);

  const sessName = (id: number) => sessById.get(id)?.batch_name || `Session ${id}`;
  const sessDate = (id: number) => sessById.get(id)?.date || '';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        eyebrow="PERFORMANCE INSIGHTS"
        title="Reports"
        subtitle={loading ? 'Crunching attendance numbers…' : `${allHist.length} records · ${rate}% present rate`}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 30 }}>
        <ErrorBanner msg={err} />
        {loading ? (
          <View style={{ gap: 8 }}><SkeletonCard /><SkeletonCard /></View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <StatCard glyph="%" value={`${rate}%`} label="Present rate" tint={C.navySoft} fg={C.navy} />
              <StatCard glyph="✓" value={String(present)} label="Present" tint={C.greenSoft} fg={C.green} />
              <StatCard glyph="✕" value={String(absent)} label="Absent" tint={C.redSoft} fg={C.red} />
            </View>
            <View style={{ height: 6, borderRadius: 99, backgroundColor: C.line, marginTop: S.md, overflow: 'hidden' }}>
              <View style={{ height: 6, borderRadius: 99, width: `${rate}%`, backgroundColor: rate >= 80 ? C.green : rate >= 60 ? C.amber : C.red }} />
            </View>

            <SectionHeader title="Filters" hint="Slice history by outcome or sport" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {STATUS_FILTERS.map((s) => (
                <Chip key={s} label={s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)} active={status === s} onPress={() => setStatus(s)} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
              {['all', ...sports].map((s) => (
                <Chip key={s} label={s === 'all' ? 'All sports' : s} active={sport === s} onPress={() => setSport(s)} />
              ))}
            </View>

            <SectionHeader title={`Attendance history · ${hist.length}`} hint="Latest check-ins first" />
            {hist.length === 0 ? (
              <Card><EmptyState glyph="▤" title="No records match" hint="Try widening the filters above." /></Card>
            ) : (
              hist.slice(0, 30).map((r) => (
                <Card key={r.id} style={{ marginBottom: S.sm, padding: S.md, flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar name={r.student_name || `#${r.student}`} size={42} />
                  <View style={{ flex: 1, marginLeft: S.md }}>
                    <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5 }} numberOfLines={1}>{r.student_name || `Student ${r.student}`}</Text>
                    <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                      {sessName(r.session)}{sessDate(r.session) ? ` · ${fmtDate(sessDate(r.session))}` : r.marked_at ? ` · ${fmtDate(r.marked_at.slice(0, 10))}` : ''}
                    </Text>
                  </View>
                  <Badge status={r.status} />
                </Card>
              ))
            )}

            <SectionHeader title={`Session history · ${pastSessions.length}`} hint="Recently completed sessions" />
            {pastSessions.length === 0 ? (
              <Card><EmptyState glyph="◷" title="No past sessions" hint="Completed sessions will be listed here." /></Card>
            ) : (
              pastSessions.map((s) => {
                const st = data?.doneBySession[s.id];
                return (
                  <Card key={s.id} style={{ marginBottom: S.sm, padding: S.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '800', color: C.navy, fontSize: 14.5 }} numberOfLines={1}>
                          {s.batch_name} · {fmtDate(s.date)}
                        </Text>
                        <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                          {s.sport_name}
                          {st ? ` · ✓ ${st.done}/${st.total} marked` : ''}
                        </Text>
                      </View>
                      <Badge status={s.status} />
                    </View>
                  </Card>
                );
              })
            )}

            <SectionHeader title={`Corrections · ${(data?.corrections || []).length}`} hint="Audited attendance changes" />
            {(data?.corrections || []).length === 0 ? (
              <Card><EmptyState glyph="✓" title="No corrections" hint="Authorized changes appear here with reasons." /></Card>
            ) : (
              (data?.corrections || []).slice(0, 20).map((c) => (
                <Card key={c.id} style={{ marginBottom: S.sm, padding: S.md, borderLeftWidth: 3, borderLeftColor: C.amber }}>
                  <Text style={{ fontWeight: '800', color: C.text, fontSize: 14 }} numberOfLines={1}>
                    {c.student_name || 'Student'} · {sessName(c.session)}
                  </Text>
                  <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 3 }}>
                    {c.old_status} → {c.new_status} · {c.reason}
                  </Text>
                  <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 3 }}>
                    {c.corrected_by_name || ''}{c.created_at ? ` · ${c.created_at.slice(0, 16).replace('T', ' ')}` : ''}
                  </Text>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
