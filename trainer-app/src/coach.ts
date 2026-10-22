import {
  corrections,
  history,
  mySessions,
  refPhotos,
  roster,
  sessionAttendance,
  todaySessions,
  upcomingSessions,
  type AttRecord,
  type Correction,
  type RosterRow,
  type SessionItem,
} from './api';

export type StudentEntry = RosterRow & { batch?: string; sport?: string; hasRef?: boolean; refImage?: string | null; refCount?: number };

export type CoachData = {
  today: SessionItem[];
  upcoming: SessionItem[];
  my: SessionItem[];
  activity: AttRecord[];
  history: AttRecord[];
  corrections: Correction[];
  doneBySession: Record<number, { done: number; total: number; present: number; absent: number }>;
  students: StudentEntry[];
};

let cache: { at: number; data: CoachData } | null = null;

export async function loadCoachData(force = false): Promise<CoachData> {
  if (!force && cache && Date.now() - cache.at < 30000) return cache.data;
  const [today, my, upcoming, activity, hist, corrs] = await Promise.all([
    todaySessions(),
    mySessions(),
    upcomingSessions(),
    (await import('./api')).recentActivity(),
    history(),
    corrections().catch(() => []),
  ]);
  const doneBySession: CoachData['doneBySession'] = {};
  await Promise.all(
    today.map(async (s) => {
      try {
        const recs = await sessionAttendance(s.id);
        const rosterSize = s.assigned?.length ?? recs.length;
        doneBySession[s.id] = {
          done: recs.filter((r) => r.status && r.status !== 'not_marked').length,
          present: recs.filter((r) => r.status === 'present').length,
          absent: recs.filter((r) => r.status === 'absent').length,
          total: Math.max(rosterSize, recs.length),
        };
      } catch {
        doneBySession[s.id] = { done: 0, present: 0, absent: 0, total: s.assigned?.length ?? 0 };
      }
    }),
  );
  // Unique students across near-term sessions.
  const rostered = [...today, ...upcoming.slice(0, 10)];
  const seen = new Map<number, StudentEntry>();
  const [refs] = await Promise.all([
    refPhotos().catch(() => []),
  ]);
  await Promise.all(
    rostered.map(async (s) => {
      try {
        const rows = await roster(String(s.id));
        rows.forEach((r) =>
          seen.set(r.student, { ...r, batch: s.batch_name, sport: s.sport_name }),
        );
      } catch {
        /* offline session skipped */
      }
    }),
  );
  const data: CoachData = {
    today,
    my,
    upcoming: upcoming.slice(0, 10),
    activity: activity.slice(0, 8),
    history: hist,
    corrections: corrs,
    doneBySession,
    students: [...seen.values()].map((s) => {
      const mine = refs.filter((r) => r.student === s.student);
      return { ...s, hasRef: mine.length > 0, refImage: mine[0]?.image ?? null, refCount: mine.length };
    }),
  };
  cache = { at: Date.now(), data };
  return data;
}

export function invalidateCoachData() {
  cache = null;
}
