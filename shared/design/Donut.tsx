import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, S } from './tokens';

export type Slice = { label: string; value: number; color: string };

/** Premium donut: SVG ring segments + center total + legend. */
export default function Donut({
  slices,
  size = 176,
  thickness = 22,
  centerLabel,
  centerSub,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerLabel: string;
  centerSub?: string;
}) {
  const total = slices.reduce((a, s) => a + (Number(s.value) || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let acc = 0;
  const segs = slices.map((s) => {
    const frac = total > 0 ? (Number(s.value) || 0) / total : 0;
    const el = { ...s, frac, offset: acc };
    acc += frac;
    return el;
  });
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={C.line} strokeWidth={thickness} />
          {segs.map((s, i) =>
            s.frac > 0 ? (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${s.frac * circumference} ${circumference - s.frac * circumference}`}
                strokeDashoffset={-s.offset * circumference}
                strokeLinecap="butt"
                rotation={-90}
                originX={size / 2}
                originY={size / 2}
              />
            ) : null,
          )}
        </Svg>
        <View
          style={{
            position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 27, fontWeight: '800', color: C.navy }}>{centerLabel}</Text>
          {centerSub ? <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{centerSub}</Text> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: S.sm, gap: 8 }}>
        {segs.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color, marginRight: 6 }} />
            <Text style={{ fontSize: 12.5, color: C.sub, fontWeight: '600' }}>
              {s.label} · <Text style={{ color: C.text, fontWeight: '800' }}>{s.value}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
