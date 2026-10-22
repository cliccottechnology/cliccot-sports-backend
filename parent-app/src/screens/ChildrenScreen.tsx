import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Avatar, Card, EmptyState, ErrorBanner, PressCard, SectionHeader, SkeletonCard } from '../components/ui';
import { C, S, inr } from '../theme';
import { childName, num, attendanceStats } from '../util';
import { useChildren } from '../children';
import { childAttendance, childFees, mediaUrl, type Child, type Fee } from '../api';

export default function ChildrenScreen({
  selChildId,
  onSelectChild,
  onOpenChild,
}: {
  selChildId: number | null;
  onSelectChild: (id: number) => void;
  onOpenChild: (id: number) => void;
}) {
  const { kids, loading, err, reload } = useChildren(selChildId, onSelectChild);
  const [summaries, setSummaries] = React.useState<Record<number, { pct: number; due: number; dueCount: number }>>({});
  const [refreshing, setRefreshing] = React.useState(false);

  const loadSummaries = React.useCallback(async (list: Child[]) => {
    const entries = await Promise.all(
      list.map(async (k) => {
        const [att, fees] = await Promise.all([
          childAttendance(k.id, 100).catch(() => []),
          childFees(k.id).catch(() => [] as Fee[]),
        ]);
        const pct = attendanceStats(att).pct;
        const open = fees.filter((f) => !['paid', 'cancelled', 'refunded'].includes(f.status));
        const due = open.reduce((a, f) => a + num(f.balance ?? num(f.amount) - num(f.paid_total)), 0);
        return [k.id, { pct, due, dueCount: open.length }] as const;
      }),
    );
    setSummaries(Object.fromEntries(entries));
  }, []);

  React.useEffect(() => {
    if (kids.length) loadSummaries(kids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kids.length]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: 56, paddingHorizontal: S.lg, paddingBottom: S.sm }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: C.navy, letterSpacing: -0.4 }}>My Children</Text>
        <Text style={{ fontSize: 13.5, color: C.sub, marginTop: 3 }}>
          {loading ? 'Loading…' : `${kids.length} linked child${kids.length === 1 ? '' : 'ren'}`}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.navy]} />}
      >
        <ErrorBanner msg={err} />
        {loading ? (
          <View style={{ gap: 8 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : kids.length === 0 ? (
          <Card>
            <EmptyState glyph="◉" title="No children linked" hint="Ask your academy administrator to link your child to this account." />
          </Card>
        ) : (
          <>
            <SectionHeader title="Linked athletes" hint="Tap a child for the full profile" />
            {kids.map((k) => {
              const s = summaries[k.id];
              return (
                <PressCard key={k.id} onPress={() => onOpenChild(k.id)} label={`Open ${childName(k)}`} style={{ marginBottom: S.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Avatar name={childName(k)} size={54} uri={mediaUrl(k.photo)} />
                    <View style={{ flex: 1, marginLeft: S.md }}>
                      <Text style={{ fontWeight: '800', color: C.navy, fontSize: 16.5 }} numberOfLines={1}>
                        {childName(k)}
                      </Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                        {k.student_id}{k.sport_name ? ` · ${k.sport_name}` : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                        <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.greenBd, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                          <Text style={{ color: C.green, fontWeight: '800', fontSize: 11.5 }}>
                            ✓ {s ? `${s.pct}%` : '—'}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: (s?.due ?? 0) > 0 ? C.amberSoft : C.greyBg, borderWidth: 1, borderColor: (s?.due ?? 0) > 0 ? C.amberBd : C.greyBd, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                          <Text style={{ color: (s?.due ?? 0) > 0 ? C.amber : C.greyFg, fontWeight: '800', fontSize: 11.5 }}>
                            {(s?.due ?? 0) > 0 ? `${inr(s!.due)} due` : 'Fees clear'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={{ color: C.faint, fontWeight: '900', fontSize: 20, marginLeft: 6 }}>›</Text>
                  </View>
                </PressCard>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}
