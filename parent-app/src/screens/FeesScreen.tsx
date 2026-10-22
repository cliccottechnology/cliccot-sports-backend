import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
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
import { C, S, fmtDayDate, inr } from '../theme';
import { childName, num } from '../util';
import { useChildren } from '../children';
import { childFees, payments, type Fee, type Payment } from '../api';

export default function FeesScreen({
  selChildId,
  onSelectChild,
}: {
  selChildId: number | null;
  onSelectChild: (id: number) => void;
}) {
  const { kids, sel, loading, err, reload } = useChildren(selChildId, onSelectChild);
  const [fees, setFees] = React.useState<Fee[]>([]);
  const [pays, setPays] = React.useState<Payment[]>([]);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadChild = React.useCallback(async (id: number) => {
    setLoadingDetail(true);
    try {
      const [f, allPays] = await Promise.all([
        childFees(id).catch(() => [] as Fee[]),
        payments().catch(() => [] as Payment[]),
      ]);
      setFees(f);
      const feeIds = new Set(f.map((x) => x.id));
      setPays(allPays.filter((p) => feeIds.has(p.student_fee)));
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

  const open = fees.filter((f) => !['paid', 'cancelled', 'refunded'].includes(f.status));
  const dueAmount = open.reduce((a, f) => a + num(f.balance ?? num(f.amount) - num(f.paid_total)), 0);
  const totalBilled = fees.reduce((a, f) => a + num(f.amount), 0);
  const totalPaid = fees.reduce((a, f) => a + num(f.paid_total), 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: 56, paddingHorizontal: S.lg, paddingBottom: S.sm }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: C.navy, letterSpacing: -0.4 }}>Fees & Payments</Text>
        <Text style={{ fontSize: 13.5, color: C.sub, marginTop: 3 }}>
          {loading ? 'Loading…' : sel ? `${childName(sel)}'s fee account` : 'No child selected'}
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
          <Card><EmptyState glyph="₹" title="No children linked" hint="Fee records appear once a child is linked." /></Card>
        ) : (
          <>
            {kids.length > 1 ? (
              <>
                <SectionHeader title="Select child" />
                <ChildSelector kids={kids} selId={sel?.id ?? null} onSelect={onSelectChild} />
              </>
            ) : null}

            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: kids.length > 1 ? 0 : S.md }}>
              <StatCard glyph="₹" value={inr(dueAmount)} label="Outstanding" tint={dueAmount > 0 ? C.amberSoft : C.greenSoft} fg={dueAmount > 0 ? C.amber : C.green} />
              <StatCard glyph="✓" value={inr(totalPaid)} label="Paid" tint={C.greenSoft} fg={C.green} />
              <StatCard glyph="▤" value={inr(totalBilled)} label="Billed" tint={C.navySoft} fg={C.navy} />
            </View>

            {dueAmount > 0 ? (
              <Card style={{ marginTop: S.md, backgroundColor: C.accentTint, borderColor: '#C7D3F4' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconBubble glyph="!" bg={C.accentSoft} fg={C.accentDeep} size={44} />
                  <View style={{ flex: 1, marginLeft: S.md }}>
                    <Text style={{ fontWeight: '800', color: C.navy, fontSize: 14.5 }}>{inr(dueAmount)} outstanding</Text>
                    <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                      {open.length} open item{open.length === 1 ? '' : 's'} · contact the academy office to pay
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}

            <SectionHeader title="Fee allocation" hint={fees.length ? `${fees.length} record${fees.length === 1 ? '' : 's'}` : 'All settled'} />
            {loadingDetail ? (
              <SkeletonCard />
            ) : fees.length === 0 ? (
              <Card><EmptyState glyph="₹" title="No fees allocated" hint="Fee records for this child appear here." /></Card>
            ) : (
              fees.map((f) => {
                const bal = num(f.balance ?? num(f.amount) - num(f.paid_total));
                return (
                  <Card key={f.id} style={{ marginBottom: S.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5 }}>{f.period_label}</Text>
                        <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 3 }}>
                          Amount {inr(f.amount)} · Paid {inr(num(f.paid_total))}
                        </Text>
                        <Text style={{ color: C.faint, fontSize: 12, marginTop: 1 }}>
                          {f.due_date ? `Due ${fmtDayDate(f.due_date)}` : ''}{bal > 0 ? ` · Balance ${inr(bal)}` : ''}
                        </Text>
                      </View>
                      <Badge status={f.status} />
                    </View>
                  </Card>
                );
              })
            )}

            <SectionHeader title="Payment receipts" hint={pays.length ? `${pays.length} transaction${pays.length === 1 ? '' : 's'}` : 'No payments yet'} />
            {pays.length === 0 ? (
              <Card><EmptyState glyph="▤" title="No payments recorded" hint="Verified payments and receipts appear here." /></Card>
            ) : (
              pays.map((p) => (
                <Card key={p.id} style={{ marginBottom: S.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <IconBubble glyph="₹" bg={p.status === 'success' ? C.greenSoft : C.greyBg} fg={p.status === 'success' ? C.green : C.greyFg} size={42} />
                    <View style={{ flex: 1, marginLeft: S.md }}>
                      <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5 }}>{inr(p.amount)}</Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                        {p.receipt_no ? `Receipt ${p.receipt_no}` : p.provider ? `${p.provider} · pending` : 'Payment'}
                        {p.created_at ? ` · ${fmtDayDate(p.created_at.slice(0, 10))}` : ''}
                      </Text>
                    </View>
                    <Badge status={p.status} />
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
