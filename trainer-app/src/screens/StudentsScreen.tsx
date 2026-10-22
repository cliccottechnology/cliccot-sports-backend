import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { loadCoachData, type CoachData, type StudentEntry } from '../coach';
import { AppHeader, Avatar, Card, EmptyState, ErrorBanner, PressCard, SearchBar, SectionHeader, SkeletonCard } from '../components/ui';
import { C, S } from '../theme';

export default function StudentsScreen({ onStudent }: { onStudent: (s: StudentEntry) => void }) {
  const [data, setData] = useState<CoachData | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'ref' | 'noref'>('all');
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    loadCoachData()
      .then(setData)
      .catch((e: any) => setErr(e?.response?.data?.message || e?.message || "Couldn't load students."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const all = data?.students || [];
  const refCount = all.filter((s) => s.hasRef).length;
  const list = all.filter(
    (s) =>
      (!q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase()) || (s.student_id || '').toLowerCase().includes(q.trim().toLowerCase())) &&
      (filter === 'all' || (filter === 'ref' ? s.hasRef : !s.hasRef)),
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        eyebrow="MY SQUAD"
        title="Athletes"
        subtitle={loading ? 'Loading your roster…' : `${all.length} athletes · ${refCount} AI-ready with reference photos`}
      >
        <SearchBar value={q} onChange={setQ} placeholder="Search by name or athlete ID" />
      </AppHeader>
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 30 }}>
        <ErrorBanner msg={err} />
        <View style={{ flexDirection: 'row', marginBottom: S.md }}>
          {(
            [
              { k: 'all', label: `All · ${all.length}` },
              { k: 'ref', label: `AI-ready · ${refCount}` },
              { k: 'noref', label: `Needs photo · ${all.length - refCount}` },
            ] as const
          ).map((f) => (
            <Pressable
              key={f.k}
              onPress={() => setFilter(f.k)}
              style={{
                paddingVertical: 9,
                paddingHorizontal: 14,
                borderRadius: 999,
                marginRight: 8,
                backgroundColor: filter === f.k ? C.navy : '#fff',
                borderWidth: 1.5,
                borderColor: filter === f.k ? C.navy : C.line,
              }}
            >
              <Text style={{ color: filter === f.k ? '#fff' : C.text, fontWeight: '800', fontSize: 12.5 }}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
        <SectionHeader title={q ? `Results (${list.length})` : `All athletes (${list.length})`} hint="Tap an athlete to manage reference photos" />
        {loading ? (
          <View style={{ gap: 8 }}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
        ) : list.length === 0 ? (
          <Card><EmptyState glyph="◉" title={q ? `No match for “${q}”` : 'No athletes yet'} hint="Try a different search, or check your assigned batches." /></Card>
        ) : (
          list.map((s) => (
            <PressCard key={s.student} onPress={() => onStudent(s)} label={s.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar name={s.name} size={46} />
                <View style={{ flex: 1, marginLeft: S.md }}>
                  <Text style={{ fontWeight: '800', color: C.text, fontSize: 15 }} numberOfLines={1}>{s.name}</Text>
                  <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                    {s.student_id || `#${s.student}`}
                    {s.sport ? `  ·  ${s.sport}` : ''}
                    {s.batch ? `  ·  ${s.batch}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: s.hasRef ? C.greenSoft : C.greyBg, borderWidth: 1, borderColor: s.hasRef ? C.greenBd : C.greyBd }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: s.hasRef ? C.green : C.greyFg, letterSpacing: 0.4 }}>
                        {s.hasRef ? `✓ AI-READY${s.refCount ? ` · ${s.refCount}` : ''}` : '○ NEEDS PHOTO'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={{ color: C.faint, fontWeight: '900', fontSize: 20, marginLeft: 6 }}>›</Text>
              </View>
            </PressCard>
          ))
        )}
      </ScrollView>
    </View>
  );
}
