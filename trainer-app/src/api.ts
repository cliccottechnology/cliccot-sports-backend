import axios from 'axios';
import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

// `process.env.EXPO_PUBLIC_*` is inlined by Expo at bundle time.
declare const process: { env: Record<string, string | undefined> };

const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '8000';

/**
 * Resolve the LAN host of the machine running the Expo dev server.
 * The backend runs on that same machine, so this keeps the app online even
 * when the router hands out a new IP every day (DHCP) — no hardcoded IP to
 * update. Falls back to the .env URL, then localhost, for production builds
 * where no dev server is present.
 */
function detectDevHost(): string | null {
  try {
    const hostUri =
      (Constants as any)?.expoConfig?.hostUri ||
      (Constants as any)?.expoGoConfig?.debuggerHost ||
      (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
      '';
    const fromBundler: string =
      NativeModules?.SourceCode?.scriptURL || NativeModules?.SourceCode?.getConstants?.()?.scriptURL || '';
    const raw = String(hostUri || fromBundler);
    const withoutScheme = raw.replace(/^[a-z]+:\/\//i, '');
    const host = withoutScheme.split('/')[0].split('@').pop()?.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1' && /^[\w.-]+$/.test(host)) return host;
  } catch {
    /* no dev host available */
  }
  return null;
}

function resolveBase(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  const devHost = detectDevHost();
  if (devHost) return `http://${devHost}:${API_PORT}/api`;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  if (Platform.OS === 'android') return `http://10.0.2.2:${API_PORT}/api`;
  return `http://localhost:${API_PORT}/api`;
}

export const API_BASE = resolveBase();

export const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

let accessToken = '';
let refreshToken = '';
export let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(fn: (() => void) | null) {
  onSessionExpired = fn;
}

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original: any = err.config || {};
    if (err.response?.status === 401 && !original._retried && refreshToken) {
      original._retried = true;
      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh/`, { refresh: refreshToken });
        accessToken = data.access;
        if (data.refresh) refreshToken = data.refresh;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        accessToken = '';
        refreshToken = '';
        onSessionExpired?.();
      }
    }
    return Promise.reject(err);
  },
);

export function setTokens(a: string, r: string) {
  accessToken = a;
  refreshToken = r;
}
export function clearTokens() {
  accessToken = '';
  refreshToken = '';
}

export function errMsg(e: any, fallback: string): string {
  return (
    e?.response?.data?.message ||
    e?.response?.data?.details?.detail ||
    e?.response?.data?.detail ||
    (typeof e?.response?.data === 'string' ? e.response.data : null) ||
    e?.message ||
    fallback
  );
}

export type Me = {
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role_name?: string;
  permissions?: string[];
  must_change_password?: boolean;
};

export async function changeMyPassword(old_password: string, new_password: string) {
  const { data } = await api.post('/auth/change-password/', { old_password, new_password });
  return data;
}

export type SessionItem = {
  id: number;
  batch?: number;
  batch_name?: string;
  sport?: number;
  sport_name?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  location_name?: string;
  coach_name?: string;
  assigned?: { student: number }[];
};

export type RosterRow = {
  student: number;
  student_id?: string;
  name: string;
  status: string;
  record_id?: number | null;
  photo?: string | null;
  hasRef?: boolean;
};

export type Suggestion = {
  student: number;
  name: string;
  student_ref?: string;
  suggestion: 'verified' | 'not_detected' | 'needs_review';
  status?: string;
  confidence: number | null;
  reason: string;
  has_reference: boolean;
};

export type Analysis = {
  session: number;
  photo_id: number;
  photo_url: string | null;
  provider: string;
  persons_detected: number | null;
  unrecognized_count: number;
  possible_duplicate?: number | null;
  quality?: { brightness: number; contrast: number; width: number; height: number } | null;
  notes: string[];
  suggestions: Suggestion[];
  present_count?: number;
  absent_count?: number;
  not_enrolled_count?: number;
  enrolled_count?: number;
  total_students?: number;
  submitted?: boolean;
  session_status?: string;
};

export type AttRecord = {
  id: number;
  session: number;
  student: number;
  student_name?: string;
  status: string;
  marked_at?: string;
};

const listOf = (d: any): any[] => (Array.isArray(d) ? d : d?.results || []);

export async function login(username: string, password: string) {
  const { data } = await api.post('/auth/login/', { username, password });
  return data as { access: string; refresh: string; user: Me };
}
export async function health(): Promise<boolean> {
  try {
    const { data } = await axios.get(`${API_BASE.replace(/\/api$/, '')}/api/health/`, { timeout: 8000 });
    return data?.status === 'ok';
  } catch {
    return false;
  }
}
export async function todaySessions(): Promise<SessionItem[]> {
  const { data } = await api.get('/sessions/today/');
  return listOf(data);
}
export async function upcomingSessions(): Promise<SessionItem[]> {
  const { data } = await api.get('/sessions/', {
    params: { status: 'scheduled', ordering: 'date,start_time', page_size: 20 },
  });
  const today = new Date().toISOString().slice(0, 10);
  return listOf(data).filter((s: SessionItem) => !s.date || s.date >= today);
}
export async function roster(sessionId: string): Promise<RosterRow[]> {
  const { data } = await api.get('/attendance/roster/', { params: { session: sessionId } });
  return (data.roster || []).map((r: any) => ({
    student: r.student,
    student_id: r.student_id,
    name: r.name || r.student_id || `Student ${r.student}`,
    status: r.status || 'not_marked',
    record_id: r.record_id ?? null,
    photo: r.photo ?? null,
    hasRef: !!r.has_reference,
  }));
}
export async function sessionAttendance(sessionId: number): Promise<AttRecord[]> {
  const { data } = await api.get('/attendance/', { params: { session: sessionId, page_size: 100 } });
  return listOf(data);
}
export async function recentActivity(): Promise<AttRecord[]> {
  const { data } = await api.get('/attendance/', { params: { page_size: 8 } });
  return listOf(data);
}
export async function history(): Promise<AttRecord[]> {
  const { data } = await api.get('/attendance/', { params: { page_size: 60 } });
  return listOf(data);
}
export type Sport = { id: number; name: string; code: string };
export async function sports(): Promise<Sport[]> {
  const { data } = await api.get('/sports/sports/', { params: { page_size: 20 } });
  return listOf(data);
}
export async function mySessions(): Promise<SessionItem[]> {
  const { data } = await api.get('/sessions/my_sessions/', { params: { page_size: 60 } });
  return listOf(data);
}
export async function changeSessionStatus(sessionId: number, status: string): Promise<SessionItem> {
  const { data } = await api.post(`/sessions/${sessionId}/change_status/`, { status });
  return data;
}
export async function bulkMark(sessionId: number, items: { student: number; status: string; makeup_for?: number }[], reason?: string) {
  const body: any = { session: sessionId, items };
  if (reason?.trim()) body.reason = reason.trim();
  const { data } = await api.post('/attendance/bulk_mark/', body);
  return data;
}
/** Whether the session is a make-up and which missed session it links to. */
export async function sessionMakeupMeta(sessionId: string): Promise<{ isMakeup: boolean; makeupFor: number | null }> {
  const { data } = await api.get('/attendance/roster/', { params: { session: sessionId } });
  return { isMakeup: !!data.is_makeup, makeupFor: data.makeup_for ?? null };
}
export async function photoAnalyze(
  sessionId: number,
  uri: string,
  name = 'session-photo.jpg',
  autoSubmit = false,
): Promise<Analysis> {
  const form = new FormData();
  form.append('session', String(sessionId));
  if (autoSubmit) form.append('auto_submit', 'true');
  appendPhoto(form, 'photo', uri, name);
  const { data } = await api.post('/attendance/photo_analyze/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data;
}

export type RefPhoto = {  id: number;
  student: number;
  image: string;
  angle?: string;
  consent_given: boolean;
  consented_by?: string;
  is_active: boolean;
};
export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return API_BASE.replace(/\/api$/, '') + path;
}

/**
 * Attach a photo to multipart form data on every platform.
 * Native image-picker URIs (file://) are passed through React Native style.
 * Web picker URIs (data:) are decoded to bytes first — appending the raw
 * object/string would upload "[object Object]" instead of the image.
 */
function appendPhoto(form: FormData, field: string, uri: string, name: string) {
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    const head = uri.slice(0, comma);
    const mime = /data:(.*?);/.exec(head)?.[1] || 'image/jpeg';
    const bin = atob(uri.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime });
    form.append(field, blob, name);
  } else {
    form.append(field, { uri, name, type: 'image/jpeg' } as any);
  }
}
export async function refPhotos(): Promise<RefPhoto[]> {
  const { data } = await api.get('/students/reference-photos/', { params: { is_active: true, page_size: 200 } });
  return listOf(data);
}
export async function enrollReference(
  studentId: number,
  uri: string,
  consentedBy: string,
  name = 'reference.jpg',
  angle = 'front',
): Promise<RefPhoto> {
  const form = new FormData();
  form.append('student', String(studentId));
  form.append('consent_given', 'true');
  form.append('consented_by', consentedBy);
  form.append('angle', angle);
  appendPhoto(form, 'image', uri, name);
  const { data } = await api.post('/students/reference-photos/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data;
}

export type Payable = {
  id: number;
  trainer?: number;
  trainer_name?: string;
  session_date?: string;
  kind?: string;
  period_start?: string;
  period_end?: string;
  amount: string | number;
  status: string;
};

export type FeeSummary = { by_status: { status: string; total: number }[]; payable: number; paid: number };

export async function myPayables(): Promise<Payable[]> {
  const { data } = await api.get('/trainer-fees/payables/', { params: { page_size: 60 } });
  return listOf(data);
}
export async function feeSummary(): Promise<FeeSummary> {
  const { data } = await api.get('/trainer-fees/payables/summary/');
  return data;
}

export type AppNotification = {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at?: string;
};

export async function notifications(): Promise<AppNotification[]> {
  const { data } = await api.get('/notifications/', { params: { page_size: 50 } });
  return listOf(data);
}
export async function markNotificationRead(id: number) {
  const { data } = await api.post(`/notifications/${id}/read/`);
  return data;
}

export type CoachMe = {
  id: number;
  trainer_id: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  sports?: string[];
  weekly_off_days?: number[];
  is_active?: boolean;
  photo?: string | null;
};

export async function coachMe(): Promise<CoachMe> {
  const { data } = await api.get('/coaches/me/');
  return data;
}

export async function uploadMyPhoto(uri: string, name = 'coach-photo.jpg'): Promise<CoachMe> {
  const form = new FormData();
  appendPhoto(form, 'photo', uri, name);
  const { data } = await api.patch('/coaches/update_my_profile/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data.coach;
}

export async function setMyOffDays(days: number[]): Promise<CoachMe> {
  const { data } = await api.post('/coaches/set_my_off_days/', { weekly_off_days: days });
  return data;
}

export type AcademyBrand = { name: string; tagline: string };
export const DEFAULT_BRAND: AcademyBrand = { name: '', tagline: '' };

let brandCache: AcademyBrand | null = null;
let brandInflight: Promise<AcademyBrand> | null = null;

/** Public academy identity — no login needed. Cached; use refreshAcademyBrand() after a rename. */
export function academyBrand(): Promise<AcademyBrand> {
  if (brandCache) return Promise.resolve(brandCache);
  if (!brandInflight) {
    brandInflight = api
      .get('/settings/brand/')
      .then(({ data }) => {
        brandCache = {
          name: String(data?.name || DEFAULT_BRAND.name),
          tagline: String(data?.tagline || DEFAULT_BRAND.tagline),
        };
        return brandCache;
      })
      .catch(() => {
        brandCache = { ...DEFAULT_BRAND };
        return brandCache;
      })
      .finally(() => {
        brandInflight = null;
      });
  }
  return brandInflight;
}

export function refreshAcademyBrand(): void {
  brandCache = null;
}

export type ProfileUpdate = {
  coach: CoachMe;
  user: { first_name?: string; last_name?: string; email?: string; phone?: string };
  changed: Record<string, string>;
};

export async function updateMyProfile(patch: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
}): Promise<ProfileUpdate> {
  const { data } = await api.patch('/coaches/update_my_profile/', patch);
  return data;
}

export type CheckIn = {
  id: number;
  coach: number;
  session: number;
  session_date?: string;
  batch_name?: string;
  status: string;
  marked_at?: string;
  auto_marked?: boolean;
  correction_status?: 'pending' | 'approved' | 'rejected' | null;
  correction_id?: number | null;
  deadline?: string | null;
  can_request_correction?: boolean;
};
export async function myCheckins(): Promise<CheckIn[]> {
  const { data } = await api.get('/coaches/checkins/', { params: { page_size: 60 } });
  return listOf(data);
}
export async function checkIn(sessionId: number, status = 'present'): Promise<CheckIn> {
  const { data } = await api.post('/coaches/checkins/', { session: sessionId, status });
  return data;
}
/** Correct a check-in already recorded for one of your own sessions. */
export async function updateCheckIn(id: number, status: string): Promise<CheckIn> {
  const { data } = await api.patch(`/coaches/checkins/${id}/`, { status });
  return data;
}

export type TrainerCorrection = {
  id: number;
  checkin: number;
  session?: number;
  session_date?: string;
  batch_name?: string;
  requested_status: string;
  original_status?: string;
  reason: string;
  evidence_note?: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at?: string;
  reviewed_at?: string | null;
  review_note?: string;
};
/** Request a correction for an automatically-marked absence on your own session. */
export async function requestCorrection(
  checkinId: number,
  requested_status: 'present' | 'late' | 'leave',
  reason: string,
  evidenceNote = '',
): Promise<TrainerCorrection> {
  const { data } = await api.post('/coaches/corrections/', {
    checkin: checkinId,
    requested_status,
    reason,
    evidence_note: evidenceNote,
  });
  return data;
}
export async function myCorrections(): Promise<TrainerCorrection[]> {
  const { data } = await api.get('/coaches/corrections/', { params: { page_size: 50 } });
  return listOf(data);
}

export type Earnings = {
  from: string;
  to: string;
  period: string;
  trainer: number | null;
  method?: 'session_based' | 'student_based' | 'weekly' | 'monthly' | null;
  sessions_taken: number;
  payable_count: number;
  payable_amount: number;
  paid_amount: number;
  balance: number;
  students_counted?: number;
  sessions_without_payable?: number;
  by_day: { date: string; sessions: number; amount: number }[];
};

export async function myEarnings(period: 'week' | 'month' = 'month'): Promise<Earnings> {
  const { data } = await api.get('/trainer-fees/payables/earnings/', { params: { period } });
  return data;
}

export type Achievement = {
  id: number;
  title: string;
  date: string;
  sport?: number | null;
  sport_name?: string;
  description?: string;
  photo?: string | null;
};

export async function academyAchievements(): Promise<Achievement[]> {
  const { data } = await api.get('/sports/achievements/', { params: { page_size: 30 } });
  return listOf(data);
}

export type Certificate = {
  id: number;
  title: string;
  period_from: string;
  period_to: string;
  sessions_completed: number;
  description?: string;
  file?: string | null;
  issued_at?: string;
};

export async function myCertificates(): Promise<Certificate[]> {
  const { data } = await api.get('/coaches/certificates/', { params: { page_size: 30 } });
  return listOf(data);
}

export async function trainerEarnings(trainer: number, period: 'week' | 'month' = 'month'): Promise<Earnings> {
  const { data } = await api.get('/trainer-fees/payables/earnings/', { params: { trainer, period } });
  return data;
}

export type Correction = {
  id: number;
  record: number;
  session: number;
  student_name?: string;
  old_status: string;
  new_status: string;
  reason: string;
  corrected_by_name?: string;
  created_at?: string;
};
export async function corrections(): Promise<Correction[]> {
  const { data } = await api.get('/attendance/corrections/', { params: { page_size: 50 } });
  return listOf(data);
}
