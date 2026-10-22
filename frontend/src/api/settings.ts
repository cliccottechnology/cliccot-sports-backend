import { useCallback, useEffect, useState } from 'react';
import api from './client';

export type SettingFieldType = 'text' | 'textarea' | 'number' | 'time' | 'select' | 'toggle' | 'weekdays';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type SettingFieldDef = {
  key: string;
  label: string;
  type: SettingFieldType;
  def: any;
  hint?: string;
  options?: string[];
  min?: number;
  max?: number;
  fullWidth?: boolean;
};

export type SettingSection = { id: string; title: string; sub: string; fields: SettingFieldDef[] };

/** Client-friendly academy configuration. Stored in the backend key-value
 *  store (/api/settings/) — no JSON typing needed. Every entry is consumed
 *  somewhere real (see `settingDocs` in the Settings page). */
export const SETTING_SECTIONS: SettingSection[] = [
  {
    id: 'academy',
    title: 'Academy Profile',
    sub: 'Shown on the Settings page and used across academy paperwork.',
    fields: [
      { key: 'academy.name', label: 'Academy name', type: 'text', def: '' },
      { key: 'academy.tagline', label: 'Tagline', type: 'text', def: '' },
      { key: 'academy.phone', label: 'Phone', type: 'text', def: '' },
      { key: 'academy.email', label: 'Email', type: 'text', def: '' },
      { key: 'academy.address', label: 'Address', type: 'textarea', def: '', fullWidth: true },
      { key: 'academy.timings', label: 'Training hours', type: 'text', def: '', hint: 'e.g. Mon–Sat · 6 AM – 8 PM', fullWidth: true },
    ],
  },
  {
    id: 'certificates',
    title: 'Student Certificates',
    sub: 'Three-month milestone policy. Leave thresholds empty for duration-only eligibility.',
    fields: [
      { key: 'certificate.min_months', label: 'Training months required', type: 'number', def: 3, min: 1, max: 24, hint: 'Milestone measured from the sport enrollment date.' },
      { key: 'certificate.min_attendance_pct', label: 'Minimum attendance % (blank = none)', type: 'number', def: '' as any, min: 0, max: 100, hint: 'Present ÷ marked records in the milestone window.' },
      { key: 'certificate.min_sessions', label: 'Minimum completed sessions', type: 'number', def: 0, min: 0, max: 500, hint: 'Assigned sessions completed in the milestone window.' },
      { key: 'certificate.require_active', label: 'Require active enrollment', type: 'toggle', def: true },
    ],
  },
  {
    id: 'schedule',
    title: 'Sessions & Scheduling',
    sub: 'The academy runs Session 1 / 2 / 3 per day. Default times pre-fill the scheduling form.',
    fields: [
      { key: 'schedule.slot1_start', label: 'Session 1 start', type: 'time', def: '06:00' },
      { key: 'schedule.slot1_end', label: 'Session 1 end', type: 'time', def: '07:00' },
      { key: 'schedule.slot2_start', label: 'Session 2 start', type: 'time', def: '17:00' },
      { key: 'schedule.slot2_end', label: 'Session 2 end', type: 'time', def: '18:00' },
      { key: 'schedule.slot3_start', label: 'Session 3 start', type: 'time', def: '18:30' },
      { key: 'schedule.slot3_end', label: 'Session 3 end', type: 'time', def: '19:30' },
      { key: 'schedule.default_batch_capacity', label: 'Default batch capacity', type: 'number', def: 30, min: 1, max: 500, hint: 'Pre-fills the batch creation form.' },
      { key: 'schedule.break_minutes', label: 'Break between a trainer\'s sessions (minutes)', type: 'number', def: 0, min: 0, max: 120, hint: 'Travel/preparation buffer. 0 = back-to-back allowed. Conflicts and slot suggestions honour this.' },
      { key: 'academy.week_off_days', label: 'Academy week off days', type: 'weekdays', def: [] as number[], hint: 'Checked days are academy holidays — new sessions cannot be scheduled on them.', fullWidth: true },
    ],
  },
  {
    id: 'attendance',
    title: 'Attendance',
    sub: 'Rules applied on the attendance screen.',
    fields: [
      { key: 'attendance.require_correction_reason', label: 'Require a reason when overwriting saved marks', type: 'toggle', def: true },
      { key: 'attendance.makeup_requires_approval', label: 'Make-up attendance needs admin approval', type: 'toggle', def: true, hint: 'When on, only an admin (sessions.edit / attendance.correct) can add a student for a make-up session. Trainers mark the make-up once it is scheduled.' },
      { key: 'attendance.notify_parents_on_present', label: 'Notify parents in the app when a child is marked present', type: 'toggle', def: true, hint: 'Adds a notice to the parent app inbox each time a student is marked present. Already-present records are never re-notified.' },
    ],
  },
  {
    id: 'trainer',
    title: 'Trainer Salary',
    sub: 'Trainers are paid per completed session at their configured rate.',
    fields: [
      { key: 'trainer.require_session_validation', label: 'Require admin validation before a session counts', type: 'toggle', def: false, hint: 'Off = every completed session is payable. Make-up sessions always require validation.' },
    ],
  },
  {
    id: 'fees',
    title: 'Fees',
    sub: 'Defaults pre-fill the fee forms. Amounts always come from fee plans.',
    fields: [
      { key: 'fees.default_cycle', label: 'Default plan cycle', type: 'select', def: 'monthly', options: ['monthly', 'quarterly', 'half_yearly'] },
      { key: 'fees.default_due_day', label: 'Default due day of month', type: 'number', def: 5, min: 1, max: 28, hint: 'Pre-fills the due date when allocating fees.' },
    ],
  },
  {
    id: 'comms',
    title: 'WhatsApp & Communication',
    sub: 'Sender details and the default template pre-selected in the send form.',
    fields: [
      { key: 'whatsapp.sender_number', label: 'Sender / display number', type: 'text', def: '' },
      { key: 'whatsapp.default_template', label: 'Default message template', type: 'text', def: '', hint: 'Must match a template name on the WhatsApp page.' },
    ],
  },
];

