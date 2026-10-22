import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import Donut from '../components/Donut';
import ChildSelector from '../components/ChildSelector';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  IconBubble,
  SectionHeader,
  SkeletonCard,
  StatCard,
} from '../components/ui';
import { C, S, fmtDayDate } from '../theme';
import { attendanceStats, childName } from '../util';
import { useChildren } from '../children';
import { childAttendance, childSessions, type AttendanceRec, type SessionItem } from '../api';

export default function AttendanceScreen({
  selChildId,
  onSelectChild,
}: {
  selChildId: number | null;
  onSelectChild: (id: number) => void;
}) {
  const { kids, sel, loading, err, reload } = useChildren(selChildId, onSelectChild);
  const [att, setAtt] = React.useState<AttendanceRec[]>([]);
  const [sessions, setSessions] = React.useState<SessionItem[]>([]);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadChild = React.useCallback(async (id: number) => {
    setLoadingDetail(true);
    try {
      const [a, s] = await Promise.all([
        childAttendance(id, 100).catch(() => []),
        childSessions(id, 60).catch(() => []),
      ]);
      setAtt(a);
      setSessions(s);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  React.useEffect(() => {
    if (sel?.id) loadChild(sel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await reload();
      if (sel?.id) await loadChild(sel.id);
    } finally {
      setRefreshing(false);
    }
  };

  const stats = attendanceStats(att);
  const sessionById = Object.fromEntries(sessions.map((s) => [s.id, s]));
  const rows = [...att].sort((a, b) => (b.marked_at || '').localeCompare(a.marked_at || ''));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: 56, paddingHorizontal: S.lg, paddingBottom: S.sm }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: C.navy, letterSpacing: -0.4 }}>Attendance</Text>
        <Text style={{ fontSize: 13.5, color: C.sub, marginTop: 3 }}>
          {loading ? 'Loading…' : sel ? `${childName(sel)}'s training record` : 'No child selected'}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.navy]} />}
      >
        <ErrorBanner msg={err} />
        {loading ? (
          <SkeletonCard />
        ) : kids.length === 0 ? (
          <Card><EmptyState glyph="✓" title="No children linked" hint="Attendance appears once a child is linked." /></Card>
        ) : (
          <>
            {kids.length > 1 ? (
              <>
                <SectionHeader title="Select child" />
                <ChildSelector kids={kids} selId={sel?.id ?? null} onSelect={onSelectChild} />
              </>
            ) : null}

            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: kids.length > 1 ? 0 : S.md }}>
              <StatCard glyph="✓" value={String(stats.present)} label="Present" tint={C.greenSoft} fg={C.green} />
              <StatCard glyph="◐" value={String(stats.late)} label="Late" tint={C.amberSoft} fg={C.amber} />
              <StatCard glyph="✕" value={String(stats.absent)} label="Absent" tint={C.redSoft} fg={C.red} />
            </View>

            <SectionHeader title="Breakdown" hint={stats.marked ? `${stats.pct}% of ${stats.marked} marked sessions` : 'No records yet'} />
            <Card>
              {stats.marked === 0 ? (
                <EmptyState glyph="✓" title="No attendance yet" hint="Check-ins appear once training begins." />
              ) : (
                <>
                  <Donut
                    slices={[
                      { label: 'Present', value: stats.present, color: C.green },
                      { label: 'Late', value: stats.late, color: C.amber },
                      { label: 'Absent', value: stats.absent, color: C.red },
                      { label: 'Leave', value: stats.leave, color: C.navy },
                    ]}
                    centerLabel={`${stats.pct}%`}
                    centerSub="attended"
                  />
                  <Text style={{ color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: S.sm, lineHeight: 16 }}>
                    Percentage is based on {stats.marked} marked session{stats.marked === 1 ? '' : 's'} (present + late = attended).
                    {stats.notMarked > 0
                      ? ` ${stats.notMarked} session${stats.notMarked === 1 ? '' : 's'} not yet marked — not counted.`
                      : ''}
                  </Text>
                </>
              )}
            </Card>

            <SectionHeader title="History" hint={rows.length ? `${rows.length} records` : undefined} />
            {loadingDetail ? (
              <SkeletonCard />
            ) : rows.length === 0 ? (
              <Card><EmptyState glyph="✓" title="No records yet" /></Card>
            ) : (
              rows.map((r) => {
                const s = sessionById[r.session];
                return (
                  <Card key={r.id} style={{ marginBottom: S.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconBubble glyph="✓" bg={C.navySoft} fg={C.navy} size={40} />
                      <View style={{ flex: 1, marginLeft: S.md }}>
                        <Text style={{ fontWeight: '800', color: C.text, fontSize: 14 }} numberOfLines={1}>
                          {s?.batch_name || `Session ${r.session}`}
                        </Text>
                        <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                          {r.marked_at ? fmtDayDate(r.marked_at.slice(0, 10)) : s?.date ? fmtDayDate(s.date) : '—'}
                          {s?.start_time ? ` · ${s.start_time.slice(0, 5)}` : ''}
                        </Text>
                      </View>
                      <Badge status={r.status} />
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
