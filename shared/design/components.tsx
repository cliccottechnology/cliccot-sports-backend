import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { C, F, R, S, avatarColor, cardBorder, STATUS_STYLE, initials, shadow, shadowSm } from './tokens';

/* ---------- Layout primitives ---------- */

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PressCard({
  children,
  onPress,
  style,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, styles.pressCard, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }, style]}
    >
      {children}
    </Pressable>
  );
}

/* ---------- Typography ---------- */

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}
export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function Sub({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sub, style]}>{children}</Text>;
}

export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: S.xl, marginBottom: S.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: C.navy, letterSpacing: -0.2 }}>{title}</Text>
        {hint ? <Text style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/* ---------- Premium header ---------- */

export function AppHeader({
  eyebrow,
  title,
  subtitle,
  onBack,
  right,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {/* decorative depth */}
      <View pointerEvents="none" style={styles.headerGlowA} />
      <View pointerEvents="none" style={styles.headerGlowB} />
      <View pointerEvents="none" style={styles.headerRing} />
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.backTx}>‹  BACK</Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={styles.headerEyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={{ marginLeft: S.md }}>{right}</View> : null}
      </View>
      {children ? <View style={{ marginTop: S.md }}>{children}</View> : null}
    </View>
  );
}

export function HeaderIconBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.8 }]}
    >
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function BrandPill({ text }: { text: string }) {
  return (
    <View style={styles.brandPill}>
      <View style={styles.brandDot} />
      <Text style={styles.brandTx}>{text}</Text>
    </View>
  );
}

/* ---------- Status / identity ---------- */

export function Badge({ status }: { status?: string }) {
  const s = STATUS_STYLE[status || ''] || STATUS_STYLE.scheduled;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.bd }]}>
      <View style={[styles.badgeDot, { backgroundColor: s.fg }]} />
      <Text style={[styles.badgeTx, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

export function Avatar({
  name,
  size = 44,
  ring = false,
  uri = null,
}: {
  name: string;
  size?: number;
  ring?: boolean;
  uri?: string | null;
}) {
  if (uri) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
            backgroundColor: C.line,
          },
          ring && styles.avatarRing,
        ]}
      >
        <Image source={{ uri }} style={{ width: size, height: size }} />
      </View>
    );
  }
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarColor(name || '?'),
        },
        ring && styles.avatarRing,
      ]}
    >
      <Text style={[styles.avatarTx, { fontSize: size * 0.34 }]}>{initials(name || '?')}</Text>
    </View>
  );
}

export function IconBubble({
  glyph,
  bg,
  fg,
  size = 44,
}: {
  glyph: string;
  bg?: string;
  fg?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: bg || C.navySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: fg || C.navy, fontWeight: '900', fontSize: size * 0.42 }}>{glyph}</Text>
    </View>
  );
}

/* ---------- Buttons ---------- */

type BtnProps = {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};
export function Btn({ title, onPress, kind = 'primary', loading, disabled, style }: BtnProps) {
  const dis = disabled || loading;
  const light = kind === 'secondary' || kind === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={dis}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && styles.btnPrimary,
        kind === 'accent' && styles.btnAccent,
        kind === 'secondary' && styles.btnSecondary,
        kind === 'ghost' && styles.btnGhost,
        kind === 'danger' && styles.btnDanger,
        dis && styles.btnDisabled,
        pressed && !dis && { opacity: 0.9, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={light ? C.navy : '#fff'} />
      ) : (
        <Text style={[styles.btnTx, light && { color: C.navy }]}>{title}</Text>
      )}
    </Pressable>
  );
}

/* ---------- Forms ---------- */

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: S.md }}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

