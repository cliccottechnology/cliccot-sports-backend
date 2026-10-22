import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  AppHeader,
  Card,
  EmptyState,
  ErrorBanner,
  IconBubble,
  SkeletonCard,
} from '../components/ui';
import { C, S, fmtDateTime } from '../theme';
import {
  markAllNotificationsRead,
  markNotificationRead,
  notifications,
  type AppNotification,
} from '../api';

export default function NotificationsScreen({ onBack, onChanged }: { onBack: () => void; onChanged: () => void }) {
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [err, setErr] = React.useState('');

  const load = React.useCallback(async () => {
    setErr('');
    try {
      const n = await notifications();
      setItems(Array.isArray(n) ? n : []);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const open = async (n: AppNotification) => {
    if (n.is_read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    try {
      await markNotificationRead(n.id);
      onChanged();
    } catch {
      load();
    }
  };

  const allRead = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    try {
      await markAllNotificationsRead();
      onChanged();
    } catch {
      load();
    }
  };

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        onBack={onBack}
        eyebrow="INBOX"
        title="Notices"
        subtitle={unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'You are all caught up'}
        right={
          unread > 0 ? (
            <Pressable onPress={allRead} accessibilityRole="button" style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Mark all</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: S.lg, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.navy]} />}
      >
        <ErrorBanner msg={err} />
        {loading ? (
          <View style={{ gap: 8 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : items.length === 0 ? (
          <Card><EmptyState glyph="◎" title="No notices yet" hint="Academy announcements and updates will appear here." /></Card>
        ) : (
          items.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => open(n)}
              accessibilityRole="button"
              accessibilityLabel={n.title}
              style={({ pressed }) => [
                {
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: n.is_read ? C.line : '#C7D3F4',
                  padding: S.lg,
                  marginBottom: S.sm,
                  flexDirection: 'row',
                },
                pressed && { opacity: 0.95 },
              ]}
            >
              <IconBubble glyph={n.is_read ? '◎' : '◉'} bg={n.is_read ? C.greyBg : C.accentSoft} fg={n.is_read ? C.greyFg : C.accentDeep} size={42} />
              <View style={{ flex: 1, marginLeft: S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5, flex: 1 }} numberOfLines={1}>{n.title}</Text>
                  {!n.is_read ? <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: C.accent, marginLeft: 8 }} /> : null}
                </View>
                <Text style={{ color: C.sub, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{n.message}</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 6 }}>
                  {n.created_at ? fmtDateTime(n.created_at) : ''}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