export const ALL_DEFS: Record<string, SettingFieldDef> = Object.fromEntries(
  SETTING_SECTIONS.flatMap((s) => s.fields.map((f) => [f.key, f])),
);

export type StoredSetting = { id?: number; key: string; value: any };

const toRows = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
};

/** Load the whole store once: { key: { id?, value } }. */
export async function loadSettingsStore(): Promise<Record<string, StoredSetting>> {
  const { data } = await api.get('/settings/', { params: { page_size: 200 } });
  const map: Record<string, StoredSetting> = {};
  for (const r of toRows(data)) map[r.key] = { id: r.id, key: r.key, value: r.value };
  return map;
}

/** Plain values with schema defaults applied for missing keys. */
export function valuesWithDefaults(store: Record<string, StoredSetting>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, f] of Object.entries(ALL_DEFS)) out[k] = store[k]?.value ?? f.def;
  return out;
}

export function useAcademySettings() {
  const [store, setStore] = useState<Record<string, StoredSetting>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    loadSettingsStore()
      .then((m) => live && setStore(m))
      .catch(() => live && setError('Could not load settings.'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [tick]);
  return { store, values: valuesWithDefaults(store), loading, error, reload };
}

/** Create or update one key. */
export async function saveSetting(store: Record<string, StoredSetting>, key: string, value: any) {
  const existing = store[key];
  if (existing?.id) {
    await api.patch(`/settings/${existing.id}/`, { value });
  } else {
    await api.post('/settings/', { key, value });
  }
  if (key === 'academy.name' || key === 'academy.tagline') refreshAcademyBrand();
}

export type AcademyBrand = { name: string; tagline: string };
export const DEFAULT_BRAND: AcademyBrand = { name: '', tagline: '' };

let brandCache: AcademyBrand | null = null;
let brandInflight: Promise<void> | null = null;
const brandSubs = new Set<() => void>();

function fetchBrand(): Promise<void> {
  if (!brandInflight) {
    // Public endpoint (AllowAny) so the brand renders on the login screen too,
    // before any authentication is available.
    brandInflight = api
      .get('/settings/brand/')
      .then(({ data }: { data: any }) => {
        brandCache = {
          name: String(data?.name || DEFAULT_BRAND.name),
          tagline: String(data?.tagline || DEFAULT_BRAND.tagline),
        };
      })
      .catch(() => {
        brandCache = { ...DEFAULT_BRAND };
      })
      .finally(() => {
        brandInflight = null;
        brandSubs.forEach((fn) => fn());
      });
  }
  return brandInflight;
}

/** Live academy brand (name + tagline). Shared cache: one request, instant updates on save. */
export function useAcademyBrand(): AcademyBrand {
  const [, setTick] = useState(0);
  useEffect(() => {
    const sub = () => setTick((t) => t + 1);
    brandSubs.add(sub);
    if (brandCache) sub();
    else fetchBrand();
    return () => {
      brandSubs.delete(sub);
    };
  }, []);
  return brandCache ?? DEFAULT_BRAND;
}

/** Re-read name/tagline from the backend and push to all subscribers. */
export function refreshAcademyBrand(): void {
  brandCache = null;
  fetchBrand();
}
