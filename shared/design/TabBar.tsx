import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { C, S, shadowSm } from './tokens';

/**
 * Shared bottom tab bar + day-part icon used by BOTH the Parent and Trainer
 * apps. Each app supplies its own tab list, so the chrome stays pixel-identical
 * while the destinations differ.
 */
export type TabConfig<T extends string = string> = { k: T; label: string; glyph: string };

export default function TabBar<T extends string>({
  tabs,
  tab,
  onTab,
  badges,
}: {
  tabs: readonly TabConfig<T>[];
  tab: T;
  onTab: (t: T) => void;
  badges?: Partial<Record<T, number>>;
}) {
  return (
    <View style={{ backgroundColor: C.bg, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 22,
          paddingVertical: 8,
          paddingHorizontal: 6,
          ...shadowSm,
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.k;
          const n = badges?.[t.k] || 0;
          return (
            <Pressable
              key={t.k}
              onPress={() => onTab(t.k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}
            >
              <View style={{ alignItems: 'center' }}>
                <View
                  style={{
                    width: 42,
                    height: 34,
                    borderRadius: 12,
                    backgroundColor: active ? C.navy : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: active ? '#fff' : C.faint, fontWeight: '900', fontSize: 17 }}>{t.glyph}</Text>
                  {n > 0 ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -2,
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: C.accent,
                        borderWidth: 2,
                        borderColor: '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>{n > 99 ? '99' : n}</Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={{
                    color: active ? C.navy : C.faint,
                    fontWeight: '800',
                    fontSize: 11,
                    marginTop: 3,
                  }}
                >
                  {t.label}
                </Text>
                {active ? (
                  <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: C.accent, marginTop: 3 }} />
                ) : (
                  <View style={{ width: 16, height: 3, marginTop: 3 }} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * One tokenised day-part palette shared by both apps: warm sunrise → orange,
 * midday → gold, evening → navy.
 */
const DAYPART_TINT: Record<string, { bg: string; fg: string }> = {
  Morning: { bg: C.accentSoft, fg: C.accentDeep },
  Afternoon: { bg: C.goldSoft, fg: C.amber },
  Evening: { bg: C.navySoft, fg: C.navy },
};

export function DaypartIcon({ start }: { start?: string }) {
  const h = Number((start || '08:00').split(':')[0]);
  const label = h < 12 ? '☀' : h < 17 ? '◐' : '☾';
  const tint = DAYPART_TINT[daypart(start)] || DAYPART_TINT.Morning;
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 15,
        backgroundColor: tint.bg,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: S.md,
      }}
    >
      <Text style={{ color: tint.fg, fontWeight: '900', fontSize: 20 }}>{label}</Text>
    </View>
  );
}

export function daypart(start?: string): string {
  const h = Number((start || '08:00').split(':')[0]);
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