export function Input({ style, editable, ...props }: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={C.faint}
      autoCapitalize="none"
      autoCorrect={false}
      editable={editable}
      {...props}
      style={[styles.input, editable === false && { opacity: 0.6 }, style]}
    />
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <Text style={styles.searchIco}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.searchInput}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.searchClear}>
          <Text style={{ color: C.sub, fontWeight: '800' }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  accent = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      style={({ pressed }) => [
        styles.chip,
        active && (accent ? styles.chipActiveAccent : styles.chipActive),
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.chipTx, active && styles.chipTxActive]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Feedback ---------- */

export function ErrorBanner({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <View style={styles.errBanner}>
      <View style={styles.errDot}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>!</Text>
      </View>
      <Text style={styles.errBannerTx}>{msg}</Text>
    </View>
  );
}

export function SuccessBanner({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <View style={styles.okBanner}>
      <View style={[styles.errDot, { backgroundColor: C.green }]}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>✓</Text>
      </View>
      <Text style={styles.okBannerTx}>{msg}</Text>
    </View>
  );
}

export function EmptyState({
  glyph = '◍',
  title,
  hint,
  action,
}: {
  glyph?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIco}>
        <Text style={{ fontSize: 22, color: C.navy, fontWeight: '900' }}>{glyph}</Text>
      </View>
      <Text style={styles.emptyTx}>{title}</Text>
      {hint ? <Sub style={{ textAlign: 'center', marginTop: 4 }}>{hint}</Sub> : null}
      {action ? <View style={{ marginTop: S.md }}>{action}</View> : null}
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View style={[styles.card, { padding: S.lg }]}>
      <View style={styles.skLine} />
      <View style={[styles.skLine, { width: '62%', marginTop: 8 }]} />
    </View>
  );
}

export function StatCard({
  glyph,
  value,
  label,
  tint,
  fg,
}: {
  glyph: string;
  value: string;
  label: string;
  tint: string;
  fg: string;
}) {
  return (
    <View style={[styles.stat, shadowSm]}>
      <View style={[styles.statIco, { backgroundColor: tint }]}>
        <Text style={{ color: fg, fontWeight: '900', fontSize: 16 }}>{glyph}</Text>
      </View>
      <Text style={[styles.statN, { color: fg }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statL} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export function ProgressBar({ pct, bar = C.accent, track = 'rgba(255,255,255,0.22)' }: { pct: number; bar?: string; track?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <View style={[styles.progressTrack, { backgroundColor: track }]}>
      <View style={[styles.progressFill, { width: `${p}%`, backgroundColor: bar }]} />
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.line }} />;
}

export function Dot({ ok }: { ok: boolean }) {
  return <View style={[styles.dot, { backgroundColor: ok ? C.green : C.amber }]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  card: {
    backgroundColor: C.card,
    borderRadius: R.card,
    padding: S.lg,
    ...cardBorder,
    ...shadow,
  },
  pressCard: { padding: S.md },
  eyebrow: { fontSize: F.micro, fontWeight: '800', color: C.faint, letterSpacing: 1.4 },
  h1: { fontSize: F.h1, fontWeight: '800', color: C.navy, letterSpacing: -0.3 },
  h2: { fontSize: F.h2, fontWeight: '800', color: C.navy, letterSpacing: -0.2 },
  sub: { fontSize: 13.5, color: C.sub, lineHeight: 19 },

  header: {
    backgroundColor: C.navyDeep,
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerGlowA: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -80,
    top: -90,
    backgroundColor: 'rgba(255,107,44,0.28)',
  },
  headerGlowB: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    left: -70,
    bottom: -110,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerRing: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    right: -40,
    top: -40,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerEyebrow: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.72)', letterSpacing: 1.6, marginBottom: 6 },
  headerTitle: { color: '#fff', fontSize: 27, fontWeight: '800', letterSpacing: -0.4 },
  headerSub: { color: 'rgba(255,255,255,0.82)', fontSize: 13.5, marginTop: 5, lineHeight: 19 },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
    marginBottom: 12,
  },
  backTx: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.8 },
  headerIconBtn: {
    minWidth: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  brandPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
    marginTop: 10,
  },
  brandDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent, marginRight: 7 },
  brandTx: { color: '#fff', fontWeight: '800', fontSize: 11.5, letterSpacing: 1.1 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: R.pill,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  badgeTx: { fontSize: 12, fontWeight: '700' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarRing: { borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.85)' },
  avatarTx: { color: '#fff', fontWeight: '800' },

  btn: {
    borderRadius: R.btn,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnPrimary: { backgroundColor: C.navy, ...shadowSm },
  btnAccent: { backgroundColor: C.accent, ...shadowSm },
  btnSecondary: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.borderStrong },
  btnGhost: { backgroundColor: 'transparent' },
  btnDanger: { backgroundColor: C.red },
  btnDisabled: { opacity: 0.55 },
  btnTx: { color: '#fff', fontSize: 14.5, fontWeight: '800', letterSpacing: 0.2 },

  label: { fontSize: 12, fontWeight: '800', color: C.text, marginBottom: 7, letterSpacing: 0.6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    borderRadius: R.input,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 14.5,
    color: C.text,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: R.input,
    paddingHorizontal: 13,
    ...shadowSm,
  },
  searchIco: { color: C.faint, fontWeight: '900', fontSize: 17, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 14.5, color: C.text },
  searchClear: { padding: 6 },

  chip: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.line,
  },
  chipActive: { backgroundColor: C.navy, borderColor: C.navy },
  chipActiveAccent: { backgroundColor: C.accent, borderColor: C.accent },
  chipTx: { color: C.text, fontWeight: '800', fontSize: 12.5 },
  chipTxActive: { color: '#fff' },

  errBanner: {
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: C.redBd,
    borderRadius: R.input,
    padding: S.md,
    marginBottom: S.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errBannerTx: { color: C.red, fontSize: 13.5, fontWeight: '600', flex: 1 },
  errDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  okBanner: {
    backgroundColor: C.greenSoft,
    borderWidth: 1,
    borderColor: C.greenBd,
    borderRadius: R.input,
    padding: S.md,
    marginBottom: S.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  okBannerTx: { color: C.green, fontSize: 13.5, fontWeight: '700', flex: 1 },
  err: { color: C.red, fontSize: 12.5, marginTop: 5, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: S.xxl, paddingHorizontal: S.lg },
  emptyIco: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.navyTint,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTx: { fontSize: 15.5, fontWeight: '800', color: C.text },
  dot: { width: 9, height: 9, borderRadius: 99, marginRight: 7 },

  stat: { flex: 1, backgroundColor: '#fff', borderRadius: R.card, padding: S.md, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  statIco: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statN: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  statL: { fontSize: 11.5, color: C.sub, fontWeight: '700', marginTop: 2, textAlign: 'center', lineHeight: 15 },

  progressTrack: { height: 8, borderRadius: 99, overflow: 'hidden', marginTop: 10 },
  progressFill: { height: 8, borderRadius: 99 },
  skLine: { height: 13, borderRadius: 7, backgroundColor: C.line, width: '85%' },
});
