import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { Tab } from '../components/tabs';
import { daypart, DaypartIcon } from '../components/tabs';
import ChildSelector from '../components/ChildSelector';
import {
  AppHeader,
  Avatar,
  Badge,
  BrandPill,
  Card,
  EmptyState,
  ErrorBanner,
  HeaderIconBtn,
  IconBubble,
  PressCard,
  ProgressBar,
  SectionHeader,
  SkeletonCard,
  StatCard,
} from '../components/ui';
import { C, S, fmtDate, fmtTime, greeting, inr, STATUS_STYLE } from '../theme';
import { attendanceStats, certLabel, childName, num } from '../util';
import { useChildren } from '../children';
import {
  academyBrand,
  certificateEligibility,
  childAttendance,
  childFees,
  childSessions,
  notifications,
  parentMe,
  payments,
  mediaUrl,
  refreshAcademyBrand,
  DEFAULT_BRAND,
  type AcademyBrand,
  type AppNotification,
  type AttendanceRec,
  type CertEligibility,
  type Fee,
  type Me,
  type ParentProfile,
  type Payment,
  type SessionItem,
} from '../api';

function QuickAction({
  glyph,
  tint,
  fg,
  label,
  sub,
  badge,
  onPress,
}: {
  glyph: string;
  tint: string;
  fg: string;
  label: string;
  sub?: string;
  badge?: number | string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flex: 1,
          minWidth: '30%',
          backgroundColor: '#fff',
          borderRadius: 18,
          padding: S.md,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: C.line,
        },
        pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View>
        <IconBubble glyph={glyph} bg={tint} fg={fg} size={44} />
        {badge != null && badge !== 0 && badge !== '' ? (
          <View
            style={{
              position: 'absolute',
              top: -6,
              right: -10,
              backgroundColor: C.accent,
              borderRadius: 999,
              paddingVertical: 2,
              paddingHorizontal: 8,
              borderWidth: 2,
              borderColor: '#fff',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10.5 }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontWeight: '800', color: C.navy, fontSize: 12.5, textAlign: 'center', marginTop: 8 }}>{label}</Text>
      {sub ? <Text style={{ color: C.faint, fontSize: 11, fontWeight: '600', marginTop: 1 }}>{sub}</Text> : null}
    </Pressable>
  );
}

