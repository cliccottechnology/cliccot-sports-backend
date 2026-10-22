import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { invalidateCoachData, loadCoachData, type CoachData } from '../coach';
import { DaypartIcon, daypart } from '../components/tabs';
import type { Tab } from '../components/tabs';
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
import { C, S, fmtDate, fmtTime, greeting, inr } from '../theme';
import { academyBrand, academyAchievements, coachMe, DEFAULT_BRAND, myCheckins, refreshAcademyBrand, type AcademyBrand, type Achievement, type CheckIn, type CoachMe, feeSummary, notifications, type FeeSummary, type AppNotification, type Me, type SessionItem } from '../api';

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
  onSession,
  onTab,
  onFees,
  onNotifications,
  onAchievements,
}: {
  user: Me;
  onSession: (s: SessionItem) => void;
  onTab: (t: Tab) => void;
  onFees: () => void;
  onNotifications: () => void;
  onAchievements: () => void;
}) {
  const [data, setData] = useState<CoachData | null>(null);
  const [fees, setFees] = useState<FeeSummary | null>(null);
  const [notes, setNotes] = useState<AppNotification[]>([]);
  const [brand, setBrand] = useState<AcademyBrand>(DEFAULT_BRAND);
  const [coach, setCoach] = useState<CoachMe | null>(null);
  const [checkins, setCheckins] = useState<Record<number, CheckIn>>({});
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setErr('');
    const [d, f, n, b, c, ci, ah] = await Promise.all([
      loadCoachData(),
      feeSummary().catch(() => null),
      notifications().catch(() => []),
      academyBrand().catch(() => DEFAULT_BRAND),
      coachMe().catch(() => null),
      myCheckins().catch(() => []),
      academyAchievements().catch(() => []),
    ]);
    setData(d);
    setFees(f);
    setNotes(Array.isArray(n) ? n : []);
    setBrand(b);
    setCoach(c);
    setCheckins(Object.fromEntries(ci.map((x) => [x.session, x])));
    setAchievements(Array.isArray(ah) ? ah.slice(0, 3) : []);
    if (typeof document !== 'undefined' && b?.name) document.title = `${b.name} — Trainer App`;
  };
  React.useEffect(() => {
    load()
      .catch((e: any) => setErr(e?.response?.data?.message || e?.message || "Couldn't load home."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefer the coach's real name: login account → coach record → username.
  const name =
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    [coach?.first_name, coach?.last_name].filter(Boolean).join(' ') ||
    user.username;
  const refresh = async () => {
    setRefreshing(true);
    invalidateCoachData();
    refreshAcademyBrand();
    try {
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };
  const sessions = data?.today || [];
  const doneCount = sessions.filter(
    (s) =>
      (data?.doneBySession[s.id]?.done ?? 0) > 0 &&
      (data?.doneBySession[s.id]?.done ?? 0) >= (data?.doneBySession[s.id]?.total ?? 0),
  ).length;
  const pending = sessions.length - doneCount;
  const sports = [...new Set((data?.my || []).map((s) => s.sport_name).filter(Boolean))];
  const batches = [...new Set((data?.my || []).map((s) => s.batch_name).filter(Boolean))];
  const students = data?.students.length || 0;
  const unread = notes.filter((n) => !n.is_read).length;
  const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const pct = sessions.length ? Math.round((doneCount / sessions.length) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        eyebrow={`${greeting()}  ·  ${todayStr.toUpperCase()}`}
        title={`Hello, ${name.split(' ')[0] || 'Coach'}`}
        subtitle={
          loading
            ? 'Loading your academy overview…'
            : `${sports.length} sport${sports.length === 1 ? '' : 's'} · ${batches.length} batch${batches.length === 1 ? '' : 'es'} · ${students} athlete${students === 1 ? '' : 's'}`
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
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 16, padding: S.md }}>
          <Avatar name={name} size={44} ring />
          <View style={{ flex: 1, marginLeft: S.md }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14.5 }} numberOfLines={1}>
              {loading ? 'Preparing dashboard…' : `${doneCount} of ${sessions.length} sessions complete`}
            </Text>
            <ProgressBar pct={pct} />
          </View>
          <View style={{ backgroundColor: '#fff', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, marginLeft: S.md }}>
            <Text style={{ color: C.navy, fontWeight: '900', fontSize: 12 }}>{pct}%</Text>
          </View>
        </View>
        <BrandPill text={brand.name.toUpperCase()} />
      </AppHeader>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.navy]} />}
      >
        <ErrorBanner msg={err} />

        {loading ? (
          <View style={{ gap: 8 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <StatCard glyph="◷" value={`${doneCount}/${sessions.length}`} label="Today's sessions" tint={C.greenSoft} fg={C.green} />
              <StatCard glyph="◔" value={String(pending)} label="Awaiting attendance" tint={C.amberSoft} fg={C.amber} />
              <StatCard glyph="◉" value={String(students)} label="My athletes" tint={C.navySoft} fg={C.navy} />
            </View>

            <SectionHeader title="Quick actions" hint="Jump straight into your coaching workflow" />
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <QuickAction glyph="◷" tint={C.navySoft} fg={C.navy} label="Sessions" sub={`${pending} pending`} badge={pending} onPress={() => onTab('sessions')} />
              <QuickAction glyph="✓" tint={C.tealSoft} fg={C.teal} label="My Attend." sub="Check yourself in" onPress={() => onTab('attendance')} />
              <QuickAction glyph="◉" tint={C.violetSoft} fg={C.violet} label="Athletes" sub={`${students} total`} onPress={() => onTab('students')} />
            </View>
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
              <QuickAction glyph="▤" tint={C.tealSoft} fg={C.teal} label="Reports" sub="History" onPress={() => onTab('reports')} />
              <QuickAction glyph="₹" tint={C.goldSoft} fg={C.amber} label="My Fees" sub={fees && fees.payable > 0 ? inr(fees.payable) : 'Settled'} onPress={onFees} />
              <QuickAction glyph="◎" tint={C.accentSoft} fg={C.accentDeep} label="Inbox" sub={unread ? `${unread} new` : 'Caught up'} badge={unread} onPress={onNotifications} />
            </View>
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
              <QuickAction glyph="☺" tint={C.greenSoft} fg={C.green} label="Profile" sub="Settings" onPress={() => onTab('profile')} />
            </View>

            {fees ? (
              <PressCard onPress={onFees} label="View trainer fees" style={{ marginTop: S.md, padding: 0, overflow: 'hidden' }}>
                <View style={{ backgroundColor: C.navyDeep, padding: S.lg, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: 'rgba(255,107,44,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FFB37E', fontWeight: '900', fontSize: 22 }}>₹</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: S.md }}>
                    <Text style={{ fontWeight: '800', color: '#fff', fontSize: 15 }}>Trainer earnings</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12.5, marginTop: 2 }}>
                      {inr(fees.payable)} payable · {inr(fees.paid)} paid out
                    </Text>
                  </View>
                  <Text style={{ color: '#FFB37E', fontWeight: '900', fontSize: 20 }}>›</Text>
                </View>
              </PressCard>
            ) : null}

            <SectionHeader
              title="Inbox"
              hint={unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'Academy updates and announcements'}
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
                    {!n.is_read ? (
                      <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: C.accent, marginRight: 10 }} />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5 }} numberOfLines={1}>{n.title}</Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>{n.message}</Text>
                    </View>
                    <Text style={{ color: C.faint, fontWeight: '800', fontSize: 16, marginLeft: 8 }}>›</Text>
                  </View>
                </PressCard>
              ))
            )}

            <SectionHeader
              title="Institute achievements"
              hint="Wins and honours from your academy"
              action={
                <Pressable onPress={onAchievements} accessibilityRole="button" style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 }}>
                  <Text style={{ color: C.navy, fontWeight: '800', fontSize: 12.5 }}>View all ›</Text>
                </Pressable>
              }
            />
            {achievements.length === 0 ? null : (
              achievements.map((a) => (
                <PressCard key={a.id} onPress={onAchievements} label={a.title}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <IconBubble glyph="★" bg={C.goldSoft} fg={C.amber} size={42} />
                    <View style={{ flex: 1, marginLeft: S.md }}>
                      <Text style={{ fontWeight: '800', color: C.text, fontSize: 14 }} numberOfLines={1}>{a.title}</Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                        {a.date}{a.sport_name ? ` · ${a.sport_name}` : ''}
                      </Text>
                    </View>
                    <Text style={{ color: C.faint, fontWeight: '800', fontSize: 16, marginLeft: 8 }}>›</Text>
                  </View>
                </PressCard>
              ))
            )}

            <SectionHeader title="Today's sessions" hint={`${sessions.length} scheduled · ${pending} need check-in`} />
            {sessions.length === 0 ? (
              <Card><EmptyState glyph="◷" title="No sessions today" hint="Enjoy the rest day — tomorrow's schedule will appear here." /></Card>
            ) : (
              sessions.map((s) => {
                const st = data?.doneBySession[s.id];
                const complete = !!st && st.total > 0 && st.done >= st.total;
                return (
                  <PressCard key={s.id} onPress={() => onSession(s)} label={`${s.batch_name} session`}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <DaypartIcon start={s.start_time} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15.5 }} numberOfLines={1}>
                          {daypart(s.start_time)} · {s.batch_name}
                        </Text>
                        <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                          {complete ? '✓ Check-in complete' : '○ Check-in pending'} · {fmtDate(s.date)} · {fmtTime(s.start_time)}
                        </Text>
                        {st && st.total > 0 ? (
                          <View style={{ height: 5, borderRadius: 3, backgroundColor: C.greyBg, marginTop: 7, overflow: 'hidden' }}>
                            <View style={{ height: 5, borderRadius: 3, width: `${Math.round((st.done / st.total) * 100)}%`, backgroundColor: complete ? C.green : C.accent }} />
                          </View>
                        ) : null}
                      </View>
                      <View style={{ marginLeft: S.sm, alignItems: 'flex-end', gap: 6 }}>
                        <Badge status={complete ? 'completed' : 'scheduled'} />
                        {checkins[s.id] ? (
                          <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.greenBd, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                            <Text style={{ color: C.green, fontWeight: '800', fontSize: 11.5 }}>
                              {checkins[s.id].status === 'present' ? '✓ ' : `${checkins[s.id].status} · `}
                              {checkins[s.id].marked_at ? checkins[s.id].marked_at!.slice(11, 16) : 'IN'}
                            </Text>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => onTab('attendance')}
                            accessibilityRole="button"
                            accessibilityLabel={`Mark my attendance for ${s.batch_name}`}
                            style={{ backgroundColor: C.accent, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 }}
                          >
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11.5 }}>MARK ME</Text>
                          </Pressable>
                        )}
                        <Text style={{ color: C.accentDeep, fontWeight: '900', fontSize: 18 }}>›</Text>
                      </View>
                    </View>
                  </PressCard>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
