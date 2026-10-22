import { Platform } from 'react-native';

/**
 * Shared design tokens for the HARI / JETZ Sports Academy platform.
 *
 * Single source of truth consumed by BOTH the Parent App and the Trainer App
 * so they read as one premium product: Deep Navy primary, White / light
 * blue-grey surfaces, Athletic Orange accent, Poppins typography.
 *
 * Every token here is plain data — no app-specific imports — so both Metro
 * bundles and `tsc` can resolve it from either package.
 */
export const C = {
  navy: '#102A56',
  navyDeep: '#081733',
  navyInk: '#0B2144',
  navyHover: '#0C2145',
  navySoft: '#E8EDF5',
  navyTint: '#F0F4FA',
  accent: '#FF6B2C',
  accentDeep: '#E85A1F',
  accentSoft: '#FFF1E8',
  accentTint: '#FFF7F1',
  gold: '#F2A900',
  goldSoft: '#FEF4D8',
  bg: '#F3F5FA',
  card: '#FFFFFF',
  text: '#13233D',
  ink: '#13233D',
  sub: '#5B6B84',
  faint: '#8A99B0',
  line: '#E4E9F2',
  borderStrong: '#C9D5E8',
  green: '#15803D',
  greenSoft: '#E6F5EB',
  greenBd: '#B7DFC3',
  amber: '#B45309',
  amberSoft: '#FEF0D3',
  amberBd: '#F2D38A',
  red: '#DC2626',
  redSoft: '#FDECEC',
  redBd: '#F3B8B8',
  teal: '#0E7490',
  tealSoft: '#E0F4FA',
  violet: '#6D28D9',
  violetSoft: '#EEE7FB',
  greyBg: '#EDF1F6',
  greyFg: '#475569',
  greyBd: '#D8E0EC',
  white: '#FFFFFF',
} as const;

export const R = { card: 18, cardSm: 14, btn: 14, input: 14, pill: 999 } as const;

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const F = { hero: 30, h1: 24, h2: 17, body: 14.5, small: 13, micro: 11.5 } as const;

/**
 * Poppins families bundled via `@expo-google-fonts/poppins`.
 * A weight-specific family is picked at render time (see the shared native
 * shim) so bold headings stay genuinely bold on every platform.
 *
 * Declared in `fontFamilies.ts` (no `react-native` import) and re-exported so
 * the native shim can use it without creating a require cycle with this file.
 */
export { FONT, FONT_DEFAULT } from './fontFamilies';

const iosShadow = (opacity: number, radius: number, y: number) => ({
  shadowColor: '#102A56',
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height: y },
});

export const shadow =
  Platform.OS === 'ios'
    ? iosShadow(0.08, 16, 6)
    : Platform.OS === 'android'
      ? { elevation: 2 }
      : ({ boxShadow: '0 1px 2px rgba(16,42,86,0.05), 0 10px 28px rgba(16,42,86,0.08)' } as object);

export const shadowSm =
  Platform.OS === 'ios'
    ? iosShadow(0.06, 10, 3)
    : Platform.OS === 'android'
      ? { elevation: 1 }
      : ({ boxShadow: '0 1px 2px rgba(16,42,86,0.06), 0 4px 14px rgba(16,42,86,0.06)' } as object);

export const shadowLg =
  Platform.OS === 'ios'
    ? iosShadow(0.14, 24, 10)
    : Platform.OS === 'android'
      ? { elevation: 4 }
      : ({ boxShadow: '0 2px 4px rgba(8,23,51,0.18), 0 18px 44px rgba(8,23,51,0.28)' } as object);

export const cardBorder = { borderWidth: 1, borderColor: C.line };

/** Deterministic tinted avatar background from a name — keeps lists lively but consistent. */
const AVATAR_BG = ['#102A56', '#FF6B2C', '#0E7490', '#6D28D9', '#B45309', '#15803D', '#BE123C'];
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_BG[h % AVATAR_BG.length];
}

const SPORT_TINTS: Record<string, { bg: string; fg: string }> = {
  football: { bg: '#E6F5EB', fg: '#15803D' },
  cricket: { bg: '#E8EDF5', fg: '#102A56' },
  basketball: { bg: '#FFF1E8', fg: '#E85A1F' },
  tennis: { bg: '#FEF4D8', fg: '#B45309' },
  swimming: { bg: '#E0F4FA', fg: '#0E7490' },
  badminton: { bg: '#EEE7FB', fg: '#6D28D9' },
};
export function sportTint(sport?: string): { bg: string; fg: string } {
  if (!sport) return { bg: C.navySoft, fg: C.navy };
  return SPORT_TINTS[sport.toLowerCase()] || { bg: C.navySoft, fg: C.navy };
}