export default function HomeScreen({
  user,
  selChildId,
  onSelectChild,
  onTab,
  onNotifications,
  onSupport,
  onOpenChild,
}: {
  user: Me;
  selChildId: number | null;
  onSelectChild: (id: number) => void;
  onTab: (t: Tab) => void;
  onNotifications: () => void;
  onSupport: () => void;
  onOpenChild: (id: number) => void;
}) {
  const { kids, sel, loading: kidsLoading, err: kidsErr, reload } = useChildren(selChildId, onSelectChild);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [att, setAtt] = useState<AttendanceRec[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [notes, setNotes] = useState<AppNotification[]>([]);
  const [pays, setPays] = useState<Payment[]>([]);
  const [eligRows, setEligRows] = useState<CertEligibility[]>([]);
  const [brand, setBrand] = useState<AcademyBrand>(DEFAULT_BRAND);
  const [err, setErr] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadShared = async () => {
    const [p, n, b, el] = await Promise.all([
      parentMe().catch(() => null),
      notifications().catch(() => []),
      academyBrand().catch(() => DEFAULT_BRAND),
      certificateEligibility().catch(() => [] as CertEligibility[]),
    ]);
    setProfile(p);
    setNotes(Array.isArray(n) ? n : []);
    setBrand(b);
    setEligRows(Array.isArray(el) ? el : []);
    if (typeof document !== 'undefined' && b?.name) document.title = `${b.name} — Parent App`;
  };

  const loadChild = async (id: number) => {
    setLoadingDetail(true);
    try {
      const [a, f, s, allPays] = await Promise.all([
        childAttendance(id).catch(() => []),
        childFees(id).catch(() => []),
        childSessions(id, 5).catch(() => []),
        payments().catch(() => []),
      ]);
      setAtt(a);
      setFees(f);
      setSessions(s);
      const feeIds = new Set(f.map((x) => x.id));
      setPays(allPays.filter((p) => feeIds.has(p.student_fee)));
    } finally {
      setLoadingDetail(false);
    }
  };

  React.useEffect(() => {
    loadShared().catch((e: any) => setErr(e?.response?.data?.message || e?.message || 'Could not load your dashboard.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (sel?.id) loadChild(sel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id]);

  const refresh = async () => {
    setRefreshing(true);
    refreshAcademyBrand();
    try {
      await Promise.all([loadShared(), reload()]);
      if (sel?.id) await loadChild(sel.id);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const stats = attendanceStats(att);
  const latestAtt = [...att]
    .filter((r) => r.status !== 'not_marked')
    .sort((a, b) => (b.marked_at || '').localeCompare(a.marked_at || ''))[0];
  const dueFees = fees.filter((f) => !['paid', 'cancelled', 'refunded'].includes(f.status));
  const dueAmount = dueFees.reduce((a, f) => a + num(f.balance ?? num(f.amount) - num(f.paid_total)), 0);
  const unread = notes.filter((n) => !n.is_read).length;
  const elig = eligRows.find((r) => r.student === sel?.id) || null;
  const cert = certLabel(elig?.state);
  const upcoming = sessions
    .filter((s) => s.status === 'scheduled' || s.status === 'in_progress')
    .filter((s) => !s.date || s.date >= new Date().toISOString().slice(0, 10))
    .slice(0, 4);
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const loading = kidsLoading;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        eyebrow={`${greeting()}  ·  ${todayStr.toUpperCase()}`}
        title={`Hello, ${name.split(' ')[0] || 'Parent'}`}
        subtitle={
          loading
            ? 'Loading your family overview…'
            : kids.length
              ? `${kids.length} linked child${kids.length === 1 ? '' : 'ren'}`
              : 'No children linked yet'
        }
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <HeaderIconBtn label="⟳" onPress={refresh} />
            <View>
              <HeaderIconBtn label={unread > 0 ? '◉' : '◎'} onPress={onNotifications} />
              {unread > 0 ? (
                <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.accent, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>{unread}</Text>
                </View>
              ) : null}
            </View>
          </View>
        }
      >
        {sel ? (
          <Pressable
            onPress={() => onOpenChild(sel.id)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${childName(sel)}`}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 16, padding: S.md }}
          >
            <Avatar name={childName(sel)} size={44} ring uri={mediaUrl(sel.photo)} />
            <View style={{ flex: 1, marginLeft: S.md }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14.5 }} numberOfLines={1}>
                {childName(sel)}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                {sel.student_id}{sel.sport_name ? ` · ${sel.sport_name}` : ''}
              </Text>
              <ProgressBar pct={stats.pct} bar={C.accent} />
              {latestAtt ? (
                <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11.5, marginTop: 4 }} numberOfLines={1}>
                  Latest {STATUS_STYLE[latestAtt.status]?.label || latestAtt.status}
                  {latestAtt.marked_at ? ` · ${fmtDate(latestAtt.marked_at.slice(0, 10))}` : ''}
                </Text>
              ) : null}
            </View>
            <View style={{ backgroundColor: '#fff', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, marginLeft: S.md }}>
              <Text style={{ color: C.navy, fontWeight: '900', fontSize: 12 }}>{stats.pct}%</Text>
            </View>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 16, padding: S.md }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>No linked children yet</Text>
          </View>
        )}
        <BrandPill text={brand.name.toUpperCase()} />
      </AppHeader>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.navy]} />}
      >
        <ErrorBanner msg={err || kidsErr} />

        {loading ? (
          <View style={{ gap: 8 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : kids.length === 0 ? (
          <Card>
            <EmptyState
              glyph="◉"
              title="No children linked yet"
              hint="Ask your academy administrator to link your child to this account."
            />
          </Card>
        ) : (
          <>
            {kids.length > 1 ? (
              <>
                <SectionHeader title="Select child" hint="Choose which child to view" />
                <ChildSelector kids={kids} selId={sel?.id ?? null} onSelect={onSelectChild} />
              </>
            ) : null}

            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: kids.length > 1 ? 0 : S.md }}>
              <StatCard glyph="✓" value={`${stats.pct}%`} label="Attendance" tint={C.greenSoft} fg={C.green} />
              <StatCard glyph="₹" value={dueAmount > 0 ? inr(dueAmount) : 'Clear'} label="Fees due" tint={dueAmount > 0 ? C.amberSoft : C.greenSoft} fg={dueAmount > 0 ? C.amber : C.green} />
              <StatCard glyph="◷" value={String(upcoming.length)} label="Upcoming" tint={C.navySoft} fg={C.navy} />
            </View>

            <SectionHeader title="Quick actions" hint={`Everything for ${sel ? sel.first_name : 'your child'}`} />
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <QuickAction glyph="◉" tint={C.navySoft} fg={C.navy} label="Children" sub={`${kids.length} linked`} onPress={() => onTab('children')} />
              <QuickAction glyph="✓" tint={C.tealSoft} fg={C.teal} label="Attendance" sub={`${stats.pct}% this period`} onPress={() => onTab('attendance')} />
              <QuickAction glyph="₹" tint={C.goldSoft} fg={C.amber} label="Fees" sub={dueAmount > 0 ? inr(dueAmount) : 'Settled'} onPress={() => onTab('fees')} />
            </View>
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
              <QuickAction glyph="◎" tint={C.accentSoft} fg={C.accentDeep} label="Notices" sub={unread ? `${unread} new` : 'Caught up'} badge={unread} onPress={onNotifications} />
              <QuickAction glyph="✦" tint={C.violetSoft} fg={C.violet} label="Certificates" sub="Milestones" onPress={() => onOpenChild(sel!.id)} />
              <QuickAction glyph="☎" tint={C.greenSoft} fg={C.green} label="Support" sub="Get help" onPress={onSupport} />
            </View>

            <SectionHeader title="Upcoming sessions" hint="Scheduled training for your child" />
            {loadingDetail ? (
              <SkeletonCard />
            ) : upcoming.length === 0 ? (
              <Card>
                <EmptyState glyph="◷" title="No upcoming sessions" hint="The next scheduled sessions will appear here." />
              </Card>
            ) : (
              upcoming.map((s) => (
                <Card key={s.id} style={{ marginBottom: S.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <DaypartIcon start={s.start_time} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15 }} numberOfLines={1}>
                        {daypart(s.start_time)} · {s.batch_name || 'Session'}
                      </Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                        {fmtDate(s.date)} · {fmtTime(s.start_time)}{s.end_time ? `–${fmtTime(s.end_time)}` : ''}
                      </Text>
                      {s.coach_name ? (
                        <Text style={{ color: C.faint, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                          {s.coach_name}{s.location_name ? ` · ${s.location_name}` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <Badge status={s.status} />
                  </View>
                </Card>
              ))
            )}

            <SectionHeader title="Certificate status" hint="Milestone review" />
            {elig ? (
              <PressCard onPress={() => sel && onOpenChild(sel.id)} label="Certificate status">
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconBubble glyph="✦" bg={cert.bg} fg={cert.fg} size={40} />
                  <View style={{ flex: 1, marginLeft: S.md }}>
                    <Text style={{ fontWeight: '800', color: C.text, fontSize: 14 }}>{cert.label}</Text>
                    <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={2}>
                      {elig.milestone_date
                        ? `3-month milestone ${fmtDate(elig.milestone_date)} · issued once approved`
                        : 'Enrolment date pending'}
                    </Text>
                  </View>
                  <Text style={{ color: C.faint, fontWeight: '800', fontSize: 16, marginLeft: 8 }}>›</Text>
                </View>
              </PressCard>
            ) : (
              <Card>
                <EmptyState glyph="✦" title="No certificate record yet" hint="Milestone status appears once your child is enrolled." />
              </Card>
            )}

            <SectionHeader
              title="Recent payments"
              hint={pays.length ? `${pays.length} receipt${pays.length === 1 ? '' : 's'}` : 'Verified payments'}
              action={
                <Pressable onPress={() => onTab('fees')} accessibilityRole="button" style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 }}>
                  <Text style={{ color: C.navy, fontWeight: '800', fontSize: 12.5 }}>View all ›</Text>
                </Pressable>
              }
            />
            {pays.length === 0 ? (
              <Card>
                <EmptyState glyph="▤" title="No payments yet" hint="Verified payments and receipts will appear here." />
              </Card>
            ) : (
              pays.slice(0, 3).map((p) => (
                <PressCard key={p.id} onPress={() => onTab('fees')} label={inr(num(p.amount))}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <IconBubble glyph="₹" bg={p.status === 'success' ? C.greenSoft : C.greyBg} fg={p.status === 'success' ? C.green : C.greyFg} size={40} />
                    <View style={{ flex: 1, marginLeft: S.md }}>
                      <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5 }} numberOfLines={1}>{inr(num(p.amount))}</Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                        {p.receipt_no ? `Receipt ${p.receipt_no}` : p.provider ? `${p.provider} · pending` : 'Payment'}
                        {p.created_at ? ` · ${fmtDate(p.created_at.slice(0, 10))}` : ''}
                      </Text>
                    </View>
                    <Badge status={p.status} />
                  </View>
                </PressCard>
              ))
            )}

            <SectionHeader
              title="Recent notices"
              hint={unread > 0 ? `${unread} unread` : 'Academy updates'}
              action={
                <Pressable onPress={onNotifications} accessibilityRole="button" style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 }}>
                  <Text style={{ color: C.navy, fontWeight: '800', fontSize: 12.5 }}>View all ›</Text>
                </Pressable>
              }
            />
            {notes.length === 0 ? (
              <Card><EmptyState glyph="◎" title="You're all caught up" hint="New academy announcements will appear here." /></Card>
            ) : (
              notes.slice(0, 3).map((n) => (
                <PressCard key={n.id} onPress={onNotifications} label={n.title}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!n.is_read ? <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: C.accent, marginRight: 10 }} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5 }} numberOfLines={1}>{n.title}</Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>{n.message}</Text>
                    </View>
                    <Text style={{ color: C.faint, fontWeight: '800', fontSize: 16, marginLeft: 8 }}>›</Text>
                  </View>
                </PressCard>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
