import React, { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { academyAchievements, type Achievement } from '../api';
import { AppHeader, Card, EmptyState, ErrorBanner, IconBubble, SkeletonCard } from '../components/ui';
import { C, S } from '../theme';

export default function AchievementsScreen({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Achievement[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    academyAchievements()
      .then(setRows)
      .catch((e: any) => setErr(e?.response?.data?.message || e?.message || "Couldn't load achievements."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        onBack={onBack}
        eyebrow="INSTITUTE PRIDE"
        title="Achievements"
        subtitle="Tournament wins, milestones and honours from your academy."
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 30 }}>
        <ErrorBanner msg={err} />
        {loading ? (
          <View style={{ gap: 8 }}><SkeletonCard /><SkeletonCard /></View>
        ) : rows.length === 0 ? (
          <Card><EmptyState glyph="★" title="No achievements yet" hint="The academy's wins will shine here." /></Card>
        ) : (
          rows.map((a) => (
            <Card key={a.id} style={{ marginBottom: S.sm, padding: S.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {a.photo ? (
                  <Image source={{ uri: a.photo }} style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: C.line }} />
                ) : (
                  <IconBubble glyph="★" bg={C.goldSoft} fg={C.amber} size={56} />
                )}
                <View style={{ flex: 1, marginLeft: S.md }}>
                  <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15 }} numberOfLines={2}>{a.title}</Text>
                  <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                    {a.date}{a.sport_name ? ` · ${a.sport_name}` : ''}
                  </Text>
                </View>
              </View>
              {a.description ? (
                <Text style={{ color: C.sub, fontSize: 13.5, marginTop: 8, lineHeight: 19 }}>{a.description}</Text>
              ) : null}
              {a.photo ? (
                <Pressable onPress={() => Linking.openURL(a.photo!)} style={{ marginTop: 8 }}>
                  <Text style={{ color: C.accentDeep, fontWeight: '800', fontSize: 13 }}>View photo ›</Text>
                </Pressable>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
