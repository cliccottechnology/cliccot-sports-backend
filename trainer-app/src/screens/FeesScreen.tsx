import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { feeSummary, myEarnings, myPayables, type Earnings, type FeeSummary, type Payable } from '../api';
import { AppHeader, Badge, Card, EmptyState, ErrorBanner, IconBubble, SectionHeader, SkeletonCard, StatCard } from '../components/ui';
import { C, S, inr } from '../theme';

export default function FeesScreen({ onBack }: { onBack: () => void }) {
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [rows, setRows] = useState<Payable[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [work, setWork] = useState<Earnings | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setErr('');
    setLoading(true);
    try {
      const [s, r, w] = await Promise.all([feeSummary(), myPayables(), myEarnings(period)]);
      setSummary(s);
      setRows(r);
      setWork(w);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Couldn't load trainer fees.");
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        onBack={onBack}
        eyebrow="EARNINGS"
        title="My Trainer Fees"
        subtitle="Payables for your validated completed sessions."
      >
        {!loading && summary ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 16, padding: S.md, flexDirection: 'row', alignItems: 'center' }}>
            <IconBubble glyph="₹" bg="rgba(255,107,44,0.25)" fg="#FFB37E" size={46} />
            <View style={{ flex: 1, marginLeft: S.md }}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11.5, fontWeight: '800', letterSpacing: 1 }}>TOTAL PAYABLE</Text>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }}>{inr(summary.payable)}</Text>
            </View>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' }}>
              <Text style={{ color: C.green, fontSize: 15, fontWeight: '800' }}>{inr(summary.paid)}</Text>
              <Text style={{ color: C.sub, fontSize: 10.5, fontWeight: '800' }}>PAID OUT</Text>
            </View>
          </View>
        ) : null}
      </AppHeader>
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 30 }}>
        <ErrorBanner msg={err} />
        {loading ? (
          <View style={{ gap: 8 }}><SkeletonCard /><SkeletonCard /></View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <StatCard glyph="◔" value={inr(summary?.payable || 0)} label="Payable now" tint={C.amberSoft} fg={C.amber} />
              <StatCard glyph="✓" value={inr(summary?.paid || 0)} label="Paid to date" tint={C.greenSoft} fg={C.green} />
            </View>
            <SectionHeader title="Sessions taken" hint={work ? `${work.from} → ${work.to}` : 'Week / month work summary'} />
            <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.sm }}>
              {(['week', 'month'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: period === p }}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                    backgroundColor: period === p ? C.navy : '#fff',
                    borderWidth: 1.5, borderColor: period === p ? C.navy : C.line,
                  }}
                >
                  <Text style={{ color: period === p ? '#fff' : C.text, fontWeight: '800', fontSize: 13.5 }}>
                    {p === 'week' ? 'This week' : 'This month'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {(() => {
              const earned = (work?.payable_amount || 0) + (work?.paid_amount || 0);
              const paid = work?.paid_amount || 0;
              const bal = work?.balance ?? earned - paid;
              const status = bal <= 0 && earned > 0 ? 'Fully Paid' : paid > 0 ? 'Partially Paid' : 'Pending';
              const avg = work?.payable_count ? Math.round(earned / work.payable_count) : 0;
              const studentBased = work?.method === 'student_based';
              return (
                <>
                  <Card style={{ marginBottom: S.sm, padding: S.md, flexDirection: 'row', alignItems: 'center' }}>
                    <IconBubble glyph="✓" bg={status === 'Fully Paid' ? C.greenSoft : status === 'Partially Paid' ? C.amberSoft : C.greyBg} fg={status === 'Fully Paid' ? C.green : status === 'Partially Paid' ? C.amber : C.greyFg} size={44} />
                    <View style={{ flex: 1, marginLeft: S.md }}>
                      <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15 }}>{status}{studentBased ? ' · Student-based' : ''}</Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                        Earned {inr(earned)} · Paid {inr(paid)} · Balance {inr(bal)}
                      </Text>
                    </View>
                  </Card>
                  {studentBased ? (
                    <View style={{ flexDirection: 'row', gap: S.sm }}>
                      <StatCard glyph="◷" value={String(work?.students_counted ?? '–')} label="Students counted" tint={C.navySoft} fg={C.navy} />
                      <StatCard glyph="◎" value={String(work?.payable_count ?? '–')} label="Salary periods" tint={C.violetSoft} fg={C.violet} />
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: S.sm }}>
                      <StatCard glyph="◷" value={String(work?.sessions_taken ?? '–')} label="Sessions taken" tint={C.navySoft} fg={C.navy} />
                      <StatCard glyph="◉" value={String(work?.payable_count ?? '–')} label="Eligible sessions" tint={C.violetSoft} fg={C.violet} />
                      <StatCard glyph="₹" value={avg ? inr(avg) : '–'} label="Avg rate / session" tint={C.tealSoft} fg={C.teal} />
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
                    <StatCard glyph="₹" value={inr(earned)} label="Earned" tint={C.greenSoft} fg={C.green} />
                    <StatCard glyph="✓" value={inr(paid)} label="Paid out" tint={C.amberSoft} fg={C.amber} />
                    <StatCard glyph="◔" value={inr(bal)} label="Balance" tint={C.accentSoft} fg={C.accentDeep} />
                  </View>
                </>
              );
            })()}
            {(work?.sessions_without_payable || 0) > 0 ? (
              <Card style={{ marginTop: S.sm, padding: S.md }}>
                <Text style={{ color: C.amber, fontWeight: '700', fontSize: 13 }}>
                  {work?.sessions_without_payable} session(s) awaiting payable — the academy will add a matching fee rule and generate it.
                </Text>
              </Card>
            ) : null}
            {(work?.by_day || []).length > 0 ? (
              <Card style={{ marginTop: S.sm, padding: S.md }}>
                {(work?.by_day || []).map((d) => (
                  <View key={d.date} style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
                    <Text style={{ flex: 1, color: C.sub, fontWeight: '600', fontSize: 13 }}>{d.date}</Text>
                    <Text style={{ color: C.text, fontWeight: '800', fontSize: 13 }}>{d.sessions} session{d.sessions === 1 ? '' : 's'} · {inr(d.amount)}</Text>
                  </View>
                ))}
              </Card>
            ) : null}
            <SectionHeader title={`Payables · ${rows.length}`} hint="Newest validated sessions first" />
            {rows.length === 0 ? (
              <Card><EmptyState glyph="₹" title="No payables yet" hint="Complete and validate sessions — earnings appear here automatically." /></Card>
            ) : (
              rows.map((p) => {
                const kindLabel = p.kind && p.kind !== 'session'
                  ? `${p.kind.replace('_salary', '')} salary · ${p.period_start || ''}${p.period_end ? ` → ${p.period_end}` : ''}`
                  : `Session · ${p.session_date || '—'}`;
                return (
                  <Card key={p.id} style={{ marginBottom: S.sm, padding: S.md, flexDirection: 'row', alignItems: 'center' }}>
                    <IconBubble glyph="₹" bg={p.status === 'paid' ? C.greenSoft : C.amberSoft} fg={p.status === 'paid' ? C.green : C.amber} size={44} />
                    <View style={{ flex: 1, marginLeft: S.md }}>
                      <Text style={{ fontWeight: '800', color: C.text, fontSize: 16.5 }}>{inr(p.amount)}</Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                        {kindLabel}
                        {p.trainer_name ? ` · ${p.trainer_name}` : ''}
                      </Text>
                    </View>
                    <Badge status={p.status === 'verified' ? 'fee_verified' : p.status} />
                  </Card>
                );
              })
            )}
            <Pressable onPress={load} style={{ alignSelf: 'center', marginTop: S.md, backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18 }}>
              <Text style={{ color: C.navy, fontWeight: '800', fontSize: 13 }}>⟳  Refresh earnings</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
