import { C } from './theme';
import type { AttendanceRec } from './api';

/** Human label + colours for the certificate milestone state. */
export function certLabel(state?: string | null): { label: string; bg: string; fg: string } {
  switch (state) {
    case 'issued':
      return { label: 'Issued', bg: C.goldSoft, fg: C.gold };
    case 'eligible':
      return { label: 'Eligible', bg: C.greenSoft, fg: C.green };
    case 'review':
      return { label: 'In review', bg: C.amberSoft, fg: C.amber };
    case 'approaching':
      return { label: 'Approaching', bg: C.accentSoft, fg: C.accentDeep };
    case 'training':
      return { label: 'In training', bg: C.navySoft, fg: C.navy };
    default:
      return { label: 'Not started', bg: C.greyBg, fg: C.greyFg };
  }
}

export type AttStats = {
  present: number;
  late: number;
  absent: number;
  leave: number;
  notMarked: number;
  marked: number;
  attended: number;
  pct: number;
};

/**
 * Attendance breakdown for a set of records.
 *
 * Denominator = *marked* sessions only (present + late + absent + leave).
 * Unmarked records are reported separately and never counted as absences.
 * Late still counts as attended.
 */
export function attendanceStats(recs: AttendanceRec[]): AttStats {
  const present = recs.filter((r) => r.status === 'present').length;
  const late = recs.filter((r) => r.status === 'late').length;
  const absent = recs.filter((r) => r.status === 'absent').length;
  const leave = recs.filter((r) => r.status === 'leave').length;
  const marked = present + late + absent + leave;
  const notMarked = Math.max(0, recs.length - marked);
  const attended = present + late;
  const pct = marked ? Math.round((attended / marked) * 100) : 0;
  return { present, late, absent, leave, notMarked, marked, attended, pct };
}

export function num(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function childName(c: { first_name?: string; last_name?: string; student_id?: string } | null | undefined): string {
  if (!c) return 'Your child';
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.student_id || 'Your child';
}