/** Union of every status the Parent and Trainer portals render. */
export const STATUS_STYLE: Record<string, { bg: string; fg: string; bd: string; label: string }> = {
  scheduled: { bg: C.navySoft, fg: C.navy, bd: '#BFD0EA', label: 'Scheduled' },
  in_progress: { bg: C.amberSoft, fg: C.amber, bd: C.amberBd, label: 'In Progress' },
  completed: { bg: C.greenSoft, fg: C.green, bd: C.greenBd, label: 'Completed' },
  cancelled: { bg: C.greyBg, fg: C.greyFg, bd: C.greyBd, label: 'Cancelled' },
  present: { bg: C.greenSoft, fg: C.green, bd: C.greenBd, label: 'Present' },
  absent: { bg: C.redSoft, fg: C.red, bd: C.redBd, label: 'Absent' },
  late: { bg: C.amberSoft, fg: C.amber, bd: C.amberBd, label: 'Late' },
  leave: { bg: C.navySoft, fg: C.navy, bd: '#BFD0EA', label: 'Leave' },
  not_marked: { bg: C.greyBg, fg: C.greyFg, bd: C.greyBd, label: 'Pending' },
  // Parent pays use `verified` (green); Trainer maps pay-verification to
  // `fee_verified` (its original amber), so both keep their exact styling.
  verified: { bg: C.greenSoft, fg: C.green, bd: C.greenBd, label: 'Verified' },
  fee_verified: { bg: C.amberSoft, fg: C.amber, bd: C.amberBd, label: 'Verified' },
  // Trainer AI-attendance detection states.
  not_detected: { bg: C.amberSoft, fg: C.amber, bd: C.amberBd, label: 'Pending Verification' },
  needs_review: { bg: C.amberSoft, fg: C.amber, bd: C.amberBd, label: 'Pending Verification' },
  unrecognized: { bg: C.redSoft, fg: C.red, bd: C.redBd, label: 'Not Recognized' },
  // Parent-side schedule / fee states.
  upcoming: { bg: C.navySoft, fg: C.navy, bd: '#BFD0EA', label: 'Upcoming' },
  due: { bg: C.accentSoft, fg: C.accentDeep, bd: '#F5C5A8', label: 'Due' },
  pending: { bg: C.navySoft, fg: C.navy, bd: '#BFD0EA', label: 'Pending' },
  partially_paid: { bg: C.amberSoft, fg: C.amber, bd: C.amberBd, label: 'Partly Paid' },
  paid: { bg: C.greenSoft, fg: C.green, bd: C.greenBd, label: 'Paid' },
  overdue: { bg: C.redSoft, fg: C.red, bd: C.redBd, label: 'Overdue' },
  refunded: { bg: C.violetSoft, fg: C.violet, bd: '#CDBDF0', label: 'Refunded' },
  success: { bg: C.greenSoft, fg: C.green, bd: C.greenBd, label: 'Success' },
  failed: { bg: C.redSoft, fg: C.red, bd: C.redBd, label: 'Failed' },
  initiated: { bg: C.navySoft, fg: C.navy, bd: '#BFD0EA', label: 'Initiated' },
  read: { bg: C.greyBg, fg: C.greyFg, bd: C.greyBd, label: 'Read' },
  unread: { bg: C.accentSoft, fg: C.accentDeep, bd: '#F5C5A8', label: 'New' },
  open: { bg: C.accentSoft, fg: C.accentDeep, bd: '#F5C5A8', label: 'Open' },
  resolved: { bg: C.greenSoft, fg: C.green, bd: C.greenBd, label: 'Resolved' },
  closed: { bg: C.greyBg, fg: C.greyFg, bd: C.greyBd, label: 'Closed' },
  low: { bg: C.greyBg, fg: C.greyFg, bd: C.greyBd, label: 'Low' },
  medium: { bg: C.navySoft, fg: C.navy, bd: '#BFD0EA', label: 'Medium' },
  high: { bg: C.amberSoft, fg: C.amber, bd: C.amberBd, label: 'High' },
  urgent: { bg: C.redSoft, fg: C.red, bd: C.redBd, label: 'Urgent' },
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function greeting(hour = new Date().getHours()): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtDayDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${fmtTime(
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  )}`;
}

const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
export function inr(n: number | string): string {
  return `₹${inrFmt.format(Number(n || 0))}`;
}
