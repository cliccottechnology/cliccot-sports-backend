import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { markNotificationRead, notifications, type AppNotification } from '../api';
import { AppHeader, Card, EmptyState, ErrorBanner, IconBubble, SectionHeader, SkeletonCard } from '../components/ui';
import { C, S } from '../theme';

export default function NotificationsScreen({ onBack, onChanged }: { onBack: () => void; onChanged: () => void }) {
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setErr('');
    try {
      setRows(await notifications());
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Couldn't load notifications.");
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markRead = async (id: number) => {
    setBusyId(id);
    try {
      await markNotificationRead(id);
      setRows((rs) => rs.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      onChanged();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Couldn't mark as read.");
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    const unread = rows.filter((n) => !n.is_read);
    for (const n of unread) {
      try {
        await markNotificationRead(n.id);
      } catch {
        /* keep going */
      }
    }
    setRows((rs) => rs.map((n) => ({ ...n, is_read: true })));
    onChanged();
  };

  const unread = rows.filter((n) => !n.is_read).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        onBack={onBack}
        eyebrow="STAY IN THE LOOP"
        title="Notifications"
        subtitle={loading ? 'Loading your inbox…' : unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'} waiting` : 'All caught up — nice work, Coach'}
        right={
          unread > 0 ? (
            <Pressable onPress={markAll} accessibilityRole="button" style={{ backgroundColor: C.accent, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 15 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>✓ Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 30 }}>
        <ErrorBanner msg={err} />
        {loading ? (
          <View style={{ gap: 8 }}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
        ) : rows.length === 0 ? (
          <Card><EmptyState glyph="◎" title="No notifications" hint="Academy announcements, fee updates and schedule changes will land here." /></Card>
        ) : (
          <>
            <SectionHeader title={unread > 0 ? `Unread · ${unread}` : 'Inbox'} hint="Tap “Mark read” to clear items" />
            {rows.map((n) => (
              <Card
                key={n.id}
                style={{
                  marginBottom: S.sm,
                  padding: S.md,
                  opacity: n.is_read ? 0.8 : 1,
                  borderWidth: n.is_read ? 1 : 1.5,
                  borderColor: n.is_read ? C.line : C.accent,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconBubble glyph={n.is_read ? '✓' : '◎'} bg={n.is_read ? C.greyBg : C.accentSoft} fg={n.is_read ? C.greyFg : C.accentDeep} size={40} />
                  <Text style={{ fontWeight: '800', color: C.text, flex: 1, fontSize: 14.5, marginLeft: S.md }} numberOfLines={1}>{n.title}</Text>
                  {!n.is_read ? <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: C.accent, marginLeft: 8 }} /> : null}
                </View>
                <Text style={{ color: C.sub, fontSize: 13.5, marginTop: 8, lineHeight: 19 }}>{n.message}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ color: C.faint, fontSize: 12, flex: 1, fontWeight: '600' }}>
                    {n.created_at ? n.created_at.slice(0, 16).replace('T', ' · ') : ''}
                  </Text>
                  {!n.is_read ? (
                    <Pressable
                      onPress={() => markRead(n.id)}
                      disabled={busyId === n.id}
                      style={{ backgroundColor: C.navySoft, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 }}
                    >
                      <Text style={{ color: C.navy, fontWeight: '800', fontSize: 12.5 }}>
                        {busyId === n.id ? 'Marking…' : 'Mark read'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={{ color: C.green, fontWeight: '800', fontSize: 12 }}>✓ READ</Text>
                  )}
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
