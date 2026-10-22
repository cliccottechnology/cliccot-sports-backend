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

/**
 * Revoke the current refresh token server-side so a logged-out (or expired)
 * session cannot be replayed. Best-effort: uses a standalone request (not the
 * shared instance) so a dead/expired access token can't trigger the refresh
 * interceptor; callers clear local tokens regardless.
 */
export async function logout() {
  const refresh = refreshToken;
  const access = accessToken;
  if (!refresh) return;
  try {
    await axios.post(
      `${API_BASE}/auth/logout/`,
      { refresh },
      { headers: access ? { Authorization: `Bearer ${access}` } : {}, timeout: 10000 },
    );
  } catch {
    /* network/expiry — the token still expires on its own 60-minute deadline */
  }
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

const listOf = (d: any): any[] => (Array.isArray(d) ? d : d?.results || []);

export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return API_BASE.replace(/\/api$/, '') + path;
}

export type Me = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role_name?: string;
  is_superuser?: boolean;
  permissions?: string[];
  must_change_password?: boolean;
  parent_id?: number | null;
};

/**
 * Parent App login. Uses the dedicated, role-verified endpoint
 * (`/auth/parent/login/`), so only accounts whose server-assigned role is
 * `parent` can obtain a token here. The identifier may be the registered
 * phone number, username, or email — the backend resolves it.
 */
export async function login(identifier: string, password: string) {
  const { data } = await api.post('/auth/parent/login/', { username: identifier, password });
  return data as {
    access: string;
    refresh: string;
    user: Me;
    role?: string;
    portal?: string;
    session_exp?: number | null;
  };
}

export async function changeMyPassword(old_password: string, new_password: string) {
  const { data } = await api.post('/auth/change-password/', { old_password, new_password });
  return data;
}

