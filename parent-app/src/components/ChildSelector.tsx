import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { mediaUrl, type Child } from '../api';
import { C, S, shadowSm } from '../theme';
import { Avatar } from './ui';

/** Horizontal child switcher — the parent's own kids only. */
export default function ChildSelector({
  kids,
  selId,
  onSelect,
}: {
  kids: Child[];
  selId: number | null;
  onSelect: (id: number) => void;
}) {
  if (kids.length <= 1) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 4, paddingRight: S.md }}
    >
      {kids.map((k) => {
        const active = k.id === selId;
        return (
          <Pressable
            key={k.id}
            onPress={() => onSelect(k.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: active ? C.navy : '#fff',
                borderWidth: 1.5,
                borderColor: active ? C.navy : C.line,
                borderRadius: 999,
                paddingVertical: 6,
                paddingLeft: 6,
                paddingRight: 14,
                marginRight: S.sm,
                ...shadowSm,
              },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Avatar name={k.first_name + ' ' + (k.last_name || '')} size={30} uri={mediaUrl(k.photo)} />
            <Text
              style={{
                marginLeft: 8,
                fontWeight: '800',
                fontSize: 13,
                color: active ? '#fff' : C.navy,
              }}
            >
              {k.first_name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