export async function health(): Promise<boolean> {
  try {
    const { data } = await axios.get(`${API_BASE.replace(/\/api$/, '')}/api/health/`, { timeout: 8000 });
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

export type AcademyBrand = {
  name: string;
  tagline: string;
  phone?: string;
  email?: string;
  address?: string;
  timings?: string;
};
export const DEFAULT_BRAND: AcademyBrand = {
  name: '',
  tagline: '',
  phone: '',
  email: '',
  address: '',
  timings: '',
};

let brandCache: AcademyBrand | null = null;
let brandInflight: Promise<AcademyBrand> | null = null;

/** Public academy identity + contact details — no login needed. Cached; use refreshAcademyBrand() after a rename. */
export function academyBrand(): Promise<AcademyBrand> {
  if (brandCache) return Promise.resolve(brandCache);
  if (!brandInflight) {
    brandInflight = api
      .get('/settings/brand/')
      .then(({ data }) => {
        brandCache = {
          name: String(data?.name || DEFAULT_BRAND.name),
          tagline: String(data?.tagline || DEFAULT_BRAND.tagline),
          phone: String(data?.phone || ''),
          email: String(data?.email || ''),
          address: String(data?.address || ''),
          timings: String(data?.timings || ''),
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

/* ---------------- Parent domain ---------------- */

export type ParentProfile = {
  id: number;
  first_name: string;
  last_name?: string;
  relationship?: string;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  emergency_contact?: string;
  communication_preference?: string;
  created_at?: string;
};

export type ParentProfileUpdate = {
  first_name?: string;
  last_name?: string;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  emergency_contact?: string;
  communication_preference?: string;
};

export async function parentMe(): Promise<ParentProfile> {
  const { data } = await api.get('/parents/me/');
  return data;
}

export async function updateParentMe(patch: ParentProfileUpdate): Promise<ParentProfile> {
  const { data } = await api.patch('/parents/me/', patch);
  return data;
}

export type Child = {
  id: number;
  student_id: string;
  first_name: string;
  last_name?: string;
  dob?: string | null;
  gender?: string;
  photo?: string | null;
  sport?: number | null;
  sport_name?: string;
  school_name?: string;
  status?: string;
  enrollment_date?: string;
};

export async function children(): Promise<Child[]> {
  const { data } = await api.get('/students/', { params: { page_size: 50, ordering: 'first_name' } });
  return listOf(data);
}

export async function child(id: number): Promise<Child> {
  const { data } = await api.get(`/students/${id}/`);
  return data;
}

export type SessionItem = {
  id: number;
  sport?: number;
  sport_name?: string;
  batch?: number;
  batch_name?: string;
  coach_name?: string;
  location_name?: string;
  date?: string;
  slot?: number;
  start_time?: string;
  end_time?: string;
  status?: string;
};

export async function childSessions(studentId: number, pageSize = 30): Promise<SessionItem[]> {
  const { data } = await api.get('/sessions/', {
    params: { student: studentId, ordering: 'date', page_size: pageSize },
  });
  return listOf(data);
}

export type AttendanceRec = {
  id: number;
  session: number;
  student: number;
  status: string;
  marked_at?: string;
};

export async function childAttendance(studentId: number, pageSize = 100): Promise<AttendanceRec[]> {
  const { data } = await api.get('/attendance/', {
    params: { student: studentId, page_size: pageSize },
  });
  return listOf(data);
}

export type Fee = {
  id: number;
  student: number;
  student_name?: string;
  period_label: string;
  amount: string | number;
  discount?: string | number;
  paid_total?: string | number;
  balance?: string | number;
  due_date?: string;
  status: string;
};

export async function childFees(studentId: number): Promise<Fee[]> {
  const { data } = await api.get('/fees/', { params: { student: studentId, page_size: 50 } });
  return listOf(data);
}

export type Payment = {
  id: number;
  student_fee: number;
  amount: string | number;
  currency?: string;
  status: string;
  provider?: string;
  receipt_no?: string | null;
  verified?: boolean;
  created_at?: string;
};

export async function payments(): Promise<Payment[]> {
  const { data } = await api.get('/payments/', { params: { page_size: 100, ordering: '-created_at' } });
  return listOf(data);
}

export type Certificate = {
  id: number;
  title: string;
  sport_name?: string;
  period_from?: string;
  period_to?: string;
  milestone_date?: string;
  certificate_no?: string;
  attendance_pct?: string | number | null;
  sessions_completed?: number;
  description?: string;
  file?: string | null;
  issued_at?: string;
};

export async function childCertificates(studentId: number): Promise<Certificate[]> {
  const { data } = await api
    .get('/students/certificates/', { params: { student: studentId, page_size: 30 } })
    .catch(() => ({ data: [] }));
  return listOf(data);
}

/**
 * Milestone eligibility per linked child, from the academy's configured
 * certificate policy (Settings → Student Certificates). The three-month
 * milestone reports a review/approaching state — it never implies issuance;
 * certificates appear here only after an academy admin issues them.
 */
export type CertState =
  | 'training'
  | 'approaching'
  | 'eligible'
  | 'review'
  | 'issued'
  | 'no_enrollment_date';

export type CertEligibility = {
  student: number;
  student_id: string;
  name: string;
  sport?: string | null;
  enrollment_date?: string | null;
  milestone_date?: string | null;
  state: CertState;
  checks: { active?: boolean; attendance?: boolean; sessions?: boolean };
  attendance_pct?: number | null;
  sessions_completed?: number;
  certificate?: { id: number; certificate_no?: string | null; file?: string | null } | null;
};

export async function certificateEligibility(): Promise<CertEligibility[]> {
  const { data } = await api.get('/students/certificates/eligibility/').catch(() => ({ data: {} as any }));
  return Array.isArray(data?.results) ? (data.results as CertEligibility[]) : [];
}

export type AppNotification = {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  channel?: string;
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
export async function markAllNotificationsRead() {
  const { data } = await api.post('/notifications/mark_all_read/');
  return data;
}

export type Sport = { id: number; name: string; code: string };
export async function sports(): Promise<Sport[]> {
  const { data } = await api.get('/sports/sports/', { params: { page_size: 20 } });
  return listOf(data);
}

/* ---------------- Support tickets ---------------- */

export type SupportReply = {
  id: number;
  author_name?: string;
  body: string;
  is_internal?: boolean;
  created_at?: string;
};

export type SupportTicket = {
  id: number;
  subject: string;
  description: string;
  category?: string;
  category_display?: string;
  priority?: string;
  priority_display?: string;
  status: string;
  status_display?: string;
  created_by_name?: string;
  assigned_to_name?: string;
  created_at?: string;
  updated_at?: string;
  resolved_at?: string | null;
  replies?: SupportReply[];
  reply_count?: number;
};

export async function supportTickets(): Promise<SupportTicket[]> {
  const { data } = await api.get('/support/tickets/', { params: { page_size: 50, ordering: '-updated_at' } });
  return listOf(data);
}

export async function createTicket(payload: {
  subject: string;
  description: string;
  category?: string;
  priority?: string;
}): Promise<SupportTicket> {
  const { data } = await api.post('/support/tickets/', payload);
  return data;
}

export async function replyTicket(id: number, body: string): Promise<SupportReply> {
  const { data } = await api.post(`/support/tickets/${id}/reply/`, { body });
  return data;
}
