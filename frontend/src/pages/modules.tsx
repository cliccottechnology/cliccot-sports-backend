import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CreditCard, Eye, FileDown, FileSpreadsheet, FileText, Hourglass, Pencil, Play, Plus, RefreshCw, Search, ShieldCheck, UserCheck, UserX, Users as UsersIcon, Wallet, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api, { errMsg } from '../api/client';
import {
  ALL_DEFS,
  SETTING_SECTIONS,
  WEEKDAYS,
  saveSetting,
  useAcademySettings,
  type SettingFieldDef,
  type SettingSection,
} from '../api/settings';
import { ChangePasswordCard } from './Account';
import {
  Avatar,
  Button,
  ConfirmDialog,
  DataTable,
  DetailRows,
  Drawer,
  Empty,
  Field,
  FilterBar,
  FormSection,
  PageHeader,
  ProTable,
  SearchInput,
  Section,
  Select,
  SkeletonGrid,
  StatCard,
  StatusBadge,
  Tabs,
  Toast,
} from '../components/ui';

/* ================= shared helpers ================= */

type Paged = { rows: any[]; count: number; err: string; page: number; setPage: (n: number) => void; reload: () => void; loading: boolean };

function toRows(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function usePaged(url: string, params: Record<string, any> = {}, pageSize = 20): Paged {
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [err, setErr] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params);
  useEffect(() => { setPage(1); }, [key]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    const qp = { ...JSON.parse(key), page };
    api.get(url, { params: qp })
      .then((r) => {
        if (!live) return;
        setRows(toRows(r.data));
        setCount(typeof r.data?.count === 'number' ? r.data.count : toRows(r.data).length);
        setErr('');
      })
      .catch((e) => live && setErr(errMsg(e)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key, page, tick]);
  return { rows, count, err, page, setPage: (n: number) => setPage(Math.max(1, n)), reload: () => setTick((t) => t + 1), loading };
}

function useOptions(url: string) {
  const [opts, setOpts] = useState<any[]>([]);
  useEffect(() => { api.get(url).then((r) => setOpts(toRows(r.data))).catch(() => {}); }, [url]);
  return opts;
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="jetz-card" style={{ marginBottom: 14 }}><div className="jetz-form-card" style={{ marginBottom: 0 }}>{children}</div></div>;
}

function Pager({ page, count, setPage, pageSize = 20 }: { page: number; count: number; setPage: (n: number) => void; pageSize?: number }) {
  const total = Math.max(1, Math.ceil(count / pageSize));
  if (total <= 1) return null;
  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, total - 4));
  for (let p = start; p <= Math.min(total, start + 4); p++) pages.push(p);
  return (
    <div className="jetz-table-foot jetz-pager-standalone">
      <span>Page {page} of {total} · {count} records</span>
      <div className="jetz-pager">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">Prev</Button>
        {pages.map((p) => (
          <button key={p} type="button" className={`jetz-pager-num${p === page ? ' current' : ''}`} aria-label={`Page ${p}`} aria-current={p === page ? 'page' : undefined} onClick={() => setPage(p)}>
            {p}
          </button>
        ))}
        <Button size="sm" variant="secondary" disabled={page >= total} onClick={() => setPage(page + 1)} aria-label="Next page">Next</Button>
      </div>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <span className="jetz-search-wrap" style={{ minWidth: 200, flex: '1 1 200px' }}>
      <Search aria-hidden="true" />
      <input
        className="jetz-input jetz-search-input"
        role="searchbox"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className="jetz-search-clear" aria-label="Clear search" onClick={() => onChange('')}>
          <X />
        </button>
      )}
    </span>
  );
}

function Detail({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="jetz-card jetz-detail" style={{ marginTop: 14 }}>
      <div className="jetz-detail-head">
        <div>
          <div className="jetz-detail-eyebrow">Details</div>
          <strong className="jetz-detail-title">{title}</strong>
        </div>
        <button type="button" className="jetz-icon-btn jetz-detail-close" onClick={onClose} aria-label="Close details">
          <X />
        </button>
      </div>
      {children}
    </div>
  );
}

const STUDENT_STATUSES = ['active', 'inactive', 'pending', 'suspended', 'completed', 'withdrawn'];
const SESSION_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];
const FEE_STATUSES = ['upcoming', 'due', 'pending', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded'];
const todayISO = () => new Date().toISOString().slice(0, 10);

/** Hide UI affordances the user may not use. The backend re-checks every call. */
function Can({ code, children }: { code: string; children: React.ReactNode }) {
  const { can } = useAuth();
  return can(code) ? <>{children}</> : null;
}

/* ================= SPORTS ================= */

export function Sports() {
  const [search, setSearch] = useState('');
  const { rows, count, err, page, setPage, reload } = usePaged('/sports/sports/', search ? { search } : {});
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [ach, setAch] = useState<any[]>([]);
  const [achForm, setAchForm] = useState({ title: '', date: todayISO(), sport: '', description: '' });
  const [achBusy, setAchBusy] = useState(false);
  const [achPhoto, setAchPhoto] = useState<File | null>(null);
  const achInput = useRef<HTMLInputElement>(null);
  const loadAch = async () => {
    try {
      const { data } = await api.get('/sports/achievements/', { params: { page_size: 20 } });
      setAch(toRows(data));
    } catch { /* table stays as-is */ }
  };
  useEffect(() => { loadAch(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg('');
    try {
      await api.post('/sports/sports/', { ...form, is_active: true });
      setForm({ name: '', code: '', description: '' }); reload();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const toggle = async (s: any) => {
    try { await api.patch(`/sports/sports/${s.id}/`, { is_active: !s.is_active }); reload(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };
  const view = async (s: any) => {
    try {
      const [b, st] = await Promise.all([
        api.get('/batches/', { params: { sport: s.id } }),
        api.get('/students/', { params: { sport: s.id } }),
      ]);
      setDetail({ ...s, batches: toRows(b.data), students: toRows(st.data) });
    } catch (e: any) { setMsg(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Academy / Sports" title="Sports" count={count} sub={`${count} sports · Football, Cricket, Skating configured · future sports need no redesign`} actions={<Button size="sm" variant="secondary" onClick={reload}>Refresh</Button>} />
      <Toast msg={err || msg} />
      {ok && <Toast msg={ok} kind="success" />}
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search sports…" />
        <form onSubmit={create} style={{ display: 'contents' }}>
          <Field label="Name *" placeholder="Football" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Field label="Code *" placeholder="FB" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Field label="Description" placeholder="Outdoor team sport" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Can code="sports.create"><Button type="submit" variant="accent">Add sport</Button></Can>
        </form>
      </Toolbar>
      <DataTable
        columns={['Sport', 'Code', 'Batches', 'Students', 'Active', 'Actions']}
        rows={rows.map((s: any) => [
          s.name, s.code, s.batch_count ?? (s.batches?.length ?? '-'), s.student_count ?? '-',
          <StatusBadge key={s.id} value={s.is_active ? 'active' : 'inactive'} />,
          <span key={'a' + s.id} style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={() => view(s)}>View</Button>
            <Can code="sports.edit"><Button size="sm" variant={s.is_active ? 'secondary' : 'accent'} onClick={() => toggle(s)}>{s.is_active ? 'Deactivate' : 'Activate'}</Button></Can>
          </span>,
        ])}
      />
      <Pager page={page} count={count} setPage={setPage} />
      {detail && (
        <Detail title={`${detail.name} — batches, students, coaches`} onClose={() => setDetail(null)}>
          <p className="jetz-note">{detail.description || 'No description.'} · Code {detail.code}</p>
          <DataTable columns={['Batch', 'Coach', 'Students']} rows={(detail.batches || []).map((b: any) => [b.name, b.coach_name || '-', b.student_count ?? '-'])} empty="No batches for this sport." />
          <div style={{ height: 10 }} />
          <DataTable columns={['Student ID', 'Name', 'Status']} rows={(detail.students || []).slice(0, 10).map((s: any) => [s.student_id, `${s.first_name} ${s.last_name || ''}`, s.status])} empty="No students enrolled." />
        </Detail>
      )}

      <Section title="Institute achievements" sub="Tournament wins, milestones and honours — showcased in the trainer app">
        <form
          onSubmit={async (e) => {
            e.preventDefault(); setMsg(''); setOk('');
            if (!achForm.title.trim() || !achForm.date) { setMsg('Achievement title and date are required.'); return; }
            if (achBusy) return;
            setAchBusy(true);
            try {
              const fd = new FormData();
              fd.append('title', achForm.title.trim());
              fd.append('date', achForm.date);
              if (achForm.sport) fd.append('sport', achForm.sport);
              if (achForm.description.trim()) fd.append('description', achForm.description.trim());
              if (achPhoto) fd.append('photo', achPhoto);
              await api.post('/sports/achievements/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
              setAchForm({ title: '', date: todayISO(), sport: '', description: '' });
              setAchPhoto(null);
              setOk('Achievement published — trainers see it in their app.');
              loadAch();
            } catch (e: any) { setMsg(errMsg(e)); }
            finally { setAchBusy(false); }
          }}
          className="jetz-card"
          style={{ marginBottom: 12 }}
        >
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <Field label="Title *" placeholder="U-14 district champions" value={achForm.title} onChange={(e) => setAchForm({ ...achForm, title: e.target.value })} required />
            <Field label="Date *" type="date" value={achForm.date} onChange={(e) => setAchForm({ ...achForm, date: e.target.value })} required />
            <label><span className="jetz-label">Sport</span><Select value={achForm.sport} onChange={(e) => setAchForm({ ...achForm, sport: e.target.value })}><option value="">All sports</option>{rows.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
            <Field label="Description" placeholder="What was achieved" value={achForm.description} onChange={(e) => setAchForm({ ...achForm, description: e.target.value })} />
            <div>
              <span className="jetz-label">Photo</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Button type="button" variant="secondary" onClick={() => achInput.current?.click()}>{achPhoto ? 'Change…' : 'Choose…'}</Button>
                <input ref={achInput} type="file" accept=".jpg,.jpeg,.png,.webp" hidden onChange={(e) => setAchPhoto(e.target.files?.[0] || null)} />
                <span className="jetz-file-name">{achPhoto ? achPhoto.name : 'No file chosen'}</span>
              </div>
            </div>
            <Can code="sports.create"><Button type="submit" variant="accent" disabled={achBusy}>{achBusy ? 'Publishing…' : 'Publish achievement'}</Button></Can>
          </div>
        </form>
        <DataTable
          columns={['Title', 'Date', 'Sport', 'Description', 'Photo']}
          rows={ach.map((a: any) => [
            <span key={'t' + a.id} style={{ fontWeight: 600 }}>{a.title}</span>,
            a.date,
            a.sport_name || 'All sports',
            (a.description || '—').slice(0, 80),
            a.photo ? <a key={'p' + a.id} href={a.photo} target="_blank" rel="noreferrer">View</a> : '—',
          ])}
          empty="No achievements yet — publish the institute's first win above."
        />
      </Section>
    </div>
  );
}

/* ================= STUDENTS ================= */

export function Students() {
  const { can, user } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sport, setSport] = useState('');
  const [batch, setBatch] = useState('');
  const [schoolF, setSchoolF] = useState('');
  const [ordering, setOrdering] = useState('-created_at');
  const [sumTick, setSumTick] = useState(0);
  const [summary, setSummary] = useState<{ total: number; by_status: Record<string, number> } | null>(null);
  const { rows, count, err, page, setPage, reload, loading } = usePaged('/students/', { ...(search ? { search } : {}), ...(status ? { status } : {}), ...(sport ? { sport } : {}), ...(batch ? { batch } : {}), ...(schoolF ? { school: schoolF } : {}), ordering });
  const doReload = () => { reload(); setSumTick((t) => t + 1); };
  useEffect(() => { api.get('/students/summary/').then((r) => setSummary(r.data)).catch(() => {}); }, [sumTick]);
  const sports = useOptions('/sports/sports/');
  const batches = useOptions('/batches/');
  const schools = useOptions('/schools/');
  const [form, setForm] = useState({ student_id: '', first_name: '', last_name: '', dob: '', gender: '', phone: '', whatsapp: '', email: '', address: '', emergency_contact: '', enrollment_date: '', status: 'pending', sport: '', batch: '', school: '' });
  const [editing, setEditing] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailParents, setDetailParents] = useState<any[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<any>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [certState, setCertState] = useState('');
  const [certRows, setCertRows] = useState<any[]>([]);
  const [certCounts, setCertCounts] = useState<Record<string, number>>({});
  const [certBusy, setCertBusy] = useState(false);
  const [issueTarget, setIssueTarget] = useState<any>(null);
  const loadCerts = async () => {
    try {
      const { data } = await api.get('/students/certificates/eligibility/', {
        params: { ...(certState ? { state: certState } : {}), ...(sport ? { sport } : {}) },
      });
      setCertRows(data.results || []);
      setCertCounts(data.counts || {});
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  useEffect(() => { loadCerts(); }, [certState, sport]);
  const issueCert = async () => {
    if (!issueTarget || certBusy) return;
    setCertBusy(true); setMsg(''); setOk('');
    try {
      const { data } = await api.post('/students/certificates/issue/', { student: issueTarget.student });
      const n = data.notified || {};
      setOk(`Certificate ${data.certificate_no} issued to ${issueTarget.name} — parents notified: inbox ${n.inbox ?? 0}, WhatsApp ${n.whatsapp ?? 0}.`);
      setIssueTarget(null);
      loadCerts();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setCertBusy(false); }
  };
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [refFiles, setRefFiles] = useState<Array<{ file: File; preview: string; angle: string }>>([]);
  const [refConsentBy, setRefConsentBy] = useState('');
  const profileInput = useRef<HTMLInputElement>(null);
  const refsInput = useRef<HTMLInputElement>(null);
  const resetForm = () => {
    setForm({ student_id: '', first_name: '', last_name: '', dob: '', gender: '', phone: '', whatsapp: '', email: '', address: '', emergency_contact: '', enrollment_date: '', status: 'pending', sport: '', batch: '', school: '' });
    setPhotoFile(null); setPhotoPreview(''); setRefFiles([]); setRefConsentBy(''); setEditing(null);
  };
  const onPhoto = (f: File | undefined) => {
    if (!f) { setPhotoFile(null); setPhotoPreview(''); return; }
    if (!/\.(jpe?g|png|webp)$/i.test(f.name)) { setMsg('Photo must be JPG, PNG, or WEBP.'); return; }
    if (f.size > 10 * 1024 * 1024) { setMsg('Photo too large (max 10 MB).'); return; }
    setMsg(''); setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f));
  };
  const onRefFiles = (list: FileList | null) => {
    if (!list) return;
    const ok: Array<{ file: File; preview: string; angle: string }> = [];
    for (const f of Array.from(list)) {
      if (!/\.(jpe?g|png|webp)$/i.test(f.name)) { setMsg(`Skipped ${f.name}: must be JPG, PNG, or WEBP.`); continue; }
      if (f.size > 10 * 1024 * 1024) { setMsg(`Skipped ${f.name}: too large (max 10 MB).`); continue; }
      ok.push({ file: f, preview: URL.createObjectURL(f), angle: 'front' });
    }
    setRefFiles((prev) => [...prev, ...ok].slice(0, 5));
    setMsg('');
  };

  const submit = async (e: React.FormEvent, addAnother = false) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (busy) return;
    if (!form.student_id.trim() || !form.first_name.trim()) { setMsg('Student ID and first name are required.'); return; }
    if (!form.enrollment_date) { setMsg('Enrollment date is required.'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setMsg('Enter a valid email address.'); return; }
    if ((form.phone || form.whatsapp) && !/^[+\d][\d\s-]{5,}$/.test(form.phone || form.whatsapp)) { setMsg('Enter a valid phone number.'); return; }
    if (refFiles.length > 0 && !refConsentBy.trim()) { setMsg('Enter who gave consent for the AI reference photos (parent/guardian).'); return; }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (k !== 'batch' && v !== '' && v !== null) fd.append(k, v as string); });
    if (!form.sport) fd.delete('sport');
    if (photoFile) fd.append('photo', photoFile);
    // Empty strings must never reach DRF (e.g. dob:'' fails DateField validation).
    const cleanPayload = () => {
      const p: any = { ...form };
      delete p.batch;
      if (!p.sport) delete p.sport;
      Object.keys(p).forEach((k) => { if (p[k] === '' || p[k] === null) delete p[k]; });
      return p;
    };
    const uploadRefs = async (studentPk: number) => {
      let failed = 0;
      for (const r of refFiles) {
        const rfd = new FormData();
        rfd.append('student', String(studentPk));
        rfd.append('image', r.file);
        rfd.append('angle', r.angle);
        rfd.append('consent_given', 'true');
        rfd.append('consented_by', refConsentBy.trim());
        try { await api.post('/students/reference-photos/', rfd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
        catch { failed += 1; }
      }
      return failed;
    };
    try {
      setBusy(true);
      const assignBatch = async (studentPk: number) => {
        if (!form.batch) return;
        try { await api.post('/batches/rosters/list/', { batch: Number(form.batch), student: studentPk }); }
        catch (e: any) { setMsg(`Student saved, but batch assignment failed: ${errMsg(e)}`); }
      };
      if (editing) {
        if (photoFile) await api.patch(`/students/${editing.id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        else await api.patch(`/students/${editing.id}/`, cleanPayload());
        const failed = await uploadRefs(editing.id);
        resetForm(); doReload();
        setOk(failed ? `Student saved, but ${failed} reference photo(s) failed (max 5 active per student).` : 'Student saved.');
      } else {
        const { data } = await api.post('/students/', photoFile ? fd : cleanPayload(), photoFile ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
        await assignBatch(data.id);
        const failed = await uploadRefs(data.id);
        const keepSport = addAnother ? form.sport : '';
        const keepBatch = addAnother ? form.batch : '';
        resetForm(); doReload();
        if (addAnother) setForm((f) => ({ ...f, sport: keepSport, batch: keepBatch }));
        setOk(failed ? `Student saved, but ${failed} reference photo(s) failed (max 5 active per student).` : `Student ${data.student_id} saved.`);
      }
    } catch (e: any) { setMsg(e?.response?.data?.photo?.[0] || e?.response?.data?.photo || errMsg(e)); }
    finally { setBusy(false); }
  };

  const openDetail = async (s: any) => {
    try {
      const [att, fees, up, links] = await Promise.all([
        api.get('/attendance/', { params: { student: s.id } }).catch(() => ({ data: [] })),
        api.get('/fees/', { params: { student: s.id } }).catch(() => ({ data: [] })),
        api.get('/sessions/', { params: { student: s.id, date__gte: todayISO(), ordering: 'date', page_size: 5 } }).catch(() => ({ data: [] })),
        api.get('/parents/links/list/', { params: { student: s.id } }).catch(() => ({ data: [] })),
      ]);
      setDetailParents(toRows(links.data));
      setDetail({ ...s, attendance: toRows(att.data).slice(0, 10), fees: toRows(fees.data).slice(0, 10), upcoming: toRows(up.data).slice(0, 5) });
    } catch (e: any) { setMsg(errMsg(e)); }
  };

  const toggleStatus = async (s: any) => {
    const next = s.status === 'active' ? 'inactive' : 'active';
    setConfirmBusy(true);
    try { await api.patch(`/students/${s.id}/`, { status: next }); setOk(`Status set to ${next}.`); setConfirmTarget(null); doReload(); }
    catch (e: any) { setMsg(errMsg(e)); }
    finally { setConfirmBusy(false); }
  };

  const sortKey = ordering.startsWith('-') ? ordering.slice(1) : ordering;
  const sortDir = ordering.startsWith('-') ? 'desc' : 'asc';
  const onSort = (key: string) => {
    setOrdering((o) => {
      const cur = o.startsWith('-') ? o.slice(1) : o;
      const desc = o.startsWith('-');
      if (cur !== key) return key === 'created_at' ? '-created_at' : key;
      return desc ? key : `-${key}`;
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="JETZ Academy / Academy / Students"
        title="Students"
        count={summary?.total ?? count}
        sub="Registrations, profiles, AI reference photos and full history. IDs are unique and duplicate-checked."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={doReload} disabled={loading}>
              <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
            </Button>
            <Button size="sm" variant="accent" onClick={() => { resetForm(); document.getElementById('student-form-start')?.scrollIntoView({ behavior: 'smooth' }); }}>
              <Plus style={{ width: 14, height: 14 }} /> Add Student
            </Button>
          </>
        }
      />
      {summary && (
        <div className="jetz-stat-grid" style={{ marginBottom: 14 }}>
          <StatCard label="Total Students" value={summary.total} sub="Across all sports & batches" icon={<UsersIcon />} accent />
          <StatCard label="Active" value={summary.by_status.active || 0} sub="Training now" icon={<UserCheck />} />
          <StatCard label="Pending Registrations" value={summary.by_status.pending || 0} sub="Awaiting activation" icon={<Hourglass />} />
          <StatCard label="Inactive" value={summary.by_status.inactive || 0} sub="Paused or archived" icon={<UserX />} />
        </div>
      )}
      {msg ? <Toast msg={msg} kind="danger" /> : <Toast msg={err} kind="danger" />}
      {ok && <Toast msg={ok} kind="success" />}
      <FilterBar count={count} loading={loading}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search ID, name, phone…" label="Search" />
        <label className="jetz-field" style={{ display: 'block' }}>
          <span className="jetz-label">Status</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
            <option value="">All statuses</option>
            {STUDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </label>
        <label className="jetz-field" style={{ display: 'block' }}>
          <span className="jetz-label">Sport</span>
          <Select value={sport} onChange={(e) => setSport(e.target.value)} style={{ width: '100%' }}>
            <option value="">All sports</option>
            {sports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </label>
        <label className="jetz-field" style={{ display: 'block' }}>
          <span className="jetz-label">Batch</span>
          <Select value={batch} onChange={(e) => setBatch(e.target.value)} style={{ width: '100%' }}>
            <option value="">All batches</option>
            {batches.map((b: any) => <option key={b.id} value={b.id}>{b.name}{b.sport_name ? ` (${b.sport_name})` : ''}</option>)}
          </Select>
        </label>
        {schools.length > 0 && (
          <label className="jetz-field" style={{ display: 'block' }}>
            <span className="jetz-label">School</span>
            <Select value={schoolF} onChange={(e) => setSchoolF(e.target.value)} style={{ width: '100%' }}>
              <option value="">All schools</option>
              {schools.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </label>
        )}
        <label className="jetz-field" style={{ display: 'block' }}>
          <span className="jetz-label">Sort by</span>          <Select value={ordering} onChange={(e) => setOrdering(e.target.value)} title="Sort order" style={{ width: '100%' }}>
            <option value="-created_at">Newest first</option>
            <option value="first_name">Name A–Z</option>
            <option value="enrollment_date">Enrollment date ↑</option>
            <option value="-enrollment_date">Enrollment date ↓</option>
          </Select>
        </label>
        {(search || status || sport || batch || schoolF) && <Button variant="ghost" onClick={() => { setSearch(''); setStatus(''); setSport(''); setBatch(''); setSchoolF(''); }}>Clear all</Button>}
      </FilterBar>
      <form onSubmit={submit} className="jetz-card" style={{ marginBottom: 14 }} id="student-form-start" aria-label={editing ? 'Edit student' : 'Register student'}>
        <div className="jetz-panel-title" style={{ fontSize: 15 }}>{editing ? `Edit ${editing.student_id}` : 'Register student'}</div>
        <div className="jetz-panel-sub">{editing ? 'Changes are audited. Saving overwrites the profile.' : 'Takes under a minute. Profile and AI photos can be added now or later.'}</div>
        <div className="jetz-form-sections">
          <FormSection index={1} title="Student information" desc="Identity fields. Student ID must stay unique.">
            <Field label="Student ID" required placeholder="JETZ-001" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
            <Field label="First name" required placeholder="Athlete first name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <Field label="Last name" placeholder="Athlete last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            <Field label="Date of birth" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            <label className="jetz-field" style={{ display: 'block' }}><span className="jetz-label">Gender</span>
              <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} style={{ width: '100%' }}>
                <option value="">—</option>
                {['male', 'female', 'other'].map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
            </label>
          </FormSection>
          <FormSection index={2} title="Contact information" desc="At least a phone or WhatsApp number is recommended.">
            <Field label="Phone" placeholder="+91 …" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Field label="WhatsApp" placeholder="+91 …" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            <Field label="Email" type="email" placeholder="name@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Field label="Emergency contact" placeholder="Name & number" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
            <Field label="Address" placeholder="Street, area, city" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FormSection>
          <FormSection index={3} title="Academy information" desc="Enrollment, sport assignment and lifecycle status.">
            <Field label="Enrollment date" required type="date" value={form.enrollment_date} onChange={(e) => setForm({ ...form, enrollment_date: e.target.value })} />
            <label className="jetz-field" style={{ display: 'block' }}><span className="jetz-label">Sport</span>
              <Select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} style={{ width: '100%' }}>
                <option value="">—</option>
                {sports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
            <label className="jetz-field" style={{ display: 'block' }}><span className="jetz-label">Batch {editing ? '(managed in Batches)' : ''}</span>
              <Select value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} disabled={!!editing} style={{ width: '100%' }}>
                <option value="">—</option>
                {batches.map((b: any) => <option key={b.id} value={b.id}>{b.name}{b.sport_name ? ` (${b.sport_name})` : ''}</option>)}
              </Select>
            </label>
            <label className="jetz-field" style={{ display: 'block' }}><span className="jetz-label">Status</span>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ width: '100%' }}>
                {STUDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </label>
            {schools.length > 0 ? (
              <label className="jetz-field" style={{ display: 'block' }}><span className="jetz-label">School</span>
                <Select value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} style={{ width: '100%' }}>
                  <option value="">—</option>
                  {schools.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </label>
            ) : (user as any)?.school_name ? (
              <p className="jetz-note" style={{ margin: 0 }}>School: <strong>{(user as any).school_name}</strong> (fixed — new students join your school)</p>
            ) : null}
          </FormSection>
          <div className="jetz-form-section">
            <div className="jetz-form-section-head">
              <div className="jetz-form-section-title"><span className="n">4</span> Profile & AI reference photos</div>
              <p className="jetz-form-section-desc">Profile photo appears in lists. Reference photos (2+ angles) power AI attendance — consent is required.</p>
            </div>
            <div className="jetz-photo-section">
              <div className="jetz-photo-box">
                <div className="jetz-photo-title">Profile photo</div>
                <div className="jetz-photo-sub">JPG, PNG or WEBP · max 10 MB · shown in lists</div>
                <div className="jetz-photo-row">
                  {(photoPreview || editing?.photo) && (
                    <img src={photoPreview || editing?.photo} alt="profile preview" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--jetz-accent)', flexShrink: 0 }} />
                  )}
                  <Button type="button" variant="secondary" onClick={() => profileInput.current?.click()}>
                    {photoFile ? 'Change photo…' : 'Choose photo…'}
                  </Button>
                  <input ref={profileInput} type="file" accept=".jpg,.jpeg,.png,.webp" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                  {photoFile && (
                    <>
                      <span className="jetz-file-name" title={photoFile.name}>{photoFile.name}</span>
                      <Button type="button" size="sm" variant="secondary" onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}>Remove</Button>
                    </>
                  )}
                </div>
              </div>
              <div className="jetz-photo-box">
                <div className="jetz-photo-title">AI reference photos · {refFiles.length}/5</div>
                <div className="jetz-photo-sub">Add 2+ angles (front, left, right) so AI detects easily · JPG/PNG/WEBP · max 10 MB each</div>
                <div className="jetz-photo-row">
                  <Button type="button" variant="secondary" onClick={() => refsInput.current?.click()} disabled={refFiles.length >= 5}>
                    Choose photos…
                  </Button>
                  <input ref={refsInput} type="file" accept=".jpg,.jpeg,.png,.webp" multiple hidden onChange={(e) => { onRefFiles(e.target.files); e.target.value = ''; }} />
                  <span className="jetz-file-name">{refFiles.length ? `${refFiles.length} selected` : 'No files chosen'}</span>
                </div>
                {refFiles.length > 0 && (
                  <div className="jetz-photo-grid">
                    {refFiles.map((r, i) => (
                      <span key={i} className="jetz-photo-thumb">
                        <img src={r.preview} alt={`angle ${i + 1}`} />
                        <Select value={r.angle} onChange={(e) => setRefFiles((prev) => prev.map((p, j) => (j === i ? { ...p, angle: e.target.value } : p)))}>
                          {['front', 'left', 'right', 'other'].map((a) => <option key={a} value={a}>{a}</option>)}
                        </Select>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setRefFiles((prev) => prev.filter((_, j) => j !== i))}>✕</Button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 10, maxWidth: 320 }}>
                  <Field label="Consented by (parent/guardian) — required for AI photos" placeholder="Full name" value={refConsentBy} onChange={(e) => setRefConsentBy(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="jetz-form-actions">
          <Can code={editing ? 'students.edit' : 'students.create'}><Button type="submit" variant="accent" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save student'}</Button></Can>
          {!editing && <Can code="students.create"><Button type="button" variant="secondary" disabled={busy} onClick={(e) => submit(e as any, true)}>Save & Add Another</Button></Can>}
          {editing && <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>}
          {!editing && (form.student_id || form.first_name || form.phone) && <Button type="button" variant="ghost" onClick={resetForm}>Reset</Button>}
        </div>
      </form>
      <ProTable
        columns={[
          { key: 'athlete', label: 'Athlete', sortable: true, sortKey: 'first_name' },
          { key: 'student_id', label: 'Student ID', sortable: true, sortKey: 'student_id' },
          { key: 'sport', label: 'Sport' },
          { key: 'phone', label: 'Phone' },
          { key: 'ai', label: 'AI Photos' },
          { key: 'enrollment_date', label: 'Enrolled', sortable: true, sortKey: 'enrollment_date' },
          { key: 'status', label: 'Status' },
          { key: 'actions', label: 'Actions' },
        ]}
        rows={rows.map((s: any) => [
          <span key={'p' + s.id} className="jetz-cell-identity">
            <Avatar name={`${s.first_name} ${s.last_name || ''}`} src={s.photo} size={36} />
            <span className="tt">
              <span className="nm">{`${s.first_name} ${s.last_name || ''}`.trim()}</span>
              <span className="sb" style={{ display: 'block' }}>{s.student_id}</span>
            </span>
          </span>,
          <span key={'i' + s.id} style={{ fontWeight: 600 }}>{s.student_id}</span>,
          s.sport_name || '—',
          s.phone || '—',
          <span key={'r' + s.id} title={(s.reference_photos || []).map((p: any) => p.angle).join(', ') || 'No angles enrolled'}>
            {(s.reference_photos || []).length ? `📷 ${(s.reference_photos || []).length} angles` : '—'}
          </span>,
          s.enrollment_date || '—',
          <StatusBadge key={s.id} value={s.status} />,
          <span key={'a' + s.id} className="jetz-row-actions">
            <Button size="sm" variant="secondary" title={`View ${s.student_id} history`} onClick={() => openDetail(s)}><Eye style={{ width: 14, height: 14 }} /> View</Button>
            <Can code="students.edit"><Button size="sm" variant="secondary" title={`Edit ${s.student_id}`} onClick={() => { setEditing(s); setPhotoFile(null); setPhotoPreview(''); setRefFiles([]); setRefConsentBy(''); setOk(''); setForm({ student_id: s.student_id, first_name: s.first_name, last_name: s.last_name || '', dob: s.dob || '', gender: s.gender || '', phone: s.phone || '', whatsapp: s.whatsapp || '', email: s.email || '', address: s.address || '', emergency_contact: s.emergency_contact || '', enrollment_date: s.enrollment_date, status: s.status, sport: s.sport || '', batch: '', school: s.school ? String(s.school) : '' }); document.getElementById('student-form-start')?.scrollIntoView({ behavior: 'smooth' }); }}><Pencil style={{ width: 14, height: 14 }} /> Edit</Button></Can>
            <Can code="students.edit"><Button size="sm" variant="secondary" title={s.status === 'active' ? 'Set inactive (keeps all history)' : 'Set active'} onClick={() => setConfirmTarget(s)}>{s.status === 'active' ? 'Deactivate' : 'Activate'}</Button></Can>
          </span>,
        ])}
        loading={loading}
        error={err}
        onRetry={doReload}
        emptyTitle={search || status || sport || batch ? 'No students match these filters' : 'No students enrolled yet'}
        emptySub={search || status || sport || batch ? 'Try widening the search or clearing filters.' : 'Register the first athlete with the form above.'}
        emptyAction={(search || status || sport || batch) ? <Button size="sm" variant="secondary" onClick={() => { setSearch(''); setStatus(''); setSport(''); setBatch(''); }}>Clear all filters</Button> : undefined}
        sort={{ key: sortKey, dir: sortDir }}
        onSort={onSort}
        page={page}
        count={count}
        onPage={setPage}
      />
      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.status === 'active' ? 'Deactivate student?' : 'Activate student?'}
          message={confirmTarget.status === 'active'
            ? `${confirmTarget.first_name} ${confirmTarget.last_name || ''} (${confirmTarget.student_id}) will be set to inactive. Attendance, fee and audit history are preserved — nothing is deleted.`
            : `${confirmTarget.first_name} ${confirmTarget.last_name || ''} (${confirmTarget.student_id}) will be set back to active.`}
          confirmLabel={confirmTarget.status === 'active' ? 'Deactivate' : 'Activate'}
          danger={confirmTarget.status === 'active'}
          busy={confirmBusy}
          onConfirm={() => toggleStatus(confirmTarget)}
          onCancel={() => { if (!confirmBusy) setConfirmTarget(null); }}
        />
      )}
      <Section title="Certificate eligibility" sub="Three-month milestone from the sport enrollment date · approve to issue">
        <div className="jetz-stat-grid" style={{ marginBottom: 12 }}>
          <StatCard label="Approaching" value={certCounts.approaching || 0} sub="Milestone within 30 days" icon={<Hourglass />} />
          <StatCard label="Eligible for review" value={certCounts.eligible || 0} sub="Passed all checks" icon={<UserCheck />} accent />
          <StatCard label="Needs review" value={certCounts.review || 0} sub="Milestone passed, checks open" icon={<UsersIcon />} />
          <StatCard label="Issued" value={certCounts.issued || 0} sub="Certificates on record" icon={<Plus />} />
        </div>
        <div className="jetz-filterbar" style={{ marginBottom: 8 }}>
          <label className="jetz-field" style={{ display: 'block' }}>
            <span className="jetz-label">Milestone state</span>
            <Select value={certState} onChange={(e) => setCertState(e.target.value)} style={{ width: '100%' }}>
              <option value="">All states</option>
              {['training', 'approaching', 'eligible', 'review', 'issued'].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </label>
          <span className="jetz-result-count" aria-live="polite"><strong>{certRows.length}</strong> shown · sport filter above applies</span>
        </div>
        <DataTable
          columns={['Student', 'Sport', 'Enrolled', 'Milestone', 'State', 'Attendance', 'Sessions', 'Action']}
          rows={certRows.map((r: any) => [
            <span key={'n' + r.student} style={{ fontWeight: 600 }}>{r.name} <span style={{ color: 'var(--jetz-faint)', fontWeight: 400 }}>({r.student_id})</span></span>,
            r.sport || '—', r.enrollment_date || '—', r.milestone_date || '—',
            <StatusBadge key={'s' + r.student} value={r.state === 'eligible' ? 'verified' : r.state === 'issued' ? 'paid' : r.state === 'review' ? 'pending' : 'not_marked'} />,
            r.attendance_pct === null || r.attendance_pct === undefined ? '—' : `${r.attendance_pct}%`,
            r.sessions_completed,
            (r.state === 'eligible' || r.state === 'review')
              ? <Can key={'i' + r.student} code="students.edit"><Button size="sm" variant="accent" onClick={() => setIssueTarget(r)}>Approve & issue</Button></Can>
              : r.certificate
                ? (r.certificate.file
                  ? <a key={'f' + r.student} href={r.certificate.file} target="_blank" rel="noreferrer">Open PDF</a>
                  : <span key={'f' + r.student}>{r.certificate.certificate_no}</span>)
                : '—',
          ])}
          empty="No students in this state."
        />
      </Section>
      {issueTarget && (
        <ConfirmDialog
          title={`Issue certificate to ${issueTarget.name}?`}
          message={`${issueTarget.sport || 'Sport'} · ${issueTarget.enrollment_date} → ${issueTarget.milestone_date} · ${issueTarget.sessions_completed} sessions${issueTarget.attendance_pct != null ? ` · ${issueTarget.attendance_pct}% attendance` : ''}. A numbered PDF is generated and linked parents are notified.`}
          confirmLabel={certBusy ? 'Issuing…' : 'Approve & issue'}
          onConfirm={issueCert}
          onCancel={() => { if (!certBusy) setIssueTarget(null); }}
        />
      )}
      {detail && (
        <Drawer
          eyebrow={`Students / ${detail.student_id}`}
          title={`${detail.first_name} ${detail.last_name || ''}`.trim()}
          sub={`Enrolled ${detail.enrollment_date} · ${detail.phone || 'no phone'} · ${detail.email || 'no email'}`}
          onClose={() => setDetail(null)}
        >
          <div className="jetz-profile-hero">
            <Avatar name={`${detail.first_name} ${detail.last_name || ''}`} src={detail.photo} size={64} />
            <div>
              <div className="nm">{detail.student_id}</div>
              <div className="sb">{detail.sport_name || 'No sport assigned'} · <StatusBadge value={detail.status} /></div>
            </div>
          </div>
          <Tabs
            tabs={[
              {
                id: 'overview',
                label: 'Overview',
                content: (
                  <div>
                    <div className="jetz-panel-title">Personal information</div>
                    <DetailRows
                      rows={[
                        ['Student ID', detail.student_id],
                        ['Name', `${detail.first_name} ${detail.last_name || ''}`.trim()],
                        ['Date of birth', detail.dob || '—'],
                        ['Gender', detail.gender || '—'],
                        ['Phone', detail.phone || '—'],
                        ['WhatsApp', detail.whatsapp || '—'],
                        ['Email', detail.email || '—'],
                        ['Address', detail.address || '—'],
                        ['Emergency contact', detail.emergency_contact || '—'],
                        ['Enrollment date', detail.enrollment_date],
                        ['Sport', detail.sport_name || '—'],
                        ['Status', <StatusBadge value={detail.status} />],
                      ]}
                    />
                    <div style={{ height: 14 }} />
                    <div className="jetz-panel-title">AI reference photos ({(detail.reference_photos || []).length}/5)</div>
                    {(detail.reference_photos || []).length ? (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                        {(detail.reference_photos || []).map((p: any) => (
                          <span key={p.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', border: '1px solid var(--jetz-border)', borderRadius: 10, padding: 6 }}>
                            <img src={p.image} alt={p.angle} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
                            <StatusBadge value={p.angle} />
                            <Can code="students.edit"><Button size="sm" variant="secondary" onClick={async () => {
                              try { await api.patch(`/students/reference-photos/${p.id}/`, { is_active: false }); const { data } = await api.get(`/students/${detail.id}/`); setDetail((d: any) => ({ ...d, ...data, attendance: d.attendance, fees: d.fees })); reload(); }
                              catch (e: any) { setMsg(errMsg(e)); }
                            }}>Deactivate</Button></Can>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="jetz-note">No AI reference photos yet — edit this student above to add 2+ angles.</p>
                    )}
                  </div>
                ),
              },
              {
                id: 'attendance',
                label: `Attendance (${(detail.attendance || []).length})`,
                content: (
                  <DataTable columns={['Session', 'Status', 'Marked by', 'Marked at']} rows={(detail.attendance || []).map((a: any) => [a.session, <StatusBadge key={a.id} value={a.status} />, a.marked_by_name || '—', a.marked_at ? new Date(a.marked_at).toLocaleString() : '-'])} empty="No attendance yet." />
                ),
              },
              {
                id: 'guardians',
                label: 'Guardians & Sessions',
                content: (
                  <div>
                    <div className="jetz-panel-title">Parent / Guardian</div>
                    {detailParents.length ? (
                      <DataTable columns={['Name', 'Mobile', 'Relationship', 'Primary']} rows={detailParents.map((l: any) => [l.parent_name || `Parent #${l.parent}`, l.parent_mobile || '-', l.relationship || '-', l.is_primary ? 'Yes' : '—'])} />
                    ) : (
                      <p className="jetz-note">No parent/guardian linked — map one in Parents & Guardians.</p>
                    )}
                    <div style={{ height: 14 }} />
                    <div className="jetz-panel-title">Upcoming sessions</div>
                    <DataTable
                      columns={['Date', 'Session', 'Sport', 'Batch', 'Time', 'Trainer', 'Status']}
                      rows={(detail.upcoming || []).map((s: any) => [s.date, `Session ${s.slot ?? 1}`, s.sport_name || '-', s.batch_name || '-', `${s.start_time || ''}–${s.end_time || ''}`, s.coach_name || '-', <StatusBadge key={s.id} value={s.status} />])}
                      empty="No upcoming sessions scheduled."
                    />
                  </div>
                ),
              },
              {
                id: 'fees',
                label: 'Fees & Documents',
                content: (
                  <div>
                    <div className="jetz-panel-title">Fee & payment history</div>
                    <DataTable columns={['Period', 'Amount', 'Paid', 'Status']} rows={(detail.fees || []).map((f: any) => [f.period_label, f.amount, f.paid_total ?? '-', <StatusBadge key={f.id} value={f.status} />])} empty="No fees allocated." />
                    <div style={{ height: 14 }} />
                    <StudentDocs studentId={detail.id} studentName={`${detail.first_name} ${detail.last_name || ''}`} />
                  </div>
                ),
              },
            ]}
          />
        </Drawer>
      )}
    </div>
  );
}

function StudentDocs({ studentId, studentName }: { studentId: number; studentName: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const load = () => api.get('/students/documents/list/', { params: { student: studentId } }).then((r) => setDocs(toRows(r.data))).catch(() => setDocs([]));
  useEffect(() => { load(); }, [studentId]);
  const upload = async () => {
    if (!file) { setMsg('Choose a file first.'); return; }
    if (!title.trim()) { setMsg('Give the document a title.'); return; }
    const fd = new FormData();
    fd.append('student', String(studentId)); fd.append('title', title.trim()); fd.append('file', file);
    try { await api.post('/students/documents/list/', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setTitle(''); setFile(null); setMsg(''); load(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };
  return (
    <div>
      <div className="jetz-panel-title" style={{ marginBottom: 6 }}>Documents — {studentName.trim() || 'this student'}</div>
      {msg && <Toast msg={msg} kind="danger" />}
      <DataTable
        columns={['Title', 'Type', 'Uploaded', 'File']}
        rows={docs.map((d: any) => [d.title, d.file_type || '-', (d.uploaded_at || '').slice(0, 10), d.file ? <a key={d.id} href={d.file} target="_blank" rel="noreferrer">Open</a> : '-'])}
        empty="No documents for this student yet."
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
        <Field label="Title *" placeholder="Birth certificate" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div>
          <span className="jetz-label">File *</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button type="button" size="sm" variant="secondary" onClick={() => input.current?.click()}>Choose file…</Button>
            <input ref={input} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <span className="jetz-file-name">{file ? file.name : 'No file chosen'}</span>
          </div>
        </div>
        <Can code="students.create"><Button size="sm" variant="accent" onClick={upload}>Upload</Button></Can>
      </div>
    </div>
  );
}

/* ================= PARENTS ================= */

export function Parents() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const { rows, count, err, page, setPage, reload } = usePaged('/parents/', search ? { search } : {});
  const [form, setForm] = useState({ first_name: '', last_name: '', relationship: 'father', mobile: '', whatsapp: '', email: '', student: '' });
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [confirmUnlink, setConfirmUnlink] = useState<{ id: number; label: string } | null>(null);
  const [unlinkBusy, setUnlinkBusy] = useState(false);

  const loadLinks = () => api.get('/parents/links/list/', { params: { page_size: 200 } }).then((r) => setLinks(toRows(r.data))).catch(() => {});
  useEffect(() => { loadLinks(); }, []);
  useEffect(() => { api.get('/students/', { params: { page_size: 200, ordering: 'first_name' } }).then((r) => setAllStudents(toRows(r.data))).catch(() => {}); }, []);
  const studentName = (id: number) => {
    const s = allStudents.find((x: any) => x.id === id);
    return s ? `${s.first_name} ${s.last_name || ''} (${s.student_id})` : `Student #${id}`;
  };
  const linkedNames = (parentId: number) => links.filter((l: any) => l.parent === parentId).map((l: any) => studentName(l.student));

  const resetParentForm = () => {
    setForm({ first_name: '', last_name: '', relationship: 'father', mobile: '', whatsapp: '', email: '', student: '' });
    setEditing(null);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (busy) return;
    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/parents/${editing.id}/`, { first_name: form.first_name, last_name: form.last_name, relationship: form.relationship, mobile: form.mobile, whatsapp: form.whatsapp, email: form.email });
        let linkedLabel = '';
        if (form.student) {
          linkedLabel = studentName(Number(form.student));
          try { await api.post('/parents/links/list/', { student: Number(form.student), parent: editing.id, is_primary: true }); }
          catch (e: any) { setMsg(`Parent saved, but linking failed: ${errMsg(e)}`); }
        }
        resetParentForm();
        reload(); loadLinks();
        setOk(`Guardian updated${linkedLabel ? ` and linked to ${linkedLabel}` : ''}.`);
        return;
      }
      const { data } = await api.post('/parents/', { first_name: form.first_name, last_name: form.last_name, relationship: form.relationship, mobile: form.mobile, whatsapp: form.whatsapp, email: form.email });
      let linkedLabel = '';
      if (form.student) {
        linkedLabel = studentName(Number(form.student));
        try { await api.post('/parents/links/list/', { student: Number(form.student), parent: data.id, is_primary: true }); }
        catch (e: any) { setMsg(`Parent saved, but linking failed: ${errMsg(e)}`); }
      }
      setForm({ first_name: '', last_name: '', relationship: 'father', mobile: '', whatsapp: '', email: '', student: '' });
      reload(); loadLinks();
      setOk(`Guardian ${data.first_name} saved${linkedLabel ? ` and linked to ${linkedLabel}` : ''}.`);
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };

  const unlink = async () => {
    if (!confirmUnlink || unlinkBusy) return;
    setUnlinkBusy(true);
    try {
      await api.delete(`/parents/links/list/${confirmUnlink.id}/`);
      setOk(`Unlinked ${confirmUnlink.label}. The parent and student records are kept.`);
      setConfirmUnlink(null);
      loadLinks();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setUnlinkBusy(false); }
  };

  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Academy / Parents" title="Parents & Guardians" count={count} sub={`${count} guardians · linked to students · WhatsApp-ready contacts`} actions={<Button size="sm" variant="secondary" onClick={reload}>Refresh</Button>} />
      <Toast msg={err || msg} />
      {ok && <Toast msg={ok} kind="success" />}
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, mobile…" />
        <form onSubmit={create} style={{ display: 'contents' }} id="parent-form-start">
          {editing && <span style={{ alignSelf: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--jetz-accent)' }}>Editing {editing.first_name} — Save changes or Cancel</span>}
          <Field label="First name *" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <Field label="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          <label><span className="jetz-label">Relationship</span>
            <Select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
              {['father', 'mother', 'guardian'].map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </label>
          <Field label="Mobile *" placeholder="98…" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required />
          <Field label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          <Field label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label><span className="jetz-label">Link student</span>
            <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })}>
              <option value="">— no link —</option>
              {allStudents.map((s: any) => <option key={s.id} value={s.id}>{s.student_id} · {s.first_name} {s.last_name || ''}</option>)}
            </Select>
          </label>
          <Can code={editing ? 'parents.edit' : 'parents.create'}><Button type="submit" variant="accent" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add parent'}</Button></Can>
          {editing && <Button type="button" variant="secondary" onClick={resetParentForm}>Cancel</Button>}
        </form>
      </Toolbar>
      {ok && <Toast msg={ok} kind="success" />}
      <DataTable
        columns={['Name', 'Relationship', 'Mobile', 'WhatsApp', 'Email', 'Linked students', 'Actions']}
        rows={rows.map((p: any) => {
          const mine = links.filter((l: any) => l.parent === p.id);
          return [
            `${p.first_name} ${p.last_name || ''}`, p.relationship, p.mobile, p.whatsapp || '-', p.email || '-',
            mine.length ? (
              <span key={'l' + p.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {mine.map((l: any) => (
                  <span key={l.id} title={`${studentName(l.student)}${l.is_primary ? ' · primary guardian' : ''} — click ✕ to unlink`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'var(--jetz-navy-soft)', border: '1px solid #BFD0EA', borderRadius: 999, padding: '3px 6px 3px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--jetz-navy)' }}>
                    {l.is_primary ? <span style={{ color: 'var(--jetz-accent)', fontWeight: 800 }} title="Primary guardian">★</span> : null}
                    {studentName(l.student)}
                    <button type="button" onClick={() => setConfirmUnlink({ id: l.id, label: studentName(l.student) })} title={can('parents.edit') ? `Unlink ${studentName(l.student)}` : 'Unlink needs edit rights'} aria-label={`Unlink ${studentName(l.student)}`} disabled={!can('parents.edit')} style={{ border: 'none', background: 'transparent', cursor: can('parents.edit') ? 'pointer' : 'default', fontWeight: 800, color: 'var(--jetz-danger)', fontSize: 13, padding: '2px 6px', borderRadius: 999, lineHeight: 1, opacity: can('parents.edit') ? 1 : 0.35 }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--jetz-danger-bg)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>✕</button>
                  </span>
                ))}
              </span>
            ) : <span key={'l' + p.id} style={{ color: 'var(--jetz-faint)' }}>—</span>,
            <span key={'a' + p.id} style={{ display: 'flex', gap: 6 }}>
              <Can code="parents.edit"><Button size="sm" variant="secondary" onClick={() => { setEditing(p); setOk(''); setMsg(''); setForm({ first_name: p.first_name, last_name: p.last_name || '', relationship: p.relationship || 'father', mobile: p.mobile || '', whatsapp: p.whatsapp || '', email: p.email || '', student: '' }); document.getElementById('parent-form-start')?.scrollIntoView({ behavior: 'smooth' }); }}>Edit</Button></Can>
            </span>,
          ];
        })}
      />
      <Pager page={page} count={count} setPage={setPage} />
      {confirmUnlink && (
        <ConfirmDialog
          title="Unlink student?"
          message={`${confirmUnlink.label} will no longer be linked to this guardian. Both records are kept — only the link is removed.`}
          confirmLabel="Unlink"
          danger
          busy={unlinkBusy}
          onConfirm={unlink}
          onCancel={() => { if (!unlinkBusy) setConfirmUnlink(null); }}
        />
      )}
    </div>
  );
}

/* ================= DOCUMENTS ================= */

const DOC_CATEGORIES = ['academy', 'receipt', 'export', 'attachment'];

export function Documents() {
  const [view, setView] = useState<'academy' | 'student'>('academy');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const { rows, count, err, page, setPage, reload } = usePaged('/documents/', { ...(search ? { search } : {}), ...(category ? { category } : {}) });
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('academy');
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const students = useOptions('/students/?page_size=200');
  const [stuQ, setStuQ] = useState('');
  const [stuId, setStuId] = useState('');
  const selStudent = students.find((s: any) => String(s.id) === String(stuId));
  const stuMatches = students.filter((s: any) => {
    const q = stuQ.trim().toLowerCase();
    if (!q) return true;
    return `${s.first_name} ${s.last_name || ''} ${s.student_id}`.toLowerCase().includes(q);
  }).slice(0, 30);
  const resetUploadForm = () => {
    setTitle(''); setCat('academy'); setFile(null); setEditing(null);
    if (fileInput.current) fileInput.current.value = '';
  };
  const startEdit = (d: any) => {
    setEditing(d); setMsg(''); setOk('');
    setTitle(d.title); setCat(d.category || 'academy'); setFile(null);
    if (fileInput.current) fileInput.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const upload = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!title.trim()) { setMsg('Give the document a title.'); return; }
    if (!editing && !file) { setMsg('Choose a file to upload.'); return; }
    if (busy) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('title', title.trim()); fd.append('category', cat);
    if (file) fd.append('file', file);
    try {
      if (editing) {
        await api.patch(`/documents/${editing.id}/`, file ? fd : { title: title.trim(), category: cat }, file ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
        setOk(`Document “${title.trim()}” updated${file ? ' with a new file' : ''}.`);
      } else {
        await api.post('/documents/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setOk(`Document “${title.trim()}” uploaded.`);
      }
      resetUploadForm(); reload();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };
  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmDelete(null); setMsg(''); setOk('');
    try {
      await api.delete(`/documents/${confirmDelete.id}/`);
      if (editing?.id === confirmDelete.id) resetUploadForm();
      setOk(`Document “${confirmDelete.title}” deleted.`);
      reload();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Academy / Documents" title="Documents" count={view === 'academy' ? count : undefined} sub={view === 'academy' ? `${count} academy files · policies, receipts, exports` : 'Birth certificates, medical records and IDs — collected per student'} actions={<span style={{ display: 'flex', gap: 8 }}><Button size="sm" variant={view === 'academy' ? 'accent' : 'secondary'} onClick={() => setView('academy')}>Academy files</Button><Button size="sm" variant={view === 'student' ? 'accent' : 'secondary'} onClick={() => setView('student')}>Student files</Button><Button size="sm" variant="secondary" onClick={reload}>Refresh</Button></span>} />
      <Toast msg={err || msg} />
      {ok && <Toast msg={ok} kind="success" />}
      {view === 'student' ? (
        <div className="jetz-card" style={{ marginBottom: 14 }}>
          <Toolbar>
            <SearchBox value={stuQ} onChange={(v) => setStuQ(v)} placeholder="Search student by name or ID…" />
            <label><span className="jetz-label">Student *</span>
              <Select value={stuId} onChange={(e) => setStuId(e.target.value)}>
                <option value="">— pick a student —</option>
                {stuMatches.map((s: any) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name || ''} ({s.student_id})</option>)}
              </Select>
            </label>
            {stuId && <Button variant="secondary" onClick={() => { setStuId(''); setStuQ(''); }}>Clear</Button>}
          </Toolbar>
          {selStudent ? (
            <StudentDocs studentId={selStudent.id} studentName={`${selStudent.first_name} ${selStudent.last_name || ''}`} />
          ) : (
            <p className="jetz-note" style={{ margin: 0 }}>Pick a student above to view and collect their documents.</p>
          )}
        </div>
      ) : (
      <>
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search by title…" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        {(search || category) && <Button variant="secondary" onClick={() => { setSearch(''); setCategory(''); }}>Clear</Button>}
      </Toolbar>
      <form onSubmit={upload} className="jetz-card" style={{ marginBottom: 14 }}>
        {editing && <div className="jetz-panel-title" style={{ marginBottom: 10 }}>Editing “{editing.title}” — Save changes or Cancel</div>}
        <div className="jetz-form-card" style={{ marginBottom: 0 }}>
          <Field label="Title *" placeholder="Fee policy 2026" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label><span className="jetz-label">Category</span>
            <Select value={cat} onChange={(e) => setCat(e.target.value)}>
              {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <span className="jetz-label">{editing ? 'Replace file (blank = keep current)' : 'File *'}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>{file ? 'Change file…' : 'Choose file…'}</Button>
                <input ref={fileInput} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <span className="jetz-file-name">{file ? file.name : editing ? 'Current file kept' : 'No file chosen'}</span>
                {file && <Button type="button" size="sm" variant="secondary" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ''; }}>Remove</Button>}
              </div>
            </div>
            <Can code={editing ? 'documents.edit' : 'documents.create'}><Button type="submit" variant="accent" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Upload'}</Button></Can>
            {editing && <Button type="button" variant="secondary" onClick={resetUploadForm}>Cancel</Button>}
          </div>
        </div>
      </form>
      <DataTable
        columns={['Title', 'Category', 'Type', 'Uploaded by', 'Uploaded', 'File', 'Actions']}
        rows={rows.map((d: any) => [
          <span key={'t' + d.id} style={{ fontWeight: 600 }}>{d.title}</span>,
          <StatusBadge key={d.id} value={d.category || 'academy'} />, d.file_type || '-',
          d.uploaded_by_name || '-', (d.uploaded_at || '').slice(0, 10),
          d.file ? <a key={'f' + d.id} href={d.file} target="_blank" rel="noreferrer">Open</a> : '-',
          <span key={'a' + d.id} style={{ display: 'flex', gap: 6 }}>
            <Can code="documents.edit"><Button size="sm" variant="secondary" onClick={() => startEdit(d)}>Edit</Button></Can>
            <Can code="documents.archive"><Button size="sm" variant="secondary" onClick={() => setConfirmDelete(d)}>Delete</Button></Can>
          </span>,
        ])}
      />
      <Pager page={page} count={count} setPage={setPage} />
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete “${confirmDelete.title}”?`}
          message="The file will be removed for everyone. This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      </>
      )}
    </div>
  );
}

/* ================= BATCHES ================= */

export function Batches() {
  const [search, setSearch] = useState('');
  const [sport, setSport] = useState('');
  const { rows, count, err, page, setPage, reload } = usePaged('/batches/', { ...(search ? { search } : {}), ...(sport ? { sport } : {}) });
  const sports = useOptions('/sports/sports/');
  const coaches = useOptions('/coaches/');
  const schools = useOptions('/schools/');
  const [form, setForm] = useState({ name: '', sport: '', coach: '', capacity: '', start_time: '', end_time: '', school: '' });
  const [trainDays, setTrainDays] = useState<number[]>([0, 2, 4]);
  const [msg, setMsg] = useState('');
  const [roster, setRoster] = useState<any>(null);
  const [editDays, setEditDays] = useState<number[]>([]);
  const [savingDays, setSavingDays] = useState(false);
  const [confirmHit, setConfirmHit] = useState<{ batchName: string; studentName: string } | null>(null);
  const { values: cfg } = useAcademySettings();
  useEffect(() => {
    const d = cfg['schedule.default_batch_capacity'];
    if ((d === 0 || d) && !form.capacity) setForm((f) => (f.capacity ? f : { ...f, capacity: String(d) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg['schedule.default_batch_capacity']]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg('');
    const nm = form.name.trim();
    if (!nm) { setMsg('Batch name is required.'); return; }
    // Guardrail: batch names must not be student names — that mix-up
    // pollutes every batch dropdown in the app.
    try {
      const { data } = await api.get('/students/', { params: { search: nm, page_size: 5 } });
      const hit = toRows(data).find((s: any) =>
        `${s.first_name} ${s.last_name || ''}`.trim().toLowerCase() === nm.toLowerCase() ||
        String(s.student_id || '').toLowerCase() === nm.toLowerCase());
      if (hit && confirmHit?.batchName !== nm) { setConfirmHit({ batchName: nm, studentName: `${hit.first_name} ${hit.last_name || ''} (${hit.student_id})` }); return; }
    } catch { /* search failure must never block batch creation */ }
    await doCreate();
  };
  const doCreate = async () => {
    setMsg('');
    if (!trainDays.length) { setMsg('Pick at least one training day for the batch.'); return; }
    try {
      await api.post('/batches/', { name: form.name, sport: Number(form.sport), coach: form.coach ? Number(form.coach) : null, capacity: form.capacity ? Number(form.capacity) : null, start_time: form.start_time, end_time: form.end_time, training_days: [...trainDays].sort((a, b) => a - b), is_active: true, ...(form.school ? { school: Number(form.school) } : {}) });
      setForm({ name: '', sport: '', coach: '', capacity: '', start_time: '', end_time: '', school: '' }); setTrainDays([0, 2, 4]); setConfirmHit(null); reload();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const viewRoster = async (b: any) => {
    try {
      const { data } = await api.get('/batches/rosters/list/', { params: { batch: b.id } }).catch(() => ({ data: [] }));
      const r2 = await api.get(`/batches/${b.id}/`).catch(() => ({ data: b }));
      setEditDays(Array.isArray(r2.data?.training_days) ? [...r2.data.training_days] : []);
      setRoster({ batch: r2.data, students: toRows(data) });
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const saveDays = async () => {
    if (!roster) return;
    if (!editDays.length) { setMsg('Pick at least one training day.'); return; }
    setSavingDays(true); setMsg('');
    try {
      const { data } = await api.patch(`/batches/${roster.batch.id}/`, { training_days: [...editDays].sort((a, b) => a - b) });
      setRoster((r: any) => (r ? { ...r, batch: { ...r.batch, training_days: data.training_days } } : r));
      reload();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setSavingDays(false); }
  };

  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Academy / Batches" title="Batches" count={count} sub={`${count} training groups · capacity-enforced · weekday/weekend schedules`} actions={<Button size="sm" variant="secondary" onClick={reload}>Refresh</Button>} />
      <Toast msg={err || msg} />
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search batches…" />
        <Select value={sport} onChange={(e) => setSport(e.target.value)}>
          <option value="">All sports</option>
          {sports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <form onSubmit={create} style={{ display: 'contents' }}>
          <Field label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <label><span className="jetz-label">Sport *</span>
            <Select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} required>
              <option value="">—</option>{sports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </label>
          <label><span className="jetz-label">Coach</span>
            <Select value={form.coach} onChange={(e) => setForm({ ...form, coach: e.target.value })}>
              <option value="">—</option>{coaches.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} ({c.trainer_id})</option>)}
            </Select>
          </label>
          <Field label="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          {schools.length > 0 && (
            <label><span className="jetz-label">School</span>
              <Select value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })}>
                <option value="">—</option>{schools.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
          )}
          <Field label="Start *" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
          <Field label="End *" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
          <span className="jetz-field" style={{ display: 'block' }}>
            <span className="jetz-label">Training days * <span style={{ fontWeight: 400, color: 'var(--jetz-faint)' }}>({trainDays.length} picked)</span></span>
            <OffDayPicker value={trainDays} onChange={(d) => setTrainDays((p) => toggleDaysInList(p, d, 7))} max={7} />
          </span>
          <Can code="batches.create"><Button type="submit" variant="accent">Create batch</Button></Can>
        </form>
      </Toolbar>
      <DataTable
        columns={['Name', 'Sport', 'School', 'Coach', 'Time', 'Days', 'Students', 'Active', 'Action']}
        rows={rows.map((b: any) => [
          b.name, b.sport_name || b.sport, b.school_name || '—', b.coach_name || '-', `${b.start_time || ''}–${b.end_time || ''}`,
          dayNames(b.training_days),
          b.student_count ?? '-', String(b.is_active),
          <Button key={b.id} size="sm" onClick={() => viewRoster(b)}>Roster</Button>,
        ])}
      />
      <Pager page={page} count={count} setPage={setPage} />
      {confirmHit && (
        <ConfirmDialog
          title="Name looks like a student"
          message={`"${confirmHit.batchName}" matches student ${confirmHit.studentName}. Batch names should describe the training group (e.g. FB-U12-Morning), not an athlete. Create it anyway?`}
          confirmLabel="Create anyway"
          onConfirm={doCreate}
          onCancel={() => setConfirmHit(null)}
        />
      )}
      {roster && (
        <Detail title={`${roster.batch.name} — roster & sessions`} onClose={() => setRoster(null)}>
          <p className="jetz-note">{roster.batch.sport_name || ''} · {roster.batch.start_time || ''}–{roster.batch.end_time || ''} · Coach: {roster.batch.coach_name || '—'} · Days: <strong>{dayNames(roster.batch.training_days)}</strong></p>
          <div className="jetz-panel-title" style={{ marginBottom: 6 }}>Training days</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <OffDayPicker value={editDays} onChange={(d) => setEditDays((p) => toggleDaysInList(p, d, 7))} max={7} />
            <Can code="batches.edit"><Button size="sm" variant="accent" onClick={saveDays} disabled={savingDays || !editDays.length}>
              {savingDays ? 'Saving…' : 'Save days'}
            </Button></Can>
          </div>
          <DataTable columns={['Student', 'Joined', 'Active']} rows={(roster.students || []).map((r: any) => [r.student_name || r.student, (r.joined_on || '').slice(0, 10), String(r.is_active ?? true)])} empty="No students in this batch yet." />
        </Detail>
      )}
    </div>
  );
}

/* ================= SESSIONS ================= */

export function Sessions() {
  const [status, setStatus] = useState('');
  const [day, setDay] = useState(todayISO());
  const [dayRows, setDayRows] = useState<any[]>([]);
  const [dayErr, setDayErr] = useState('');
  const [counts, setCounts] = useState<Record<number, { assigned: number; marked: number }>>({});
  const { rows, count, err, page, setPage, reload } = usePaged('/sessions/', status ? { status } : {});
  const batches = useOptions('/batches/');
  const coaches = useOptions('/coaches/');
  const sports = useOptions('/sports/sports/');
  const [form, setForm] = useState({ sport: '', batch: '', coach: '', date: todayISO(), slot: '', start_time: '', end_time: '' });
  const [msg, setMsg] = useState('');
  const { values: cfg } = useAcademySettings();
  const pickSlot = (slot: string) => {
    setForm((f) => {
      const n: any = { ...f, slot };
      if (slot && !f.start_time) n.start_time = cfg[`schedule.slot${slot}_start`] || '';
      if (slot && !f.end_time) n.end_time = cfg[`schedule.slot${slot}_end`] || '';
      return n;
    });
  };
  const [findQ, setFindQ] = useState('');
  const [findRows, setFindRows] = useState<any[] | null>(null);
  const [findMsg, setFindMsg] = useState('');

  const loadDay = async (d: string) => {
    setDayErr('');
    try {
      const { data } = await api.get('/sessions/', { params: { date: d, page_size: 50, ordering: 'slot' } });
      const list = toRows(data);
      setDayRows(list);
      const c: Record<number, { assigned: number; marked: number }> = {};
      await Promise.all(list.map(async (s: any) => {
        try {
          const r = await api.get('/attendance/roster/', { params: { session: s.id } });
          const roster = r.data.roster || [];
          c[s.id] = { assigned: roster.length, marked: roster.filter((x: any) => x.status && x.status !== 'not_marked').length };
        } catch { c[s.id] = { assigned: (s.assigned || []).length, marked: 0 }; }
      }));
      setCounts(c);
    } catch (e: any) { setDayErr(errMsg(e)); }
  };
  useEffect(() => { loadDay(day); }, [day]);

  const refreshAll = () => { loadDay(day); reload(); };

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg('');
    if (isAcademyOff && !offOk) { setConfirmOff(true); return; }
    await doCreate(offOk);
  };
  const [confirmOff, setConfirmOff] = useState(false);
  const [offOk, setOffOk] = useState(false);
  const doCreate = async (override = false) => {
    setMsg(''); setConfirmOff(false);
    try {
      await api.post('/sessions/', { sport: Number(form.sport), batch: Number(form.batch), coach: Number(form.coach), date: form.date, slot: form.slot ? Number(form.slot) : 1, start_time: form.start_time, end_time: form.end_time, status: 'scheduled', ...(override ? { allow_off_day: true } : {}) });
      setForm({ sport: '', batch: '', coach: '', date: day, slot: '', start_time: '', end_time: '' }); setOffOk(false); refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const change = async (id: number, st: string) => {
    try { await api.post(`/sessions/${id}/change_status/`, { status: st }); refreshAll(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };
  const moveSlot = async (id: number, slot: number) => {
    setMsg('');
    try { await api.patch(`/sessions/${id}/`, { slot }); refreshAll(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };

  const taken = dayRows.map((s: any) => s.slot);
  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const selCoach = coaches.find((c: any) => String(c.id) === String(form.coach));
  const formWeekday = (() => { const d = new Date(form.date + 'T00:00:00'); return isNaN(d.getTime()) ? -1 : (d.getDay() + 6) % 7; })();
  const offClash = !!selCoach && Array.isArray(selCoach.weekly_off_days) && formWeekday >= 0 && selCoach.weekly_off_days.includes(formWeekday);
  const academyOffs: number[] = Array.isArray(cfg['academy.week_off_days']) ? cfg['academy.week_off_days'] : [];
  const isAcademyOff = formWeekday >= 0 && academyOffs.includes(formWeekday);
  const findStudent = async () => {
    setFindMsg(''); setFindRows(null);
    if (!findQ.trim()) return;
    try {
      const { data } = await api.get('/students/', { params: { search: findQ.trim(), page_size: 8 } });
      const students = toRows(data);
      if (!students.length) { setFindMsg('No student matches that search.'); return; }
      const out: any[] = [];
      for (const st of students) {
        const mine = dayRows.filter((s: any) => (s.assigned || []).some((a: any) => a.student === st.id));
        if (mine.length) {
          mine.forEach((s: any) => out.push({ st, s, upcoming: false }));
        } else {
          const u = await api.get('/sessions/', { params: { student: st.id, date__gte: day, ordering: 'date', page_size: 3 } }).catch(() => ({ data: [] }));
          toRows(u.data).forEach((s: any) => out.push({ st, s, upcoming: true }));
          if (!toRows(u.data).length) out.push({ st, s: null, upcoming: false });
        }
      }
      setFindRows(out);
    } catch (e: any) { setFindMsg(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Academy / Sessions" title="Training Sessions" sub="Academy runs Session 1 / 2 / 3 per day · pick a date for the day-view" actions={<Button size="sm" variant="secondary" onClick={refreshAll}>Refresh</Button>} />
      <Toast msg={err || msg || dayErr} />
      <p className="jetz-note">One session per slot per day (academy-wide). Cancelled sessions never generate trainer fees.</p>
      <Toolbar>
        <Field label="Day" type="date" value={day} onChange={(e) => setDay(e.target.value || todayISO())} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses (list below)</option>
          {SESSION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <SearchBox value={findQ} onChange={setFindQ} placeholder="Find student: name or ID…" />
        <Button variant="accent" onClick={findStudent}>Find student</Button>
      </Toolbar>

      {findRows !== null && (
        <div className="jetz-card" style={{ marginBottom: 14 }}>
          <div className="jetz-panel-title" style={{ marginBottom: 8 }}>Student lookup — {day}</div>
          {findMsg && <Toast msg={findMsg} />}
          <DataTable
            columns={['Student', 'Sport', 'Batch', 'Session', 'Time', 'Trainer', 'Status']}
            rows={findRows.map((r: any, i: number) => r.s ? [
              `${r.st.first_name} ${r.st.last_name || ''} (${r.st.student_id})`,
              r.s.sport_name || '-', r.s.batch_name || '-',
              r.upcoming ? `Session ${r.s.slot ?? 1} · ${r.s.date} (upcoming)` : `Session ${r.s.slot ?? 1}`,
              `${r.s.start_time || ''}–${r.s.end_time || ''}`,
              r.s.coach_name || '-', <StatusBadge key={i} value={r.s.status} />,
            ] : [`${r.st.first_name} ${r.st.last_name || ''} (${r.st.student_id})`, '-', '-', 'No session on this date, none upcoming', '-', '-', '-'])}
            empty="No matches."
          />
          <div style={{ marginTop: 8 }}><Button size="sm" variant="secondary" onClick={() => { setFindRows(null); setFindQ(''); }}>Clear lookup</Button></div>
        </div>
      )}

      <div className="jetz-panel-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 14, marginTop: 0 }}>
        {[1, 2, 3].map((slot) => {
          const list = dayRows.filter((s: any) => (s.slot ?? 1) === slot);
          return (
            <div key={slot} className="jetz-card">
              <div className="jetz-panel-title">Session {slot} · {day}</div>
              <div className="jetz-panel-sub">{list.length ? `${list.length} scheduled` : 'Slot free'}</div>
              {list.length === 0 && (
                <Can code="sessions.create"><Button size="sm" variant="secondary" onClick={() => setForm((f) => ({ ...f, date: day, slot: String(slot) }))}>Schedule here</Button></Can>
              )}
              {list.map((s: any) => (
                <div key={s.id} style={{ borderTop: '1px solid var(--jetz-border)', paddingTop: 8, marginTop: 8 }}>
                  <div style={{ fontWeight: 700 }}>{s.batch_name} · {s.sport_name}</div>
                  <div className="jetz-panel-sub">{s.start_time}–{s.end_time} · {s.coach_name || 'no coach'} · {(counts[s.id]?.assigned ?? (s.assigned || []).length)} students ({counts[s.id]?.marked ?? 0} marked)</div>
                  <div style={{ marginTop: 4 }}><StatusBadge value={s.status} /></div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    <Can code="sessions.edit">
                      {s.status === 'scheduled' && <><Button size="sm" onClick={() => change(s.id, 'in_progress')}>Start</Button><Button size="sm" variant="secondary" onClick={() => change(s.id, 'cancelled')}>Cancel</Button><Button size="sm" variant="accent" onClick={() => change(s.id, 'completed')}>Complete</Button></>}
                      {s.status === 'in_progress' && <Button size="sm" variant="accent" onClick={() => change(s.id, 'completed')}>Complete</Button>}
                    </Can>
                    <Can code="sessions.edit">
                    <Select value={String(s.slot ?? 1)} onChange={(e) => moveSlot(s.id, Number(e.target.value))} style={{ minWidth: 0 }} title="Move to another slot">
                      {[1, 2, 3].map((n) => <option key={n} value={n}>Slot {n}</option>)}
                    </Select>
                    </Can>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <form onSubmit={create} className="jetz-card" style={{ marginBottom: 14 }}>
        <div className="jetz-form-card" style={{ marginBottom: 0 }}>
          <label><span className="jetz-label">Sport *</span><Select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} required><option value="">—</option>{sports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
          <label><span className="jetz-label">Batch *</span><Select value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} required><option value="">—</option>{batches.map((b: any) => <option key={b.id} value={b.id}>{b.name}{b.sport_name ? ` (${b.sport_name})` : ''}</option>)}</Select></label>
          <label><span className="jetz-label">Coach *</span><Select value={form.coach} onChange={(e) => setForm({ ...form, coach: e.target.value })} required><option value="">—</option>{coaches.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} ({c.trainer_id})</option>)}</Select></label>
          <Field label="Date *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          {selCoach && Array.isArray(selCoach.weekly_off_days) && selCoach.weekly_off_days.length > 0 && (
            <span style={{ fontSize: 12, color: offClash ? 'var(--jetz-danger)' : 'var(--jetz-muted)', fontWeight: offClash ? 700 : 400, alignSelf: 'center' }}>
              {selCoach.first_name} off: {selCoach.weekly_off_days.map((d: number) => WD[d]).join(', ')}
              {offClash ? ` — ${WD[formWeekday]} is an off-day, pick another date or coach.` : ''}
            </span>
          )}
          <label><span className="jetz-label">Slot *</span>
            <Select value={form.slot} onChange={(e) => pickSlot(e.target.value)} required>
              <option value="">—</option>
              {[1, 2, 3].map((n) => <option key={n} value={n} disabled={form.date === day && taken.includes(n)}>Session {n}{form.date === day && taken.includes(n) ? ' (taken)' : ''}</option>)}
            </Select>
          </label>
          <Field label="Start *" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
          <Field label="End *" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
          {isAcademyOff && (
            <span style={{ fontSize: 12, color: 'var(--jetz-danger)', fontWeight: 700, alignSelf: 'center' }}>
              Academy week off ({WD[formWeekday]}) — scheduling needs explicit confirmation.
            </span>
          )}
          <Can code="sessions.create"><Button type="submit" variant="accent" disabled={offClash} title={offClash ? 'Coach is on weekly off this date' : 'Schedule session'}>Schedule</Button></Can>
        </div>
      </form>
      {confirmOff && (
        <ConfirmDialog
          title="Schedule on academy week off?"
          message={`${WD[formWeekday]} is marked as an academy week off in Settings. Scheduling here should be exceptional (e.g. a holiday camp) — it will be audit-logged. Continue?`}
          confirmLabel="Schedule anyway"
          onConfirm={() => { setOffOk(true); doCreate(true); }}
          onCancel={() => setConfirmOff(false)}
        />
      )}

      <DataTable
        columns={['Slot', 'Batch', 'Date', 'Time', 'Coach', 'Students', 'Status', 'Actions']}
        rows={rows.map((s: any) => [
          `Session ${s.slot ?? 1}`,
          s.batch_name || s.batch, s.date, `${s.start_time || ''}–${s.end_time || ''}`, s.coach_name || s.coach,
          (s.assigned || []).length,
          <StatusBadge key={s.id} value={s.status} />,
          <span key={'a' + s.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Can code="sessions.edit">
              {s.status === 'scheduled' && <><Button size="sm" onClick={() => change(s.id, 'in_progress')}>Start</Button><Button size="sm" variant="secondary" onClick={() => change(s.id, 'cancelled')}>Cancel</Button></>}
              {s.status === 'scheduled' && <Button size="sm" variant="accent" onClick={() => change(s.id, 'completed')}>Complete</Button>}
              {s.status === 'in_progress' && <Button size="sm" variant="accent" onClick={() => change(s.id, 'completed')}>Complete</Button>}
            </Can>
          </span>,
        ])}
      />
      <Pager page={page} count={count} setPage={setPage} />
    </div>
  );
}

/* ================= TIMETABLE ================= */

const TT_COLORS = ['#2563eb', '#f97316', '#16a34a', '#a855f7', '#dc2626', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#65a30d'];
const ttColor = (id: any) => TT_COLORS[(Number(id) || 0) % TT_COLORS.length];
const ttAddDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ttMonday = (iso: string) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const ttMonth = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { from: fmt(new Date(d.getFullYear(), d.getMonth(), 1)), to: fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
};
const TT_WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Timetable() {
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(todayISO());
  const [coach, setCoach] = useState('');
  const [sport, setSport] = useState('');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const coaches = useOptions('/coaches/');
  const sports = useOptions('/sports/sports/');

  const range = mode === 'day'
    ? { from: anchor, to: anchor }
    : mode === 'week'
      ? (() => { const from = ttMonday(anchor); return { from, to: ttAddDays(from, 6) }; })()
      : ttMonth(anchor);

  useEffect(() => {
    let live = true;
    setLoading(true); setErr('');
    api.get('/sessions/timetable/', {
      params: { date_from: range.from, date_to: range.to, ...(coach ? { coach } : {}), ...(sport ? { sport } : {}) },
    })
      .then((r) => { if (live) setData(r.data); })
      .catch((e) => { if (live) setErr(errMsg(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, coach, sport]);

  const days: any[] = data?.days || [];
  const allSessions: any[] = days.flatMap((d) => d.sessions);
  const conflicts = allSessions.filter((s) => s.has_conflict).length;
  const trainers = new Set(allSessions.map((s) => s.coach)).size;
  const sportsInUse: Array<[any, string]> = Array.from(
    new Map(allSessions.filter((s) => s.sport).map((s) => [s.sport, s.sport_name || `Sport ${s.sport}`] as [any, string])).entries(),
  );

  const shift = (dir: number) => {
    if (mode === 'day') setAnchor(ttAddDays(anchor, dir));
    else if (mode === 'week') setAnchor(ttAddDays(anchor, dir * 7));
    else { const d = new Date(anchor + 'T00:00:00'); d.setMonth(d.getMonth() + dir); setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`); }
  };

  const [sfCoach, setSfCoach] = useState('');
  const [sfDate, setSfDate] = useState(todayISO());
  const [sfDur, setSfDur] = useState('60');
  const [sfSlots, setSfSlots] = useState<any[] | null>(null);
  const [sfMsg, setSfMsg] = useState('');
  const findSlots = async () => {
    setSfMsg(''); setSfSlots(null);
    if (!sfCoach) { setSfMsg('Pick a trainer first.'); return; }
    try {
      const { data } = await api.get('/sessions/suggest_slots/', { params: { coach: sfCoach, date: sfDate, duration: Number(sfDur) || 60 } });
      const slots = data.slots || [];
      setSfSlots(slots);
      if (!slots.length) setSfMsg("No free slot that day inside the trainer's working hours.");
    } catch (e: any) { setSfMsg(errMsg(e)); }
  };

  const [acSport, setAcSport] = useState('');
  const [acDate, setAcDate] = useState(todayISO());
  const [acStart, setAcStart] = useState('07:00');
  const [acEnd, setAcEnd] = useState('08:00');
  const [acRows, setAcRows] = useState<any[] | null>(null);
  const [acMsg, setAcMsg] = useState('');
  const findTrainers = async () => {
    setAcMsg(''); setAcRows(null);
    if (!acSport) { setAcMsg('Pick a sport.'); return; }
    try {
      const { data } = await api.get('/sessions/available_coaches/', { params: { sport: acSport, date: acDate, start_time: acStart, end_time: acEnd } });
      const list = data.available || [];
      setAcRows(list);
      if (!list.length) setAcMsg('No qualified, free trainer for that window.');
    } catch (e: any) { setAcMsg(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="JETZ Academy / Academy / Timetable"
        title="Timetable & Conflicts"
        sub="Daily · weekly · monthly trainer schedule with conflict flags and free-slot advice"
        actions={<Button size="sm" variant="secondary" onClick={() => setAnchor(todayISO())}>Today</Button>}
      />
      <Toast msg={err} kind="danger" />

      <div className="jetz-stat-grid" style={{ marginBottom: 14 }}>
        <StatCard label="Sessions" value={allSessions.length} sub={`${range.from} → ${range.to}`} icon={<CalendarDays />} />
        <StatCard label="Conflicts" value={conflicts} sub={conflicts ? 'Overlapping trainer bookings' : 'No clashes'} icon={<AlertTriangle />} accent={conflicts > 0} />
        <StatCard label="Trainers" value={trainers} sub="Booked in this range" icon={<ShieldCheck />} />
      </div>

      <Toolbar>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          {(['day', 'week', 'month'] as const).map((m) => (
            <Button key={m} size="sm" variant={mode === m ? 'accent' : 'secondary'} onClick={() => setMode(m)}>{m[0].toUpperCase() + m.slice(1)}</Button>
          ))}
        </span>
        <Button size="sm" variant="secondary" onClick={() => shift(-1)}>Prev</Button>
        <Field label="Date" type="date" value={anchor} onChange={(e) => setAnchor(e.target.value || todayISO())} />
        <Button size="sm" variant="secondary" onClick={() => shift(1)}>Next</Button>
        <label><span className="jetz-label">Trainer</span>
          <Select value={coach} onChange={(e) => setCoach(e.target.value)}>
            <option value="">All trainers</option>
            {coaches.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name || ''} ({c.trainer_id})</option>)}
          </Select>
        </label>
        <label><span className="jetz-label">Sport</span>
          <Select value={sport} onChange={(e) => setSport(e.target.value)}>
            <option value="">All sports</option>
            {sports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </label>
      </Toolbar>

      {sportsInUse.length > 0 && (
        <div className="jetz-card" style={{ marginBottom: 14, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="jetz-panel-title" style={{ margin: 0 }}>Sports</span>
          {sportsInUse.map(([id, name]) => (
            <span key={String(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: ttColor(id), display: 'inline-block' }} />
              {name}
            </span>
          ))}
        </div>
      )}

      {loading && !data ? <SkeletonGrid count={6} /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: mode === 'day' ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12, marginBottom: 16 }}>
        {days.length === 0 && !loading ? <Empty message="No days in range." /> : null}
        {days.map((d: any) => (
          <div key={d.date} className="jetz-card" style={{ borderTop: `3px solid ${d.is_academy_off ? 'var(--jetz-faint)' : 'var(--jetz-accent)'}`, opacity: d.is_academy_off ? 0.75 : 1 }}>
            <div className="jetz-panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span>{TT_WD[(d.weekday + 7) % 7]} · {d.date.slice(5)}</span>
              {d.is_academy_off ? <span className="jetz-badge" title="Academy week off">Off</span> : null}
              {d.coach_off && !d.is_academy_off ? <span className="jetz-badge" title="Selected trainer's weekly off">Trainer off</span> : null}
            </div>
            <div className="jetz-panel-sub">
              {d.sessions.length ? `${d.sessions.length} session${d.sessions.length > 1 ? 's' : ''}` : (d.is_academy_off ? 'Academy closed' : 'No sessions')}
              {Array.isArray(d.windows) && d.windows.length ? ` · window ${d.windows[0].start_time}–${d.windows[d.windows.length - 1].end_time}` : ''}
            </div>
            {d.sessions.map((s: any) => (
              <div key={s.id} style={{ borderLeft: `3px solid ${s.has_conflict ? 'var(--jetz-danger)' : ttColor(s.sport)}`, paddingLeft: 8, marginTop: 8, background: s.has_conflict ? 'rgba(220,38,38,.08)' : 'transparent', borderRadius: 4 }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {s.has_conflict ? <AlertTriangle size={14} style={{ color: 'var(--jetz-danger)' }} /> : null}
                  {s.start_time}–{s.end_time} · Session {s.slot}
                </div>
                <div className="jetz-panel-sub">{s.batch_name || '—'} · {s.sport_name || '—'}</div>
                <div className="jetz-panel-sub">{s.coach_name || 'no coach'}{s.location_name ? ` · ${s.location_name}` : ''}</div>
                <div style={{ marginTop: 4 }}><StatusBadge value={s.status} /></div>
                {s.has_conflict ? <div style={{ fontSize: 11.5, color: 'var(--jetz-danger)', marginTop: 4 }}>Trainer double-booked — reassign coach or time.</div> : null}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="jetz-panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div className="jetz-card">
          <div className="jetz-panel-title">Find a free slot</div>
          <div className="jetz-panel-sub">Suggestions respect the trainer's working hours and any break buffer.</div>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <label><span className="jetz-label">Trainer *</span>
              <Select value={sfCoach} onChange={(e) => setSfCoach(e.target.value)}>
                <option value="">—</option>
                {coaches.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name || ''}</option>)}
              </Select>
            </label>
            <Field label="Date" type="date" value={sfDate} onChange={(e) => setSfDate(e.target.value)} />
            <Field label="Duration (min)" type="number" value={sfDur} onChange={(e) => setSfDur(e.target.value)} />
            <Button variant="accent" onClick={findSlots}>Find slots</Button>
          </div>
          {sfMsg && <Toast msg={sfMsg} />}
          {sfSlots && sfSlots.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {sfSlots.map((s: any) => (
                <span key={s.start_time} className="jetz-badge" style={{ background: 'rgba(249,115,22,.12)', padding: '4px 10px' }}>{s.start_time}–{s.end_time}</span>
              ))}
            </div>
          )}
        </div>

        <div className="jetz-card">
          <div className="jetz-panel-title">Find an available trainer</div>
          <div className="jetz-panel-sub">Qualified, not on weekly off, and free for the window.</div>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <label><span className="jetz-label">Sport *</span>
              <Select value={acSport} onChange={(e) => setAcSport(e.target.value)}>
                <option value="">—</option>
                {sports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
            <Field label="Date" type="date" value={acDate} onChange={(e) => setAcDate(e.target.value)} />
            <Field label="Start" type="time" value={acStart} onChange={(e) => setAcStart(e.target.value)} />
            <Field label="End" type="time" value={acEnd} onChange={(e) => setAcEnd(e.target.value)} />
            <Button variant="accent" onClick={findTrainers}>Find trainers</Button>
          </div>
          {acMsg && <Toast msg={acMsg} />}
          {acRows && acRows.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {acRows.map((c: any) => (
                <div key={c.id} style={{ fontSize: 13, padding: '4px 0', borderTop: '1px solid var(--jetz-border)' }}>{c.name} · {c.trainer_id}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= ATTENDANCE ================= */

const MARK = ['present', 'absent', 'late', 'leave'] as const;

export function Attendance() {
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { values: cfg } = useAcademySettings();
  const { can } = useAuth();
  const needReason = cfg['attendance.require_correction_reason'] !== false;
  const [students, setStudents] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ isMakeup?: boolean; makeupFor?: number | null }>({});
  const [muStudent, setMuStudent] = useState('');
  const [muMissed, setMuMissed] = useState('');
  const [muMsg, setMuMsg] = useState('');
  const [muBusy, setMuBusy] = useState(false);
  const canApproveMakeup = can('sessions.edit') || can('attendance.correct');
  useEffect(() => {
    api.get('/sessions/', { params: { ordering: '-date', page_size: 30 } })
      .then((r) => setSessions(toRows(r.data)))
      .catch(() => setSessions([]));
    api.get('/students/', { params: { page_size: 200, ordering: 'first_name' } })
      .then((r) => setStudents(toRows(r.data)))
      .catch(() => setStudents([]));
  }, []);
  const sel = sessions.find((s: any) => String(s.id) === String(sessionId));
  const marked = roster.filter((r) => r.status && r.status !== 'not_marked').length;
  const load = async (id?: string) => {
    const sid = id ?? sessionId;
    setOk(''); setMsg('');
    if (!sid) { setMsg('Pick a session first — recent sessions are listed above.'); return; }
    setLoading(true);
    try { const { data } = await api.get('/attendance/roster/', { params: { session: sid } }); setRoster(data.roster || []); setMeta({ isMakeup: !!data.is_makeup, makeupFor: data.makeup_for || null }); setSessionId(String(sid)); setLoaded(true); }
    catch (e: any) { setMsg(errMsg(e)); }
    finally { setLoading(false); }
  };
  const pick = (id: string) => { setSessionId(id); if (id) load(id); else { setRoster([]); setMeta({}); setLoaded(false); setMsg(''); setOk(''); } };
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.post('/attendance/bulk_mark/', { session: Number(sessionId), items: roster.map((r) => ({ student: r.student, status: r.status, ...(meta.makeupFor ? { makeup_for: meta.makeupFor } : {}) })), ...(needReason && reason.trim() ? { reason: reason.trim() } : {}) });
      const results = data?.results || [];
      const failed = results.filter((r: any) => r.error);
      if (failed.length) {
        const f0 = failed[0];
        setOk('');
        setMsg(`${results.length - failed.length}/${results.length} saved · ${failed.length} rejected (${f0.error}${f0.student ? ` — student ${f0.student}` : ''}). Roster reloaded below; correct and retry.`);
      } else {
        const n = results.length;
        setOk(`Attendance saved — ${n} record${n === 1 ? '' : 's'} for session ${sessionId}.`); setMsg('');
      }
      await load();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setSaving(false); }
  };
  const markAll = async (status: string) => {
    setSaving(true);
    try {
      const { data } = await api.post('/attendance/bulk_mark/', { session: Number(sessionId), items: roster.map((r) => ({ student: r.student, status, ...(meta.makeupFor ? { makeup_for: meta.makeupFor } : {}) })), ...(needReason && reason.trim() ? { reason: reason.trim() } : {}) });
      const results = data?.results || [];
      const failed = results.filter((r: any) => r.error);
      if (failed.length) {
        setOk('');
        setMsg(`${results.length - failed.length}/${results.length} saved · ${failed.length} rejected (${failed[0].error}). Roster reloaded below; correct and retry.`);
      } else {
        setOk(`All ${roster.length} marked ${status}.`); setMsg('');
      }
      await load();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setSaving(false); }
  };
  const setOne = (student: number, status: string) => setRoster((rs) => rs.map((r) => (r.student === student ? { ...r, status } : r)));
  return (
    <div>
      <PageHeader
        eyebrow="JETZ Academy / Academy / Attendance"
        title="Session Attendance"
        sub={sel ? `#${sel.id} · ${sel.batch_name || ''} · ${sel.date} · ${sel.coach_name || ''} · ${marked}/${roster.length} marked` : 'Pick a session to load its roster and mark attendance'}
        actions={roster.length > 0 ? <Can code="attendance.mark"><Button size="sm" variant="accent" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save current marks'}</Button></Can> : undefined}
      />
      <Toast msg={msg} />
      {ok && <Toast msg={ok} kind="success" />}
      <div className="jetz-card" style={{ marginBottom: 16 }}>
        <div className="jetz-form-card" style={{ marginBottom: 0 }}>
          <label><span className="jetz-label">Session *</span>
            <Select value={sessionId} onChange={(e) => pick(e.target.value)} style={{ minWidth: 260 }}>
              <option value="">— pick a recent session —</option>
              {sessions.map((s: any) => (
                <option key={s.id} value={s.id}>#{s.id} · {s.batch_name || '?'} · {s.date} · {s.status}</option>
              ))}
            </Select>
          </label>
          <Button onClick={() => load()} disabled={loading || !sessionId}>{loading ? 'Loading…' : 'Reload roster'}</Button>
          <Can code="attendance.mark"><Button variant="accent" onClick={() => markAll('present')} disabled={!roster.length || saving}>Mark all present & save</Button></Can>
          {needReason && <Field label="Correction reason (for re-marks)" placeholder="Required for corrections" value={reason} onChange={(e) => setReason(e.target.value)} />}
        </div>
      </div>
      {sessionId && meta.isMakeup && (
        <div className="jetz-card" style={{ marginBottom: 12, borderLeft: '3px solid var(--jetz-accent)' }}>
          <div className="jetz-panel-title">Make-up session{meta.makeupFor ? ` · missed session #${meta.makeupFor}` : ''}</div>
          <div className="jetz-panel-sub">Marks saved here are recorded against this session and linked to the missed one. The original absence stays on record.</div>
        </div>
      )}
      {sessionId && canApproveMakeup && (can('sessions.edit') || can('attendance.correct')) && (
        <div className="jetz-card" style={{ marginBottom: 16 }}>
          <div className="jetz-panel-title">Add a make-up student</div>
          <div className="jetz-panel-sub">Enrol a student into this session for a missed one. Race/eligibility, duplicate and capacity checks run on the server.</div>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <label><span className="jetz-label">Student *</span>
              <Select value={muStudent} onChange={(e) => setMuStudent(e.target.value)} style={{ minWidth: 220 }}>
                <option value="">— pick a student —</option>
                {students.map((s: any) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name || ''} · {s.student_id}</option>)}
              </Select>
            </label>
            <label><span className="jetz-label">Missed session (optional)</span>
              <Select value={muMissed} onChange={(e) => setMuMissed(e.target.value)} style={{ minWidth: 220 }}>
                <option value="">— none / not linked —</option>
                {sessions.filter((s: any) => String(s.id) !== String(sessionId)).map((s: any) => <option key={s.id} value={s.id}>#{s.id} · {s.date} · {s.status}</option>)}
              </Select>
            </label>
            <Button variant="accent" disabled={!muStudent || muBusy} onClick={async () => {
              setMuBusy(true); setMuMsg('');
              try {
                await api.post(`/sessions/${sessionId}/add_student/`, { student: Number(muStudent), ...(muMissed ? { makeup_for: Number(muMissed) } : {}) });
                setMuMsg('Student added.'); setMuStudent(''); setMuMissed(''); await load();
              } catch (e: any) { setMuMsg(errMsg(e)); }
              finally { setMuBusy(false); }
            }}>{muBusy ? 'Adding…' : 'Add to session'}</Button>
          </div>
          {muMsg && <Toast msg={muMsg} kind={muMsg.includes('added') ? 'success' : 'danger'} />}
        </div>
      )}
      <DataTable
        columns={['Student', 'ID', 'Status', 'Marked by', 'Marked at', 'Mark']}
        rows={roster.map((r) => [
          r.name,
          r.student_id || r.student,
          <StatusBadge key={r.student} value={r.status} />,
          r.marked_by_name || '—',
          r.marked_at ? new Date(r.marked_at).toLocaleString() : '—',
          <Can code="attendance.mark">
          <span key={'m' + r.student} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {MARK.map((s) => (
              <Button key={s} size="sm" variant={r.status === s ? 'accent' : 'secondary'} onClick={() => setOne(r.student, s)}>{s}</Button>
            ))}
          </span>
          </Can>,
        ])}
        empty={loaded ? 'Roster is empty — this session has no assigned students yet.' : 'No roster loaded. Pick a session above.'}
      />
      {roster.length > 0 && <Can code="attendance.mark"><Button style={{ marginTop: 12 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : `Save attendance (${marked}/${roster.length} marked)`}</Button></Can>}
    </div>
  );
}

/* ================= FEES ================= */

export function Fees() {
  const [status, setStatus] = useState('');
  const { rows, count, err, page, setPage, reload } = usePaged('/fees/', status ? { status } : {});
  const plans = useOptions('/fees/plans/');
  const students = useOptions('/students/?page_size=200');
  const [form, setForm] = useState({ student: '', fee_plan: '', period_label: '', amount: '', due_date: '' });
  const [stuQ, setStuQ] = useState('');
  const stuMatches = students.filter((s: any) => {
    const q = stuQ.trim().toLowerCase();
    if (!q) return true;
    return `${s.first_name} ${s.last_name || ''} ${s.student_id}`.toLowerCase().includes(q);
  }).slice(0, 30);
  const [planForm, setPlanForm] = useState({ name: '', cycle: 'monthly', amount: '' });
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [sum, setSum] = useState<any>(null);
  const [payFor, setPayFor] = useState<any>(null);
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [confirmOverdue, setConfirmOverdue] = useState(false);
  const [adjustFor, setAdjustFor] = useState<any>(null);
  const [adjAmt, setAdjAmt] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjBusy, setAdjBusy] = useState(false);
  const { values: cfg } = useAcademySettings();
  const loadSum = () => api.get('/fees/summary/').then((r) => setSum(r.data)).catch(() => {});
  useEffect(() => { loadSum(); }, []);
  const refreshAll = () => { loadSum(); reload(); };
  useEffect(() => {
    if (cfg['fees.default_cycle'] && planForm.cycle === 'monthly' && cfg['fees.default_cycle'] !== 'monthly') {
      setPlanForm((f) => ({ ...f, cycle: String(cfg['fees.default_cycle']) }));
    }
    if (cfg['fees.default_due_day'] && !form.due_date) {
      const now = new Date();
      const dd = String(Math.min(28, Math.max(1, Number(cfg['fees.default_due_day']) || 5))).padStart(2, '0');
      const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${dd}`;
      setForm((f) => (f.due_date ? f : { ...f, due_date: iso }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg['fees.default_cycle'], cfg['fees.default_due_day']]);
  const allocate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post('/fees/', { ...form, student: Number(form.student), fee_plan: Number(form.fee_plan), amount: form.amount }); setForm({ student: '', fee_plan: '', period_label: '', amount: '', due_date: form.due_date }); setOk('Fee allocated.'); refreshAll(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };
  const openPay = (f: any) => { setPayFor(f); setPayAmt(f.balance ?? f.amount); setPayMethod('cash'); setPayRef(''); setMsg(''); setOk(''); };
  const recordPay = async () => {
    if (!payFor || payBusy) return;
    setPayBusy(true); setMsg(''); setOk('');
    try {
      const { data } = await api.post(`/fees/${payFor.id}/record_payment/`, { amount: payAmt, method: payMethod, reference: payRef });
      setOk(`Payment recorded · receipt ${data.receipt} · fee is now ${data.fee_status}.`);
      setPayFor(null); refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setPayBusy(false); }
  };
  const doOverdue = async () => {
    setConfirmOverdue(false); setMsg(''); setOk('');
    try {
      const { data } = await api.post('/fees/mark_overdue/', {});
      setOk(`${data.marked_overdue ?? 0} past-due fee(s) marked overdue.`); refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const openAdjust = (f: any) => { setAdjustFor(f); setAdjAmt(''); setAdjReason(''); setMsg(''); setOk(''); };
  const recordAdjust = async () => {
    if (!adjustFor || adjBusy) return;
    if (!adjAmt.trim()) { setMsg('Adjustment amount is required (positive = larger discount).'); return; }
    if (!adjReason.trim()) { setMsg('A reason is required — adjustments are audited.'); return; }
    setAdjBusy(true); setMsg(''); setOk('');
    try {
      await api.post(`/fees/${adjustFor.id}/adjust/`, { amount: adjAmt.trim(), reason: adjReason.trim() });
      setOk(`Adjustment recorded on ${adjustFor.student_name || ''} · ${adjustFor.period_label}.`);
      setAdjustFor(null); refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setAdjBusy(false); }
  };
  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post('/fees/plans/', { ...planForm, amount: planForm.amount, is_active: true }); setPlanForm({ name: '', cycle: 'monthly', amount: '' }); }
    catch (e: any) { setMsg(errMsg(e)); }
  };
  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Finance / Fees" title="Fee Ledger" count={count} sub={`${count} fee records · amounts from Fee Plans (never hardcoded)`} actions={<span style={{ display: 'flex', gap: 8 }}><Button size="sm" variant="secondary" onClick={refreshAll}>Refresh</Button><Can code="fees.edit"><Button size="sm" variant="accent" onClick={() => setConfirmOverdue(true)}>Mark overdue</Button></Can></span>} />
      <Toast msg={err || msg} kind={(err || msg) ? 'danger' : 'warning'} />
      {ok && <Toast msg={ok} kind="success" />}
      {sum && (
        <div className="jetz-stat-grid" style={{ marginBottom: 14 }}>
          <StatCard label="Collected" value={`₹${Number(sum.collected || 0).toLocaleString('en-IN')}`} icon={<UserCheck />} accent />
          <StatCard label="Outstanding" value={`₹${Number(sum.outstanding || 0).toLocaleString('en-IN')}`} icon={<Hourglass />} />
          <StatCard label="Billed" value={`₹${Number(sum.billed || 0).toLocaleString('en-IN')}`} icon={<Wallet />} />
          <StatCard label="By status" value={(sum.by_status || []).map((b: any) => `${b.status}: ${b.count}`).join(' · ') || '—'} icon={<UsersIcon />} />
        </div>
      )}
      <Toolbar>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {FEE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <form onSubmit={createPlan} style={{ display: 'contents' }}>
          <Field label="New plan name" placeholder="Football Monthly" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
          <label><span className="jetz-label">Cycle</span><Select value={planForm.cycle} onChange={(e) => setPlanForm({ ...planForm, cycle: e.target.value })}><option value="monthly">monthly</option><option value="quarterly">quarterly</option><option value="half_yearly">half_yearly</option></Select></label>
          <Field label="Amount" placeholder="2500" value={planForm.amount} onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })} />
          <Can code="fees.create"><Button type="submit">Create plan</Button></Can>
        </form>
      </Toolbar>
      <form onSubmit={allocate} className="jetz-card" style={{ marginBottom: 14 }}>
        <div className="jetz-form-card" style={{ marginBottom: 0 }}>
          <div style={{ flex: '1 1 100%', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', minWidth: 200 }}>
              <span className="jetz-label">Search student</span>
              <SearchBox value={stuQ} onChange={(v) => setStuQ(v)} placeholder="Type name or ID to filter…" />
            </div>
            <label style={{ flex: '2 1 280px', minWidth: 240 }}><span className="jetz-label">Student *</span><Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required style={{ width: '100%' }}><option value="">— pick a student —</option>{stuMatches.map((s: any) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name || ''} ({s.student_id})</option>)}</Select></label>
          </div>
          <label><span className="jetz-label">Fee plan *</span><Select value={form.fee_plan} onChange={(e) => setForm({ ...form, fee_plan: e.target.value })} required><option value="">—</option>{plans.map((p: any) => <option key={p.id} value={p.id}>{p.name} · ₹{p.amount}</option>)}</Select></label>
          <Field label="Period *" placeholder="2026-10" value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} required />
          <Field label="Amount *" placeholder="2500" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <Field label="Due date *" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
          <Can code="fees.create"><Button type="submit" variant="accent">Allocate fee</Button></Can>
        </div>
      </form>
      <DataTable columns={['Student', 'Period', 'Amount', 'Paid', 'Balance', 'Status', 'Action']} rows={rows.map((f: any) => [f.student_name || f.student, f.period_label, f.amount, f.paid_total ?? 0, f.balance ?? '-', <StatusBadge key={f.id} value={f.status} />, !['paid', 'cancelled', 'refunded'].includes(f.status) ? <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Can key={'p' + f.id} code="payments.verify"><Button size="sm" variant="accent" onClick={() => openPay(f)}>Record payment</Button></Can><Can key={'a' + f.id} code="fees.adjust"><Button size="sm" variant="secondary" onClick={() => openAdjust(f)}>Adjust</Button></Can></span> : '-'])} />
      <Pager page={page} count={count} setPage={setPage} />
      {adjustFor && (
        <div className="jetz-card" style={{ marginTop: 12, borderLeft: '4px solid var(--jetz-accent)' }}>
          <div className="jetz-panel-title">Fee adjustment — {adjustFor.student_name || ''} · {adjustFor.period_label} · balance ₹{adjustFor.balance}</div>
          <div className="jetz-panel-sub">A positive amount increases the discount (the student owes less) — e.g. 1000 for a mid-month joiner. Every adjustment needs a reason and is audit-logged.</div>
          <div className="jetz-form-card" style={{ marginBottom: 0, marginTop: 8 }}>
            <Field label="Amount * (+ discount)" placeholder="1000" value={adjAmt} onChange={(e) => setAdjAmt(e.target.value)} required />
            <Field label="Reason *" placeholder="Mid-month joining…" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} required />
            <Button variant="accent" onClick={recordAdjust} disabled={adjBusy}>{adjBusy ? 'Saving…' : 'Record adjustment'}</Button>
            <Button variant="secondary" onClick={() => setAdjustFor(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {payFor && (
        <div className="jetz-card" style={{ marginTop: 12, borderLeft: '4px solid var(--jetz-accent)' }}>
          <div className="jetz-panel-title">Record payment — {payFor.student_name || ''} · {payFor.period_label} · balance ₹{payFor.balance}</div>
          <div className="jetz-panel-sub">Cash, UPI or bank transfer received directly. A verified receipt is issued and the fee flips to paid / partially paid. Online gateway payments still verify by webhook only.</div>
          <div className="jetz-form-card" style={{ marginBottom: 0, marginTop: 8 }}>
            <Field label="Amount (₹) *" placeholder={String(payFor.balance ?? '')} value={payAmt} onChange={(e) => setPayAmt(e.target.value)} required />
            <label><span className="jetz-label">Method</span>
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="cash">cash</option>
                <option value="upi">upi</option>
                <option value="bank_transfer">bank_transfer</option>
              </Select>
            </label>
            <Field label="Reference (optional)" placeholder="Receipt / txn note" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            <Button variant="accent" onClick={recordPay} disabled={payBusy}>{payBusy ? 'Saving…' : 'Record payment'}</Button>
            <Button variant="secondary" onClick={() => setPayFor(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {confirmOverdue && (
        <ConfirmDialog
          title="Mark past-due fees overdue?"
          message="All unpaid fees past their due date flip to overdue. Paid, cancelled and refunded fees are untouched."
          confirmLabel="Mark overdue"
          onConfirm={doOverdue}
          onCancel={() => setConfirmOverdue(false)}
        />
      )}
    </div>
  );
}

/* ================= PAYMENTS ================= */

export function Payments() {
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [verified, setVerified] = useState('');
  const [search, setSearch] = useState('');
  const { rows, count, err, page, setPage, reload, loading } = usePaged('/payments/', { ...(status ? { status } : {}), ...(provider ? { provider } : {}), ...(verified ? { verified } : {}), ...(search ? { search } : {}) });
  const [sum, setSum] = useState({ collected: 0, pending: 0, failed: 0, n: 0 });
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [initFee, setInitFee] = useState('');
  const [initAmt, setInitAmt] = useState('');
  const [busy, setBusy] = useState(false);
  const [refundAmt, setRefundAmt] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);
  useEffect(() => {
    api.get('/payments/', { params: { page_size: 200 } }).then((r) => {
      const all = toRows(r.data);
      setSum({
        collected: all.filter((p: any) => p.status === 'success').reduce((a: number, p: any) => a + Number(p.amount || 0), 0),
        pending: all.filter((p: any) => ['initiated', 'pending'].includes(p.status)).length,
        failed: all.filter((p: any) => p.status === 'failed').length,
        n: typeof r.data?.count === 'number' ? r.data.count : all.length,
      });
    }).catch(() => {});
  }, [page, status, provider, verified, search]);
  const clearF = () => { setStatus(''); setProvider(''); setVerified(''); setSearch(''); };
  const initiate = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!initFee.trim()) { setMsg('Student fee ID is required.'); return; }
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post('/payments/', { student_fee: Number(initFee), ...(initAmt ? { amount: initAmt } : {}) });
      setOk(`Payment initiated — order ${data.provider_order_id || data.id}. Share it for gateway payment; the fee updates only after webhook verification.`);
      setInitFee(''); setInitAmt(''); reload();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };
  const doRefund = async () => {
    if (!detail || detail.status !== 'success') return;
    if (!refundReason.trim()) { setMsg('Refund reason is required.'); return; }
    setConfirmRefund(false);
    setRefundBusy(true); setMsg('');
    try {
      await api.post(`/payments/${detail.id}/refund/`, { ...(refundAmt ? { amount: refundAmt } : {}), reason: refundReason.trim() });
      setOk('Refund recorded and payment marked refunded.'); setRefundAmt(''); setRefundReason('');
      const { data } = await api.get(`/payments/${detail.id}/`); setDetail(data); reload();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setRefundBusy(false); }
  };
  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Finance / Payments" title="Payments" count={count} sub={`${count} transactions · webhook-verified only · frontend never marks paid`} actions={<Button size="sm" variant="secondary" onClick={reload}>Refresh</Button>} />
      <Toast msg={err || msg} />
      {ok && <Toast msg={ok} kind="success" />}
      <div className="jetz-stat-grid" style={{ marginBottom: 14 }}>
        <StatCard label="Transactions" value={sum.n} sub="All gateway orders" icon={<CreditCard />} accent />
        <StatCard label="Collected" value={`₹${Number(sum.collected).toLocaleString('en-IN')}`} sub="Verified success payments" icon={<Wallet />} />
        <StatCard label="Pending" value={sum.pending} sub="Initiated, awaiting webhook" icon={<Hourglass />} />
        <StatCard label="Failed" value={sum.failed} sub="Needs retry or support" icon={<AlertTriangle />} />
      </div>
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search receipt / order / payment ID…" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['initiated', 'pending', 'success', 'failed', 'refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="">All providers</option>
          {['mock', 'razorpay', 'stripe'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={verified} onChange={(e) => setVerified(e.target.value)}>
          <option value="">Verified: all</option>
          <option value="true">Verified only</option>
          <option value="false">Unverified only</option>
        </Select>
        {(status || provider || verified || search) && <Button variant="secondary" onClick={clearF}>Clear</Button>}
        <span style={{ fontSize: 12.5, color: 'var(--jetz-muted)', alignSelf: 'center' }}>{loading ? 'Loading…' : `${count} matching`}</span>
      </Toolbar>
      <form onSubmit={initiate} className="jetz-card" style={{ marginBottom: 14 }}>
        <div className="jetz-panel-title">Initiate gateway payment</div>
        <div className="jetz-form-card" style={{ marginBottom: 0 }}>
          <Field label="Student fee ID *" placeholder="123" value={initFee} onChange={(e) => setInitFee(e.target.value)} required />
          <Field label="Amount (blank = full balance)" placeholder="2500" value={initAmt} onChange={(e) => setInitAmt(e.target.value)} />
          <Can code="payments.create"><Button type="submit" variant="accent" disabled={busy}>{busy ? 'Creating…' : 'Create order'}</Button></Can>
        </div>
        <p className="jetz-note" style={{ margin: '8px 0 0' }}>Creates a gateway order — the fee ledger updates only after signed webhook verification.</p>
      </form>
      <DataTable
        columns={['Receipt', 'Amount', 'Provider', 'Status', 'Verified', 'Created', 'Actions']}
        rows={rows.map((p: any) => [
          p.receipt_no || `order ${p.provider_order_id || p.id}`,
          `₹${Number(p.amount || 0).toLocaleString('en-IN')}`, p.provider,
          <StatusBadge key={p.id} value={p.status} />,
          p.verified ? 'Yes' : 'No',
          (p.created_at || '').slice(0, 16).replace('T', ' '),
          <span key={'a' + p.id} style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={() => { setDetail(p); setRefundAmt(''); setRefundReason(''); setMsg(''); }}>View</Button>
            {p.status === 'success' && <Can code="payments.refund"><Button size="sm" variant="secondary" onClick={() => { setDetail(p); setRefundAmt(''); setRefundReason(''); }}>Refund</Button></Can>}
          </span>,
        ])}
        empty="No payments yet. Initiate one above or wait for gateway webhooks."
      />
      <Pager page={page} count={count} setPage={setPage} />
      {detail && (
        <Detail title={`Receipt ${detail.receipt_no || detail.id} — ₹${Number(detail.amount || 0).toLocaleString('en-IN')}`} onClose={() => setDetail(null)}>
          <DataTable
            columns={['Field', 'Value']}
            rows={[
              ['Status', detail.status], ['Verified', detail.verified ? `Yes · ${detail.verified_at || ''}` : 'No'],
              ['Provider', detail.provider], ['Order ID', detail.provider_order_id || '-'],
              ['Payment ID', detail.provider_payment_id || '-'], ['Fee record', detail.student_fee],
              ['Idempotency key', detail.idempotency_key || '-'], ['Created', (detail.created_at || '').slice(0, 16).replace('T', ' ')],
            ]}
          />
          {detail.status === 'success' && (
            <div className="jetz-card" style={{ marginTop: 12 }}>
              <div className="jetz-panel-title">Refund (requires reason, audited)</div>
              <div className="jetz-form-card" style={{ marginBottom: 0 }}>
                <Field label="Amount (blank = full)" value={refundAmt} onChange={(e) => setRefundAmt(e.target.value)} />
                <Field label="Reason *" placeholder="Duplicate charge…" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
                <Button variant="danger" disabled={refundBusy} onClick={() => { if (!refundReason.trim()) { setMsg('Refund reason is required.'); return; } setConfirmRefund(true); }}>{refundBusy ? 'Recording…' : 'Record refund'}</Button>
              </div>
            </div>
          )}
        </Detail>
      )}
      {confirmRefund && detail && (
        <ConfirmDialog
          title="Record refund?"
          message={`Refund ₹${Number(refundAmt || detail.amount).toLocaleString('en-IN')} for receipt ${detail.receipt_no || detail.id}? This is audited and marks the payment refunded.`}
          confirmLabel="Record refund"
          danger
          busy={refundBusy}
          onConfirm={doRefund}
          onCancel={() => { if (!refundBusy) setConfirmRefund(false); }}
        />
      )}
    </div>
  );
}

/* ================= TRAINERS ================= */

const dayNames = (days: any): string =>
  Array.isArray(days) && days.length ? [...days].sort((a, b) => a - b).map((d) => WEEKDAYS[d] || `Day ${d}`).join(', ') : '—';

function OffDayPicker({ value, onChange, max = 2 }: { value: number[]; onChange: (d: number) => void; max?: number }) {
  return (
    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Pick days">
      {WEEKDAYS.map((d, i) => {
        const active = value.includes(i);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(i)}
            aria-pressed={active}
            title={d}
            style={{
              appearance: 'none', cursor: 'pointer', fontFamily: 'var(--jetz-font)',
              fontSize: 12.5, fontWeight: 700, padding: '8px 0', width: 52, textAlign: 'center',
              borderRadius: 9, border: `1.5px solid ${active ? 'var(--jetz-navy)' : 'var(--jetz-border-strong)'}`,
              background: active ? 'var(--jetz-navy)' : '#fff',
              color: active ? '#fff' : 'var(--jetz-text)',
            }}
          >
            {d}
          </button>
        );
      })}
    </span>
  );
}

function toggleDaysInList(prev: number[], d: number, max = 2): number[] {
  return prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].slice(-max);
}

export function Trainers() {
  const [search, setSearch] = useState('');
  const { rows, count, err, page, setPage, reload } = usePaged('/coaches/', search ? { search } : {});
  const [form, setForm] = useState({ trainer_id: '', first_name: '', last_name: '', phone: '', email: '', school: '' });
  const schools = useOptions('/schools/');
  const [offDays, setOffDays] = useState<number[]>([]);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [editOffs, setEditOffs] = useState<number[]>([]);
  const [savingOffs, setSavingOffs] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', phone: '', email: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const toggleDay = (setter: React.Dispatch<React.SetStateAction<number[]>>) => (d: number) =>
    setter((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].slice(-2)));

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (offDays.length !== 2) { setMsg('Pick exactly two weekly off-days for the trainer (any days — not fixed to Sat/Sun).'); return; }
    try {
      await api.post('/coaches/', { ...form, school: form.school ? Number(form.school) : null, weekly_off_days: [...offDays].sort((a, b) => a - b), is_active: true });
      setForm({ trainer_id: '', first_name: '', last_name: '', phone: '', email: '', school: '' });
      setOffDays([]); setOk('Trainer added with the selected week-offs.'); reload();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const toggle = async (c: any) => {
    try { await api.patch(`/coaches/${c.id}/`, { is_active: !c.is_active }); reload(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };
  const view = async (c: any) => {
    try {
      const [sess, avail] = await Promise.all([
        api.get('/sessions/', { params: { coach: c.id } }).catch(() => ({ data: [] })),
        api.get('/coaches/availability/list/', { params: { coach: c.id } }).catch(() => ({ data: [] })),
      ]);
      setEditOffs(Array.isArray(c.weekly_off_days) ? [...c.weekly_off_days] : []);
      setEditingProfile(false);
      setProfileForm({ first_name: c.first_name || '', last_name: c.last_name || '', phone: c.phone || '', email: c.email || '' });
      setDetail({ ...c, sessions: toRows(sess.data).slice(0, 10), availability: toRows(avail.data) });
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const saveProfile = async () => {
    if (!detail) return;
    if (!profileForm.first_name.trim()) { setMsg('First name is required.'); return; }
    if (profileForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) { setMsg('Enter a valid email address.'); return; }
    setSavingProfile(true); setMsg(''); setOk('');
    try {
      const { data } = await api.patch(`/coaches/${detail.id}/`, { first_name: profileForm.first_name.trim(), last_name: profileForm.last_name.trim(), phone: profileForm.phone.trim(), email: profileForm.email.trim() });
      setDetail((d: any) => (d ? { ...d, ...data } : d));
      setEditingProfile(false);
      setOk(`Trainer profile saved — apps pick up the new name on refresh.`);
      reload();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setSavingProfile(false); }
  };
  const saveOffs = async () => {
    if (!detail) return;
    if (editOffs.length !== 2) { setMsg('Pick exactly two weekly off-days.'); return; }
    setSavingOffs(true); setMsg(''); setOk('');
    try {
      const { data } = await api.patch(`/coaches/${detail.id}/`, { weekly_off_days: [...editOffs].sort((a, b) => a - b) });
      setDetail((d: any) => (d ? { ...d, weekly_off_days: data.weekly_off_days } : d));
      setOk(`Week-offs updated to ${dayNames(data.weekly_off_days)}.`);
      reload();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setSavingOffs(false); }
  };

  // Availability check: one trainer's day across all sports — free, busy or clashing.
  const [availCoach, setAvailCoach] = useState('');
  const [availDate, setAvailDate] = useState(todayISO());
  const [availRows, setAvailRows] = useState<any[]>([]);
  const [availBusy, setAvailBusy] = useState(false);
  const [availChecked, setAvailChecked] = useState(false);
  const [certs, setCerts] = useState<any[]>([]);
  const [certTrainer, setCertTrainer] = useState('');
  const [certFrom, setCertFrom] = useState('');
  const [certTo, setCertTo] = useState('');
  const [certTitle, setCertTitle] = useState('');
  const [certBusy, setCertBusy] = useState(false);
  const loadCerts = async () => {
    try {
      const { data } = await api.get('/coaches/certificates/', { params: { ...(certTrainer ? { trainer: certTrainer } : {}), page_size: 20 } });
      setCerts(toRows(data));
    } catch { /* table simply stays as-is */ }
  };
  useEffect(() => { loadCerts(); }, [certTrainer]);
  const genCert = async () => {
    if (!certTrainer) { setMsg('Pick a trainer to issue a certificate.'); return; }
    setCertBusy(true); setMsg(''); setOk('');
    try {
      const { data } = await api.post('/coaches/certificates/generate/', {
        trainer: Number(certTrainer),
        ...(certFrom ? { period_from: certFrom } : {}),
        ...(certTo ? { period_to: certTo } : {}),
        ...(certTitle.trim() ? { title: certTitle.trim() } : {}),
      });
      setOk(`Certificate issued — ${data.sessions_completed} completed sessions in range. PDF attached.`);
      setCertTitle(''); loadCerts();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setCertBusy(false); }
  };  const checkAvail = async () => {
    if (!availCoach) { setMsg('Pick a trainer to check availability.'); return; }
    setAvailBusy(true); setMsg('');
    try {
      const { data } = await api.get('/sessions/', { params: { coach: availCoach, date: availDate, page_size: 50, ordering: 'start_time' } });
      setAvailRows(toRows(data));
      setAvailChecked(true);
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setAvailBusy(false); }
  };
  const availSorted = [...availRows].sort((a: any, b: any) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
  const availClashes: number[] = [];
  availSorted.forEach((s: any, i: number) => {
    const prev = availSorted[i - 1];
    if (prev && s.start_time && prev.end_time && s.start_time < prev.end_time) availClashes.push(s.id, prev.id);
  });

  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Academy / Trainers" title="Trainers" count={count} sub={`${count} coaching staff · any 2 weekly off-days each · conflicts flagged`} actions={<Button size="sm" variant="secondary" onClick={reload}>Refresh</Button>} />
      <Toast msg={err || msg} />
      {ok && <Toast msg={ok} kind="success" />}
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search trainers…" />
        <form onSubmit={create} style={{ display: 'contents' }}>
          <Field label="Trainer ID *" value={form.trainer_id} onChange={(e) => setForm({ ...form, trainer_id: e.target.value })} required />
          <Field label="First name *" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <Field label="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          <Field label="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <Field label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {schools.length > 0 && (
            <label><span className="jetz-label">School</span>
              <Select value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })}>
                <option value="">—</option>{schools.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
          )}
          <span className="jetz-field" style={{ display: 'block' }}>
            <span className="jetz-label">Weekly off-days * <span style={{ fontWeight: 400, color: 'var(--jetz-faint)' }}>({offDays.length}/2 — any days)</span></span>
            <OffDayPicker value={offDays} onChange={toggleDay(setOffDays)} />
          </span>
          <Can code="coaches.create"><Button type="submit" variant="accent">Add trainer</Button></Can>
        </form>
      </Toolbar>
      <Section title="Availability check" sub="One trainer's day across every sport — free, busy or clashing">
        <div className="jetz-card" style={{ marginBottom: 0 }}>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <label><span className="jetz-label">Trainer *</span><Select value={availCoach} onChange={(e) => setAvailCoach(e.target.value)} style={{ minWidth: 220 }}><option value="">— pick trainer —</option>{rows.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name || ''} ({c.trainer_id})</option>)}</Select></label>
            <Field label="Date *" type="date" value={availDate} onChange={(e) => setAvailDate(e.target.value || todayISO())} required />
            <Button variant="accent" onClick={checkAvail} disabled={availBusy}>{availBusy ? 'Checking…' : 'Check availability'}</Button>
          </div>
          {availChecked && (
            <div style={{ marginTop: 12 }}>
              {availSorted.length === 0 ? (
                <p className="jetz-note" style={{ margin: 0 }}>Free all day — no sessions assigned on {availDate}.</p>
              ) : (
                <>
                  <DataTable
                    columns={['Time', 'Sport', 'Batch', 'Status', 'State']}
                    rows={availSorted.map((s: any) => [
                      `${s.start_time || ''}–${s.end_time || ''}`, s.sport_name || '-', s.batch_name || '-',
                      <StatusBadge key={s.id} value={s.status} />,
                      availClashes.includes(s.id)
                        ? <span key={'c' + s.id} style={{ color: 'var(--jetz-danger, #b91c1c)', fontWeight: 700 }}>⚠ overlaps another session</span>
                        : <span key={'c' + s.id} style={{ color: 'var(--jetz-success, #16a34a)', fontWeight: 600 }}>busy — no clash</span>,
                    ])}
                  />
                  {availClashes.length > 0 && (
                    <p className="jetz-note" style={{ margin: '8px 0 0', color: 'var(--jetz-danger, #b91c1c)', fontWeight: 600 }}>
                      {availClashes.length / 2} overlapping pair(s) — move one session before confirming the day.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </Section>
      <DataTable
        columns={['ID', 'Name', 'Phone', 'School', 'Off-days', 'Active', 'Actions']}
        rows={rows.map((c: any) => [
          c.trainer_id, `${c.first_name} ${c.last_name || ''}`, c.phone, c.school_name || '—',
          <span key={'o' + c.id} style={{ fontWeight: 600 }}>{dayNames(c.weekly_off_days)}</span>,
          <StatusBadge key={c.id} value={c.is_active ? 'active' : 'inactive'} />,
          <span key={'a' + c.id} style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={() => view(c)}>View</Button>
            <Can code="coaches.edit"><Button size="sm" variant="secondary" onClick={() => toggle(c)}>{c.is_active ? 'Deactivate' : 'Activate'}</Button></Can>
          </span>,
        ])}
      />
      <Pager page={page} count={count} setPage={setPage} />
      <Section title="Service certificates" sub="Issued for completed sessions in a period (defaults to last 3 months) · PDF attached · visible in the trainer app">
        <div className="jetz-card" style={{ marginBottom: 12 }}>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <label><span className="jetz-label">Trainer *</span><Select value={certTrainer} onChange={(e) => setCertTrainer(e.target.value)} style={{ minWidth: 200 }}><option value="">— pick trainer —</option>{rows.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name || ''} ({c.trainer_id})</option>)}</Select></label>
            <Field label="From (default 3 months back)" type="date" value={certFrom} onChange={(e) => setCertFrom(e.target.value)} />
            <Field label="To (default today)" type="date" value={certTo} onChange={(e) => setCertTo(e.target.value)} />
            <Field label="Title" placeholder="Certificate of Service Excellence" value={certTitle} onChange={(e) => setCertTitle(e.target.value)} />
            <Can code="coaches.edit"><Button variant="accent" onClick={genCert} disabled={certBusy}>{certBusy ? 'Issuing…' : 'Issue certificate'}</Button></Can>
          </div>
        </div>
        <DataTable
          columns={['Trainer', 'Title', 'Period', 'Sessions', 'Issued', 'File']}
          rows={certs.map((c: any) => {
            const t = rows.find((x: any) => String(x.id) === String(c.trainer));
            return [
              c.trainer_name || (t ? `${t.first_name} ${t.last_name || ''}` : `#${c.trainer}`), c.title,
              `${c.period_from} → ${c.period_to}`, c.sessions_completed,
              (c.issued_at || '').slice(0, 10),
              c.file ? <a key={'f' + c.id} href={c.file} target="_blank" rel="noreferrer">Open PDF</a> : '-',
            ];
          })}
          empty="No certificates issued yet."
        />
      </Section>
      {detail && (
        <Detail title={`${detail.trainer_id} — ${detail.first_name} ${detail.last_name || ''}`} onClose={() => setDetail(null)}>
          <p className="jetz-note">{detail.phone} · {detail.email || 'no email'} · off-days: <strong>{dayNames(detail.weekly_off_days)}</strong></p>
          {!editingProfile ? (
            <div style={{ marginBottom: 10 }}><Can code="coaches.edit"><Button size="sm" onClick={() => setEditingProfile(true)}>Edit profile</Button></Can></div>
          ) : (
            <div className="jetz-card" style={{ marginBottom: 10 }}>
              <div className="jetz-panel-title" style={{ marginBottom: 8 }}>Edit profile — name changes reflect in the trainer app</div>
              <div className="jetz-form-card" style={{ marginBottom: 0 }}>
                <Field label="First name *" value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} required />
                <Field label="Last name" value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} />
                <Field label="Phone *" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} required />
                <Field label="Email" type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
                <Can code="coaches.edit"><Button size="sm" variant="accent" onClick={saveProfile} disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</Button></Can>
                <Button size="sm" variant="secondary" onClick={() => setEditingProfile(false)}>Cancel</Button>
              </div>
            </div>
          )}
          <div className="jetz-panel-title" style={{ marginBottom: 6 }}>Weekly off-days — pick any two</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <OffDayPicker value={editOffs} onChange={toggleDay(setEditOffs)} />
            <Can code="coaches.edit"><Button size="sm" variant="accent" onClick={saveOffs} disabled={savingOffs || editOffs.length !== 2}>
              {savingOffs ? 'Saving…' : 'Save week-offs'}
            </Button></Can>
          </div>
          <div className="jetz-panel-title" style={{ marginBottom: 6 }}>Recent sessions</div>
          <DataTable columns={['Batch', 'Date', 'Status']} rows={(detail.sessions || []).map((s: any) => [s.batch_name || s.batch, s.date, s.status])} empty="No sessions assigned." />
          <div style={{ height: 10 }} />
          <div className="jetz-panel-title" style={{ marginBottom: 6 }}>Availability</div>
          <DataTable columns={['Weekday', 'Start', 'End', 'Available']} rows={(detail.availability || []).map((a: any) => [a.weekday, a.start_time, a.end_time, String(a.is_available)])} empty="No availability configured." />
          <div style={{ height: 10 }} />
          <CoachCheckins coachId={detail.id} sessions={detail.sessions || []} />
        </Detail>
      )}
    </div>
  );
}

function CoachCheckins({ coachId, sessions }: { coachId: number; sessions: any[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [session, setSession] = useState('');
  const [status, setStatus] = useState('present');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const { data } = await api.get('/coaches/checkins/', { params: { coach: coachId, page_size: 20 } });
      setRows(toRows(data));
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  useEffect(() => { load(); }, [coachId]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!session) { setMsg('Pick a session first.'); return; }
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/coaches/checkins/', { coach: coachId, session: Number(session), status, ...(notes.trim() ? { notes: notes.trim() } : {}) });
      setOk('Trainer check-in recorded.');
      setSession(''); setNotes(''); load();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <div className="jetz-panel-title" style={{ marginBottom: 6 }}>Trainer attendance — manual entry</div>
      {msg && <Toast msg={msg} kind="danger" />}
      {ok && <Toast msg={ok} kind="success" />}
      <form onSubmit={save} className="jetz-card" style={{ marginBottom: 12 }}>
        <div className="jetz-form-card" style={{ marginBottom: 0 }}>
          <label><span className="jetz-label">Session *</span>
            <Select value={session} onChange={(e) => setSession(e.target.value)} required style={{ minWidth: 240 }}>
              <option value="">— pick session —</option>
              {sessions.map((s: any) => <option key={s.id} value={s.id}>#{s.id} · {s.batch_name || ''} · {s.date} · {s.status}</option>)}
            </Select>
          </label>
          <label><span className="jetz-label">Status</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="present">present</option>
              <option value="late">late</option>
            </Select>
          </label>
            <Field label="Notes" placeholder="optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Can code="coaches.edit"><Button type="submit" variant="accent" disabled={busy}>{busy ? 'Saving…' : 'Record check-in'}</Button></Can>
        </div>
      </form>
      <DataTable
        columns={['Session', 'Date', 'Status', 'Marked at']}
        rows={rows.map((c: any) => [`#${c.session}`, c.session_date || '-', c.status, (c.marked_at || '').slice(0, 16).replace('T', ' ')])}
        empty="No check-ins recorded for this trainer."
      />
    </div>
  );
}

/* ================= TRAINER ATTENDANCE ================= */

const CHECKIN_STATUSES = ['present', 'late', 'absent', 'leave'] as const;

export function TrainerAttendance() {
  const { can, isSuper } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [coach, setCoach] = useState('');
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState('');
  const [actErr, setActErr] = useState('');
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const coaches = useOptions('/coaches/?page_size=200');
  const { rows, count, err, page, setPage, loading, reload } = usePaged('/coaches/checkins/', {
    ...(from ? { date_from: from } : {}),
    ...(to ? { date_to: to } : {}),
    ...(coach ? { coach } : {}),
    ...(status ? { status } : {}),
  });
  const corrections = usePaged('/coaches/corrections/', {}, 50);
  const filtered = !!(from || to || coach || status);

  const decide = async (id: number, action: 'approve' | 'reject', note = '') => {
    setActErr('');
    setMsg('');
    try {
      await api.post(`/coaches/corrections/${id}/${action}/`, action === 'reject' ? { note } : {});
      setMsg(`Correction ${action === 'approve' ? 'approved' : 'rejected'}.`);
      setRejectFor(null);
      setRejectNote('');
      corrections.reload();
      reload();
    } catch (e: any) {
      setActErr(errMsg(e));
    }
  };

  const checkinsTab = (
    <div>
      <Toolbar>
        <Field label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Field label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <label><span className="jetz-label">Trainer</span>
          <Select value={coach} onChange={(e) => setCoach(e.target.value)} style={{ minWidth: 220 }}>
            <option value="">— all trainers —</option>
            {coaches.map((c: any) => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name || ''} · {c.trainer_id}</option>
            ))}
          </Select>
        </label>
        <label><span className="jetz-label">Status</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">— any —</option>
            {CHECKIN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </label>
        {filtered && (
          <Button variant="secondary" onClick={() => { setFrom(''); setTo(''); setCoach(''); setStatus(''); }}>Clear filters</Button>
        )}
      </Toolbar>
      <DataTable
        columns={['Trainer', 'Trainer ID', 'Session', 'Batch', 'Date', 'Status', 'Correction', 'Marked at', 'Notes']}
        rows={rows.map((c: any) => [
          c.coach_name || c.coach,
          c.trainer_id || '—',
          `#${c.session}`,
          c.batch_name || '—',
          c.session_date || '—',
          <span key={'s' + c.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <StatusBadge value={c.status} />
            {c.auto_marked && (
              <span title="Recorded automatically — attendance not marked before the deadline"
                style={{ fontSize: 10, fontWeight: 800, color: '#b91c1c', border: '1px solid #fca5a5', background: '#fef2f2', borderRadius: 6, padding: '1px 5px', letterSpacing: 0.4 }}>
                AUTO
              </span>
            )}
          </span>,
          c.correction_status
            ? <StatusBadge key={'c' + c.id} value={c.correction_status} />
            : '—',
          c.marked_at ? new Date(c.marked_at).toLocaleString() : '—',
          c.notes || '—',
        ])}
        empty={loading ? 'Loading…' : 'No trainer check-ins match these filters.'}
      />
      <Pager page={page} count={count} setPage={setPage} />
    </div>
  );

  const correctionsTab = (
    <div>
      <DataTable
        columns={['Trainer', 'Batch', 'Date', 'Requested', 'Original', 'Reason', 'Status', 'Reviewed', 'Actions']}
        rows={corrections.rows.map((c: any) => [
          c.coach_name || c.coach,
          c.batch_name || '—',
          c.session_date || '—',
          <StatusBadge key={'r' + c.id} value={c.requested_status} />,
          <StatusBadge key={'o' + c.id} value={c.original_status} />,
          <span key={'why' + c.id} title={c.reason} style={{ display: 'inline-block', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{c.reason || '—'}</span>,
          <StatusBadge key={'st' + c.id} value={c.status} />,
          c.reviewed_at ? new Date(c.reviewed_at).toLocaleString() : '—',
          c.status === 'pending' ? (
            <span key={'ac' + c.id} style={{ display: 'inline-flex', gap: 6 }}>
              {rejectFor === c.id ? (
                <>
                  <input className="jetz-input" placeholder="Reason for rejection" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} style={{ minWidth: 160 }} />
                  <Button size="sm" variant="danger" onClick={() => decide(c.id, 'reject', rejectNote.trim())}>Confirm</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setRejectFor(null); setRejectNote(''); }}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={() => decide(c.id, 'approve')}>Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setRejectFor(c.id); setRejectNote(''); }}>Reject</Button>
                </>
              )}
            </span>
          ) : (c.review_note || '—'),
        ])}
        empty={corrections.loading ? 'Loading…' : 'No correction requests.'}
      />
      <Pager page={corrections.page} count={corrections.count} setPage={corrections.setPage} />
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="JETZ Academy / Academy / Trainer Attendance"
        title="Trainer Attendance"
        sub="Every trainer check-in — one row per session. Missed sessions are auto-marked Absent; trainers can request a correction."
      />
      {err && <Toast msg={err} kind="danger" />}
      {corrections.err && <Toast msg={corrections.err} kind="danger" />}
      {actErr && <Toast msg={actErr} kind="danger" />}
      {msg && <Toast msg={msg} kind="success" />}
      <Tabs
        tabs={[
          { id: 'checkins', label: `Check-ins (${count})`, content: checkinsTab },
          { id: 'corrections', label: `Correction requests (${corrections.count})`, content: correctionsTab },
          ...((can('settings.edit') || isSuper()) ? [{ id: 'config', label: 'Automation settings', content: <TrainerAttendanceConfig /> }] : []),
        ]}
      />
    </div>
  );
}

function TrainerAttendanceConfig() {
  const { isSuper, can } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const readOnly = !(isSuper() || can('settings.edit'));

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const { data } = await api.get('/coaches/attendance-config/');
      setRows((data.settings || []).map((r: any) => ({ ...r, draft: r.value })));
    } catch (e: any) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const setDraft = (key: string, value: any) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, draft: value } : r)));

  const save = async () => {
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const settings: Record<string, any> = {};
      rows.forEach((r) => {
        let v = r.draft;
        if (r.type === 'bool') v = !!v;
        else if (r.type === 'int') v = parseInt(v, 10) || 0;
        else if (r.type === 'list') v = String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
        settings[r.key] = v;
      });
      const { data } = await api.put('/coaches/attendance-config/', { settings });
      setRows((data.settings || []).map((r: any) => ({ ...r, draft: r.value })));
      setMsg('Automation settings saved.');
    } catch (e: any) {
      setErr(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonGrid />;

  return (
    <Section title="Missed-attendance automation" sub="Controls how the system marks a trainer Absent when they miss the attendance deadline, and who is notified.">
      {err && <Toast msg={err} kind="danger" />}
      {msg && <Toast msg={msg} kind="success" />}
      {rows.map((r) => (
        <div key={r.key} style={{ marginBottom: 14 }}>
          <span className="jetz-label">{r.label}</span>
          {r.type === 'bool' ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input type="checkbox" checked={!!r.draft} disabled={readOnly}
                onChange={(e) => setDraft(r.key, e.target.checked)} />
              <span style={{ color: 'var(--jetz-muted)' }}>{r.draft ? 'On' : 'Off'} · default {r.default ? 'On' : 'Off'}</span>
            </label>
          ) : (
            <input
              className="jetz-input"
              type={r.type === 'int' ? 'number' : 'text'}
              value={Array.isArray(r.draft) ? r.draft.join(', ') : (r.draft ?? '')}
              disabled={readOnly}
              onChange={(e) => setDraft(r.key, e.target.value)}
              style={{ maxWidth: 320 }}
            />
          )}
          <p className="jetz-note" style={{ marginTop: 2 }}>{r.description}</p>
        </div>
      ))}
      {!readOnly && (
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
      )}
    </Section>
  );
}

/* ================= TRAINER FEES ================= */

export function TrainerFees() {
  const [trainer, setTrainer] = useState('');
  const [payStatus, setPayStatus] = useState('');
  const { rows, count, err, page, setPage, reload } = usePaged('/trainer-fees/payables/', { ...(trainer ? { trainer } : {}), ...(payStatus ? { status: payStatus } : {}) });
  const coaches = useOptions('/coaches/');
  const sports = useOptions('/sports/sports/');
  const batches = useOptions('/batches/');
  const sessionTypes = useOptions('/sports/session-types/');
  const [rules, setRules] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [ruleForm, setRuleForm] = useState({ trainer: '', sport: '', batch: '', session_type: '', payment_model: 'per_session', rate_per_session: '', fixed_amount: '', effective_from: todayISO(), effective_to: '' });
  const emptyConfigForm = { trainer: '', method: 'session_based', sport: '', effective_from: todayISO(), effective_to: '', student_mode: 'banded', student_rate: '', above_top_band: 'cap', notes: '', bands: [{ min_students: '1', max_students: '25', amount: '5000' }, { min_students: '26', max_students: '50', amount: '10000' }] };
  const [configForm, setConfigForm] = useState<any>(emptyConfigForm);
  const [genForm, setGenForm] = useState({ from_date: '', to_date: '' });
  const [payForm, setPayForm] = useState({ trainer: '', amount: '', paid_on: todayISO(), reference: '', notes: '', method: 'upi' });
  const [settleFrom, setSettleFrom] = useState('');
  const [settleTo, setSettleTo] = useState('');
  const [settle, setSettle] = useState<any>(null);
  const [settleBusy, setSettleBusy] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [adjForm, setAdjForm] = useState({ trainer: '', amount: '', reason: '' });
  const [workPeriod, setWorkPeriod] = useState<'week' | 'month'>('week');
  const [work, setWork] = useState<any>(null);
  const [workTable, setWorkTable] = useState<any[]>([]);

  const loadAll = async () => {
    setMsg('');
    try {
      const [r, p, a, s, cfg] = await Promise.all([
        api.get('/trainer-fees/rules/', { params: { page_size: 100 } }),
        api.get('/trainer-fees/payments/', { params: { ...(trainer ? { trainer } : {}), page_size: 20 } }),
        api.get('/trainer-fees/adjustments/', { params: { ...(trainer ? { trainer } : {}), page_size: 20 } }),
        api.get('/trainer-fees/payables/summary/', { params: { ...(trainer ? { trainer } : {}) } }),
        api.get('/trainer-fees/configs/', { params: { ...(trainer ? { trainer } : {}), page_size: 100 } }),
      ]);
      setRules(toRows(r.data)); setPayments(toRows(p.data)); setAdjustments(toRows(a.data)); setSummary(s.data); setConfigs(toRows(cfg.data));
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  useEffect(() => { loadAll(); }, [trainer]);
  const refreshAll = () => { loadAll(); loadWork(); reload(); };
  const loadWork = async () => {
    try {
      if (trainer) {
        const { data } = await api.get('/trainer-fees/payables/earnings/', { params: { trainer, period: workPeriod } });
        setWork(data); setWorkTable([]);
      } else {
        setWork(null);
        const list = await Promise.all(coaches.map(async (c: any) => {
          try {
            const { data } = await api.get('/trainer-fees/payables/earnings/', { params: { trainer: c.id, period: workPeriod } });
            return { coach: c, ...data };
          } catch { return { coach: c, sessions_taken: 0, payable_amount: 0, paid_amount: 0 }; }
        }));
        setWorkTable(list);
      }
    } catch { /* overview toasts cover failures */ }
  };
  useEffect(() => { if (coaches.length) loadWork(); }, [trainer, workPeriod, coaches.length]);

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (ruleForm.payment_model === 'per_session' && !ruleForm.rate_per_session) { setMsg('Rate per session is required for the per-session model.'); return; }
    if (ruleForm.payment_model !== 'per_session' && !ruleForm.fixed_amount) { setMsg('Fixed amount is required for weekly/monthly salary.'); return; }
    const payload: any = { trainer: Number(ruleForm.trainer), payment_model: ruleForm.payment_model, rate_per_session: ruleForm.rate_per_session || 0, fixed_amount: ruleForm.fixed_amount || 0, effective_from: ruleForm.effective_from, is_active: true };
    if (ruleForm.sport) payload.sport = Number(ruleForm.sport);
    if (ruleForm.batch) payload.batch = Number(ruleForm.batch);
    if (ruleForm.session_type) payload.session_type = Number(ruleForm.session_type);
    if (ruleForm.effective_to) payload.effective_to = ruleForm.effective_to;
    try {
      await api.post('/trainer-fees/rules/', payload);
      setRuleForm({ trainer: '', sport: '', batch: '', session_type: '', payment_model: 'per_session', rate_per_session: '', fixed_amount: '', effective_from: todayISO(), effective_to: '' });
      setOk('Fee rule saved. New completed sessions for this trainer now earn at this rate.'); refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const toggleRule = async (r: any) => {
    try { await api.patch(`/trainer-fees/rules/${r.id}/`, { is_active: !r.is_active }); refreshAll(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };
  const createConfig = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!configForm.trainer) { setMsg('Pick a trainer for the salary method.'); return; }
    const payload: any = { trainer: Number(configForm.trainer), method: configForm.method, effective_from: configForm.effective_from, is_active: true, notes: configForm.notes };
    if (configForm.effective_to) payload.effective_to = configForm.effective_to;
    if (configForm.sport) payload.sport = Number(configForm.sport);
    if (configForm.method === 'student_based') {
      payload.student_mode = configForm.student_mode;
      payload.above_top_band = configForm.above_top_band;
      payload.student_rate = configForm.student_rate || 0;
      if (configForm.student_mode === 'banded') {
        payload.bands = configForm.bands
          .filter((b: any) => b.min_students !== '')
          .map((b: any) => ({ min_students: Number(b.min_students), max_students: b.max_students === '' ? null : Number(b.max_students), amount: b.amount || 0 }));
      }
    }
    try {
      await api.post('/trainer-fees/configs/', payload);
      setConfigForm({ ...emptyConfigForm });
      setOk('Salary method saved for this trainer. Generate payables to snapshot the period.');
      refreshAll();
    } catch (err: any) { setMsg(errMsg(err)); }
  };
  const endConfig = async (c: any) => {
    const to = window.prompt('Close this salary method on which date? (YYYY-MM-DD)', todayISO());
    if (!to) return;
    try { await api.patch(`/trainer-fees/configs/${c.id}/`, { effective_to: to }); refreshAll(); }
    catch (err: any) { setMsg(errMsg(err)); }
  };
  const setBand = (i: number, field: string, value: string) => {
    const bands = configForm.bands.map((b: any, idx: number) => idx === i ? { ...b, [field]: value } : b);
    setConfigForm({ ...configForm, bands });
  };
  const addBand = () => setConfigForm({ ...configForm, bands: [...configForm.bands, { min_students: '', max_students: '', amount: '' }] });
  const removeBand = (i: number) => setConfigForm({ ...configForm, bands: configForm.bands.filter((_: any, idx: number) => idx !== i) });
  const gen = async () => {
    setMsg(''); setOk('');
    try {
      const { data } = await api.post('/trainer-fees/payables/generate/', { ...(trainer ? { trainer: Number(trainer) } : {}), ...(genForm.from_date ? { from_date: genForm.from_date } : {}), ...(genForm.to_date ? { to_date: genForm.to_date } : {}) });
      const skipped = (data.skipped_no_rule || []).length;
      setOk(`${data.generated ?? 0} payable(s) generated.` + (skipped ? ` ${skipped} completed session(s) have no matching active rule — add a rule covering their batch/sport, then generate again.` : ''));
      refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const verify = async (id: number) => {
    try { await api.post(`/trainer-fees/payables/${id}/verify/`); refreshAll(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };
  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!payForm.trainer || !payForm.amount || !payForm.paid_on || !payForm.reference.trim()) { setMsg('Trainer, amount, date and a unique reference are required.'); return; }
    try {
      const { data } = await api.post('/trainer-fees/payments/', { trainer: Number(payForm.trainer), amount: payForm.amount, paid_on: payForm.paid_on, reference: payForm.reference.trim(), method: payForm.method, notes: payForm.notes });
      setPayForm({ trainer: '', amount: '', paid_on: todayISO(), reference: '', notes: '', method: 'upi' });
      setOk('Payment recorded. Oldest verified payables were marked paid first.');
      setReceipt(data);
      refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const runSettle = async () => {
    if (!trainer) { setMsg('Pick a trainer above to preview their settlement.'); return; }
    if (!settleFrom || !settleTo) { setMsg('Pick both start and end dates for the settlement preview.'); return; }
    if (settleFrom > settleTo) { setMsg('Start date must be on or before the end date.'); return; }
    setSettleBusy(true); setMsg('');
    try {
      const { data } = await api.get('/trainer-fees/payables/earnings/', { params: { trainer, from: settleFrom, to: settleTo } });
      setSettle(data);
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setSettleBusy(false); }
  };
  const recordAdj = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!adjForm.trainer || !adjForm.amount || !adjForm.reason.trim()) { setMsg('Trainer, amount and a reason are required for adjustments.'); return; }
    try {
      await api.post('/trainer-fees/adjustments/', { trainer: Number(adjForm.trainer), amount: adjForm.amount, reason: adjForm.reason.trim() });
      setAdjForm({ trainer: '', amount: '', reason: '' });
      setOk('Adjustment recorded with reason and audit trail.'); refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
  };

  const coachName = (id: any) => coaches.find((c: any) => String(c.id) === String(id))?.first_name || id || '-';
  const activeRules = rules.filter((r: any) => r.is_active);
  const byStatus = Object.fromEntries((summary?.by_status || []).map((b: any) => [b.status, Number(b.total)]));

  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Finance / Trainer Fees" title="Trainer Fees" sub="Rules → generate → verify → pay · cancelled sessions never pay" actions={<span style={{ display: 'flex', gap: 8 }}><Button size="sm" variant="secondary" onClick={refreshAll}>Refresh</Button><Button size="sm" variant="accent" onClick={gen}>Generate payables</Button></span>} />
      <Toast msg={err || msg} kind={(err || msg) ? 'danger' : 'warning'} />
      {ok && <Toast msg={ok} kind="success" />}

      <Section title="Overview" sub={trainer ? `Filtered to ${coachName(trainer)}` : 'All trainers'}>
        <div className="jetz-stat-grid">
          <StatCard label="Payable (pending + verified)" value={`₹${Number(summary?.payable || 0).toLocaleString('en-IN')}`} icon={<Hourglass />} accent />
          <StatCard label="Paid to date" value={`₹${Number(summary?.paid || 0).toLocaleString('en-IN')}`} icon={<UserCheck />} />
          <StatCard label="Pending verification" value={`₹${Number(byStatus.pending || 0).toLocaleString('en-IN')}`} icon={<UsersIcon />} />
          <StatCard label="Active rules" value={activeRules.length} icon={<Plus />} />
        </div>
        <div className="jetz-stat-grid" style={{ marginTop: 12 }}>
          <StatCard label="Trainers with payables" value={summary?.trainers ?? 0} sub="In current filter" icon={<UsersIcon />} />
          <StatCard label="Completed sessions" value={summary?.completed_sessions ?? 0} sub="Eligible source records" icon={<Hourglass />} />
          <StatCard label="Awaiting verification" value={summary?.pending_count ?? 0} sub="Payables still pending" icon={<UserCheck />} />
          <StatCard label="Balance outstanding" value={`₹${Number(summary?.balance ?? summary?.payable ?? 0).toLocaleString('en-IN')}`} sub="Payable minus paid" icon={<Plus />} accent />
        </div>
        <Toolbar>
          <label><span className="jetz-label">Trainer filter</span>
            <Select value={trainer} onChange={(e) => setTrainer(e.target.value)}>
              <option value="">All trainers</option>
              {coaches.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name || ''} ({c.trainer_id})</option>)}
            </Select>
          </label>
          <label><span className="jetz-label">Payable status</span>
            <Select value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['pending', 'verified', 'paid', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </label>
          {(trainer || payStatus) && <Button variant="secondary" onClick={() => { setTrainer(''); setPayStatus(''); }}>Clear</Button>}
        </Toolbar>
      </Section>

      <Section title="Work summary" sub="Sessions taken feed salary · same numbers the trainer sees in their app">
        <div className="jetz-form-card" style={{ marginBottom: 12 }}>
          <label><span className="jetz-label">Period</span>
            <Select value={workPeriod} onChange={(e) => setWorkPeriod(e.target.value as 'week' | 'month')}>
              <option value="week">This week (Mon–Sun)</option>
              <option value="month">This month</option>
            </Select>
          </label>
          {work && <span className="jetz-panel-sub" style={{ alignSelf: 'center' }}>{work.from} → {work.to}</span>}
        </div>
        {trainer && work ? (
          <div className="jetz-stat-grid">
            <StatCard label="Sessions taken" value={work.sessions_taken} icon={<Hourglass />} accent />
            <StatCard label={`Earned (${workPeriod})`} value={`₹${Number((work.payable_amount || 0) + (work.paid_amount || 0)).toLocaleString('en-IN')}`} icon={<UserCheck />} />
            <StatCard label={`Paid out (${workPeriod})`} value={`₹${Number(work.paid_amount || 0).toLocaleString('en-IN')}`} icon={<UsersIcon />} />
          </div>
        ) : (
          <DataTable
            columns={['Trainer', 'Sessions taken', 'Earned', 'Paid out', 'Needs attention']}
            rows={workTable.map((w: any) => {
              const unm = w.sessions_without_payable ?? 0;
              return [
                `${w.coach.first_name} ${w.coach.last_name || ''} (${w.coach.trainer_id})`,
                w.sessions_taken ?? 0,
                `₹${Number((w.payable_amount || 0) + (w.paid_amount || 0)).toLocaleString('en-IN')}`,
                `₹${Number(w.paid_amount || 0).toLocaleString('en-IN')}`,
                unm > 0 ? <span key={'u' + w.coach.id} style={{ color: 'var(--jetz-danger, #b91c1c)', fontWeight: 600 }}>{unm} session(s) with no payable — check rule scope, then Generate</span> : <span key={'u' + w.coach.id} style={{ color: 'var(--jetz-muted)' }}>—</span>,
              ];
            })}
            empty="No trainers found."
          />
        )}
        {trainer && work && (work.sessions_without_payable ?? 0) > 0 && (
          <p className="jetz-note" style={{ margin: '8px 0 0', color: 'var(--jetz-danger, #b91c1c)', fontWeight: 600 }}>
            {work.sessions_without_payable} completed session(s) produced no payable — the active rules don't cover their batch/sport, or Generate hasn't been run. Fix the rule scope, then Generate.
          </p>
        )}
      </Section>

      <Section title="Settlement preview" sub="Any date range · backend-calculated gross, paid and balance for one trainer">
        <div className="jetz-card" style={{ marginBottom: 0 }}>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <Field label="Start date" type="date" value={settleFrom} onChange={(e) => setSettleFrom(e.target.value)} />
            <Field label="End date" type="date" value={settleTo} onChange={(e) => setSettleTo(e.target.value)} />
            <Button variant="accent" onClick={runSettle} disabled={settleBusy || !trainer}>{settleBusy ? 'Calculating…' : 'Preview settlement'}</Button>
          </div>
          {!trainer && <p className="jetz-note" style={{ margin: '8px 0 0' }}>Pick a trainer in the Overview filter first.</p>}
          {settle && (
            <div style={{ marginTop: 12 }}>
              <div className="jetz-stat-grid">
                <StatCard label="Eligible sessions" value={settle.payable_count ?? 0} sub={`${settle.from} → ${settle.to}`} icon={<Hourglass />} accent />
                <StatCard label="Gross payable" value={`₹${Number(settle.payable_amount || 0).toLocaleString('en-IN')}`} sub={`${settle.sessions_taken ?? 0} sessions taken`} icon={<UserCheck />} />
                <StatCard label="Paid" value={`₹${Number(settle.paid_amount || 0).toLocaleString('en-IN')}`} sub="Allocated payments" icon={<UsersIcon />} />
                <StatCard label="Balance" value={`₹${Number(settle.balance ?? 0).toLocaleString('en-IN')}`} sub={Number(settle.balance ?? 0) === 0 && (settle.payable_amount || 0) > 0 ? 'Fully paid' : 'Outstanding'} icon={<Plus />} />
              </div>
              {(settle.by_day || []).length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <DataTable
                    columns={['Date', 'Sessions', 'Amount']}
                    rows={settle.by_day.map((d: any) => [d.date, d.sessions, `₹${Number(d.amount || 0).toLocaleString('en-IN')}`])}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      <Section title="Payables" sub={`${count} records · Verify = approve for payment · only verified payables can be paid`}>
        <DataTable
          columns={['Trainer', 'For', 'Amount', 'Status', 'Action']}
          rows={rows.map((t: any) => [
            t.trainer_name || coachName(t.trainer),
            t.session_date || (t.period_start ? `${t.period_start} → ${t.period_end || '…'}` : '-'),
            `₹${t.amount}${t.kind && t.kind !== 'session' ? ` (${t.kind.replace('_salary', '')})` : ''}`,
            <StatusBadge key={t.id} value={t.status} />,
            t.status === 'pending' ? <Can code="trainer_fees.verify"><Button key={'v' + t.id} size="sm" onClick={() => verify(t.id)}>Verify</Button></Can> : '-',
          ])}
          empty="No payables. Set a rule, complete sessions, then Generate."
        />
        <Pager page={page} count={count} setPage={setPage} />
        <div className="jetz-card" style={{ marginTop: 12 }}>
          <div className="jetz-panel-title">Generate from completed sessions</div>
          <div className="jetz-form-card" style={{ marginBottom: 0, marginTop: 8 }}>
            <Field label="From" type="date" value={genForm.from_date} onChange={(e) => setGenForm({ ...genForm, from_date: e.target.value })} />
            <Field label="To" type="date" value={genForm.to_date} onChange={(e) => setGenForm({ ...genForm, to_date: e.target.value })} />
            <Can code="trainer_fees.generate"><Button variant="accent" onClick={gen}>Generate{trainer ? ` for ${coachName(trainer)}` : ''}</Button></Can>
          </div>
          <p className="jetz-note" style={{ margin: '8px 0 0' }}>Only completed sessions with a matching active rule produce payables. Re-running is safe (one payable per session).</p>
        </div>
      </Section>

      <Section title="Salary Rules & Configuration" sub="Choose one salary method per trainer · session-based, student-based, or a fixed weekly/monthly salary · method changes need a new effective date">
        <form onSubmit={createConfig} className="jetz-card" style={{ marginBottom: 12 }}>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <label><span className="jetz-label">Trainer *</span><Select value={configForm.trainer} onChange={(e) => setConfigForm({ ...configForm, trainer: e.target.value })} required><option value="">—</option>{coaches.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} ({c.trainer_id})</option>)}</Select></label>
            <label><span className="jetz-label">Salary method *</span><Select value={configForm.method} onChange={(e) => setConfigForm({ ...configForm, method: e.target.value })}><option value="session_based">Session-based (per session)</option><option value="student_based">Student-based (per student / bands)</option><option value="weekly">Fixed weekly salary</option><option value="monthly">Fixed monthly salary</option></Select></label>
            <Field label="Effective from *" type="date" value={configForm.effective_from} onChange={(e) => setConfigForm({ ...configForm, effective_from: e.target.value })} required />
            <Field label="Effective to (blank = open)" type="date" value={configForm.effective_to} onChange={(e) => setConfigForm({ ...configForm, effective_to: e.target.value })} />
            <label><span className="jetz-label">Sport (student-based, optional)</span><Select value={configForm.sport} onChange={(e) => setConfigForm({ ...configForm, sport: e.target.value })}><option value="">All sports</option>{sports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
          </div>
          {configForm.method === 'student_based' && (
            <div style={{ marginTop: 12 }}>
              <div className="jetz-form-card" style={{ marginBottom: 0 }}>
                <label><span className="jetz-label">Student pricing *</span><Select value={configForm.student_mode} onChange={(e) => setConfigForm({ ...configForm, student_mode: e.target.value })}><option value="banded">Student-count bands</option><option value="per_student">Flat per-student rate</option></Select></label>
                {configForm.student_mode === 'per_student' && (
                  <Field label="Rate per student (₹) *" placeholder="500" value={configForm.student_rate} onChange={(e) => setConfigForm({ ...configForm, student_rate: e.target.value })} />
                )}
                <label><span className="jetz-label">Above highest band</span><Select value={configForm.above_top_band} onChange={(e) => setConfigForm({ ...configForm, above_top_band: e.target.value })}><option value="cap">Cap at top band</option><option value="per_student">Charge per-student rate</option><option value="reject">Reject generation</option></Select></label>
                {configForm.above_top_band !== 'cap' && (
                  <Field label="Per-student fallback rate (₹)" placeholder="200" value={configForm.student_rate} onChange={(e) => setConfigForm({ ...configForm, student_rate: e.target.value })} />
                )}
              </div>
              {configForm.student_mode === 'banded' && (
                <div style={{ marginTop: 12 }}>
                  <div className="jetz-panel-title">Student-count bands</div>
                  <DataTable
                    columns={['Min students', 'Max students (blank = no cap)', 'Amount (₹)', '']}
                    rows={configForm.bands.map((b: any, i: number) => [
                      <input key={'mn' + i} className="jetz-input" value={b.min_students} onChange={(e) => setBand(i, 'min_students', e.target.value)} />,
                      <input key={'mx' + i} className="jetz-input" value={b.max_students} onChange={(e) => setBand(i, 'max_students', e.target.value)} />,
                      <input key={'am' + i} className="jetz-input" value={b.amount} onChange={(e) => setBand(i, 'amount', e.target.value)} />,
                      configForm.bands.length > 1 ? <Button key={'rm' + i} size="sm" variant="ghost" onClick={() => removeBand(i)}>Remove</Button> : '',
                    ])}
                    empty="No bands yet."
                  />
                  <div style={{ marginTop: 8 }}><Button size="sm" variant="secondary" onClick={addBand}>Add band</Button></div>
                  <p className="jetz-note" style={{ margin: '8px 0 0' }}>Bands must not overlap. Example: 1–25 → ₹5,000, 26–50 → ₹10,000.</p>
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Can code="trainer_fees.manage"><Button type="submit" variant="accent">Save salary method</Button></Can>
          </div>
        </form>
        <DataTable
          columns={['Trainer', 'Method', 'Scope', 'Student rule', 'Effective', 'Active', 'Action']}
          rows={configs.map((c: any) => {
            const methodLabel = c.method_label || ({ session_based: 'Session-based', student_based: 'Student-based', weekly: 'Fixed weekly', monthly: 'Fixed monthly' } as any)[c.method] || c.method;
            const studentRule = c.method === 'student_based'
              ? (c.student_mode === 'per_student' ? `₹${c.student_rate} / student` : `bands (${(c.bands || []).length}) · above: ${c.above_top_band}`)
              : '—';
            return [
              coachName(c.trainer),
              methodLabel,
              c.sport ? (sports.find((s: any) => String(s.id) === String(c.sport))?.name || `sport#${c.sport}`) : 'All sports',
              studentRule,
              `${c.effective_from || '-'} → ${c.effective_to || '…'}`,
              <StatusBadge key={'st' + c.id} value={c.is_active ? 'active' : 'inactive'} />,
              c.is_active ? <Can key={'e' + c.id} code="trainer_fees.manage"><Button size="sm" variant="secondary" onClick={() => endConfig(c)}>Close method</Button></Can> : '-',
            ];
          })}
          empty="No salary method configured — set one so Generate can snapshot the period."
        />
      </Section>

      <Section title="Fee rules" sub="Rate per session · most specific match wins (batch + type > batch > sport + type > sport > trainer default)">
        <form onSubmit={createRule} className="jetz-card" style={{ marginBottom: 12 }}>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <label><span className="jetz-label">Trainer *</span><Select value={ruleForm.trainer} onChange={(e) => setRuleForm({ ...ruleForm, trainer: e.target.value })} required><option value="">—</option>{coaches.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} ({c.trainer_id})</option>)}</Select></label>
            <label><span className="jetz-label">Salary model *</span><Select value={ruleForm.payment_model} onChange={(e) => setRuleForm({ ...ruleForm, payment_model: e.target.value })}><option value="per_session">Per session</option><option value="weekly">Weekly salary</option><option value="monthly">Monthly salary</option></Select></label>
            {ruleForm.payment_model === 'per_session' ? (
              <Field label="Rate per session (₹) *" placeholder="500" value={ruleForm.rate_per_session} onChange={(e) => setRuleForm({ ...ruleForm, rate_per_session: e.target.value })} required />
            ) : (
              <Field label={`Fixed ${ruleForm.payment_model} amount (₹) *`} placeholder={ruleForm.payment_model === 'weekly' ? '3500' : '15000'} value={ruleForm.fixed_amount} onChange={(e) => setRuleForm({ ...ruleForm, fixed_amount: e.target.value })} required />
            )}
            <Field label="Effective from *" type="date" value={ruleForm.effective_from} onChange={(e) => setRuleForm({ ...ruleForm, effective_from: e.target.value })} required />
            <Field label="Effective to" type="date" value={ruleForm.effective_to} onChange={(e) => setRuleForm({ ...ruleForm, effective_to: e.target.value })} />
            <label><span className="jetz-label">Sport (optional)</span><Select value={ruleForm.sport} onChange={(e) => setRuleForm({ ...ruleForm, sport: e.target.value })}><option value="">Any</option>{sports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
            <label><span className="jetz-label">Batch (optional)</span><Select value={ruleForm.batch} onChange={(e) => setRuleForm({ ...ruleForm, batch: e.target.value })}><option value="">Any</option>{batches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
            <label><span className="jetz-label">Session type (optional)</span><Select value={ruleForm.session_type} onChange={(e) => setRuleForm({ ...ruleForm, session_type: e.target.value })}><option value="">Any</option>{sessionTypes.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
            <Can code="trainer_fees.manage"><Button type="submit" variant="accent">Save rule</Button></Can>
          </div>
        </form>
        <DataTable
          columns={['Trainer', 'Scope', 'Model', 'Rate / Salary', 'Effective', 'Active', 'Action']}
          rows={rules.map((r: any) => {
            const scopeParts = [
              r.batch ? (batches.find((b: any) => String(b.id) === String(r.batch))?.name || `batch#${r.batch}`) : null,
              r.sport ? (sports.find((s: any) => String(s.id) === String(r.sport))?.name || `sport#${r.sport}`) : null,
              r.session_type ? (sessionTypes.find((s: any) => String(s.id) === String(r.session_type))?.name || '') : null,
            ].filter(Boolean);
            const model = r.payment_model || 'per_session';
            return [
              coachName(r.trainer),
              <span key={'s' + r.id} title={scopeParts.join(' + ') || 'Applies to all sessions by this trainer'}>{scopeParts.join(' + ') || 'trainer default (all sessions)'}</span>,
              model === 'per_session' ? 'per session' : model,
              `₹${model === 'per_session' ? r.rate_per_session : r.fixed_amount}`,
              `${r.effective_from || '-'} → ${r.effective_to || '…'}`,
              <StatusBadge key={r.id} value={r.is_active ? 'active' : 'inactive'} />,
              <Can code="trainer_fees.manage"><Button key={'t' + r.id} size="sm" variant="secondary" onClick={() => toggleRule(r)}>{r.is_active ? 'Deactivate' : 'Activate'}</Button></Can>,
            ];
          })}
          empty="No rules configured — payables cannot generate until at least one rule exists."
        />
      </Section>

      <Section title="Pay trainer" sub="Records a payment · oldest verified payables flip to paid first">
        <form onSubmit={recordPayment} className="jetz-card" style={{ marginBottom: 12 }}>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <label><span className="jetz-label">Trainer *</span><Select value={payForm.trainer} onChange={(e) => setPayForm({ ...payForm, trainer: e.target.value })} required><option value="">—</option>{coaches.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} ({c.trainer_id})</option>)}</Select></label>
            <Field label="Amount (₹) *" placeholder="2000" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required />
            <Field label="Paid on *" type="date" value={payForm.paid_on} onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })} required />
            <Field label="Reference * (unique)" placeholder="UPI / txn id" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} required />
            <label><span className="jetz-label">Method</span><Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}><option value="upi">upi</option><option value="cash">cash</option><option value="bank_transfer">bank_transfer</option><option value="other">other</option></Select></label>
            <Field label="Notes" placeholder="Optional" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            <Can code="trainer_fees.pay"><Button type="submit" variant="accent">Record payment</Button></Can>
          </div>
        </form>
        <DataTable
          columns={['Trainer', 'Amount', 'Method', 'Reference', 'Paid on']}
          rows={payments.map((p: any) => [coachName(p.trainer), `₹${p.amount}`, p.method || '-', p.reference, p.paid_on])}
          empty="No payments recorded."
        />
        {receipt && (
          <div className="jetz-card" style={{ marginTop: 12, borderLeft: '4px solid var(--jetz-success, #16a34a)' }}>
            <div className="jetz-panel-title">Settlement receipt — {receipt.reference}</div>
            <div className="jetz-panel-sub">
              {coachName(receipt.trainer)} · ₹{receipt.amount} via {receipt.method || '—'} on {receipt.paid_on} ·
              outstanding balance after this payment: ₹{Number(summary?.balance ?? 0).toLocaleString('en-IN')}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Button size="sm" variant="secondary" onClick={() => window.print()}>Print receipt</Button>
              <Button size="sm" variant="ghost" onClick={() => setReceipt(null)}>Dismiss</Button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Adjustments" sub="Reason is mandatory · every adjustment is audit-logged">
        <form onSubmit={recordAdj} className="jetz-card" style={{ marginBottom: 12 }}>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <label><span className="jetz-label">Trainer *</span><Select value={adjForm.trainer} onChange={(e) => setAdjForm({ ...adjForm, trainer: e.target.value })} required><option value="">—</option>{coaches.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} ({c.trainer_id})</option>)}</Select></label>
            <Field label="Amount (₹, +/-) *" placeholder="-500 or 500" value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })} required />
            <Field label="Reason *" placeholder="Why this adjustment" value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} required />
            <Can code="trainer_fees.adjust"><Button type="submit" variant="accent">Record adjustment</Button></Can>
          </div>
        </form>
        <DataTable
          columns={['Trainer', 'Amount', 'Reason', 'When']}
          rows={adjustments.map((a: any) => [coachName(a.trainer), `₹${a.amount}`, (a.reason || '').slice(0, 80), (a.created_at || '').slice(0, 10)])}
          empty="No adjustments."
        />
      </Section>
    </div>
  );
}

/* ================= REPORTS ================= */

const REPORT_DEFS = [
  { id: 'students', label: 'Students', desc: 'Master register with sport, batch and status.' },
  { id: 'sessions', label: 'Sessions', desc: 'Scheduled sessions with batch, coach and status.' },
  { id: 'attendance', label: 'Attendance', desc: 'Marked records per session and student.' },
  { id: 'fees/collection', label: 'Fee collection', desc: 'Collected fees by period and student.' },
  { id: 'fees/pending-overdue', label: 'Pending & overdue', desc: 'Outstanding and overdue fee balances.' },
  { id: 'trainer-fees', label: 'Trainer fees', desc: 'Payables, verification and payout status.' },
  { id: 'payments', label: 'Payments', desc: 'Transactions with provider and verification state.' },
  { id: 'whatsapp', label: 'WhatsApp', desc: 'Outbound messages and delivery status.' },
  { id: 'audit', label: 'Audit log', desc: 'Who changed what, and when.' },
  { id: 'coach-allocation', label: 'Coach allocation', desc: 'Coach-to-batch and session assignments.' },
] as const;

const EXPORT_META: Record<string, { ext: string; mime: string; label: string }> = {
  csv: { ext: 'csv', mime: 'text/csv', label: 'CSV' },
  excel: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel' },
  pdf: { ext: 'pdf', mime: 'application/pdf', label: 'PDF' },
};

export function Reports() {
  const [name, setName] = useState<string>('sessions');
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [ranAt, setRanAt] = useState<Date | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const def = REPORT_DEFS.find((r) => r.id === name);

  const run = async () => {
    setMsg(''); setLoading(true);
    try {
      const { data } = await api.get(`/reports/${name}/`, { params: { format: 'json' } });
      setRows(Array.isArray(data?.results) ? data.results : []);
      setCount(typeof data?.count === 'number' ? data.count : (data?.results || []).length);
      setRanAt(new Date()); setHasRun(true);
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setLoading(false); }
  };

  const exportFile = async (format: 'csv' | 'excel' | 'pdf') => {
    if (exporting) return;
    setMsg(''); setExporting(format);
    try {
      const { data } = await api.get(`/reports/${name}/`, { params: { export: format }, responseType: 'blob' });
      const meta = EXPORT_META[format];
      const blob = new Blob([data], { type: meta.mime });
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name.replace('/', '-')}-${stamp}.${meta.ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setExporting(null); }
  };

  const cols = rows.length ? Object.keys(rows[0]) : [];
  const preview = rows.slice(0, 100);
  const cell = (r: any, k: string, i: number) => {
    const v = r[k];
    if (k === 'status' && typeof v === 'string') return <StatusBadge key={`${i}-${k}`} value={v} />;
    if (v === null || v === undefined || v === '') return <span key={`${i}-${k}`} style={{ color: 'var(--jetz-faint)' }}>—</span>;
    if (typeof v === 'boolean') return <span key={`${i}-${k}`}>{v ? 'Yes' : 'No'}</span>;
    return <span key={`${i}-${k}`}>{String(v)}</span>;
  };

  return (
    <div>
      <PageHeader
        eyebrow="JETZ Academy / Insights / Reports"
        title="Reports"
        count={hasRun ? count : undefined}
        sub="Live academy analytics, generated on demand · export CSV, Excel or PDF"
        actions={<Button size="sm" variant="secondary" onClick={run} disabled={loading}><RefreshCw style={{ width: 14, height: 14 }} /> {loading ? 'Running…' : 'Re-run'}</Button>}
      />
      <Toast msg={msg} kind="danger" />
      <div className="jetz-card" style={{ marginBottom: 14 }}>
        <div className="jetz-filterbar" style={{ marginBottom: 0 }}>
          <label className="jetz-field" style={{ display: 'block', minWidth: 220, flex: '2 1 220px' }}>
            <span className="jetz-label">Report</span>
            <Select
              value={name}
              onChange={(e) => { setName(e.target.value); setHasRun(false); setRows([]); setCount(0); setRanAt(null); }}
              style={{ width: '100%' }}
            >
              {REPORT_DEFS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </Select>
          </label>
          <Button variant="accent" onClick={run} disabled={loading}>
            <Play style={{ width: 14, height: 14 }} /> {loading ? 'Running…' : 'Run report'}
          </Button>
          {(Object.keys(EXPORT_META) as Array<'csv' | 'excel' | 'pdf'>).map((f) => (
            <Can key={f} code="reports.export"><Button
              variant="secondary"
              onClick={() => exportFile(f)}
              disabled={exporting !== null}
              title={`Download ${def?.label || 'report'} as ${EXPORT_META[f].label}`}
            >
              {f === 'csv' ? <FileText style={{ width: 14, height: 14 }} /> : f === 'excel' ? <FileSpreadsheet style={{ width: 14, height: 14 }} /> : <FileDown style={{ width: 14, height: 14 }} />}
              {exporting === f ? 'Exporting…' : EXPORT_META[f].label}
            </Button></Can>
          ))}
        </div>
        <p className="jetz-field-hint" style={{ marginBottom: 0 }}>{def?.desc} Numbers are queried live when you run.</p>
      </div>

      {!hasRun && !loading ? (
        <div className="jetz-card">
          <div className="jetz-state-wrap" style={{ paddingTop: 8 }}>
            <div className="jetz-state-icon"><FileText style={{ width: 22, height: 22 }} /></div>
            <div className="jetz-state-title">Pick a report and hit Run</div>
            <div className="jetz-state-sub">Results are generated live from the database — nothing is precomputed or cached.</div>
            <Button variant="accent" onClick={run}><Play style={{ width: 14, height: 14 }} /> Run {def?.label} report</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="jetz-stat-grid" style={{ marginBottom: 14 }}>
            <StatCard label="Report" value={def?.label || '—'} sub={def?.desc} icon={<FileText />} accent />
            <StatCard label="Rows returned" value={loading ? '…' : count} sub={rows.length > 100 ? 'Previewing first 100 — export for full data' : 'Full result shown below'} icon={<UsersIcon />} />
            <StatCard label="Generated" value={ranAt ? ranAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'} sub={ranAt ? ranAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Live on every run'} icon={<RefreshCw />} />
          </div>
          <ProTable
            columns={cols.map((c) => ({ key: c, label: c.replace(/_/g, ' ') }))}
            rows={preview.map((r, i) => cols.map((c) => cell(r, c, i)))}
            loading={loading}
            error=""
            emptyTitle={`No rows in ${def?.label} report`}
            emptySub="The query ran fine — there is simply no matching data right now."
          />
        </>
      )}
    </div>
  );
}

/* ================= WHATSAPP ================= */

const waTokens = (body: string): string[] => {
  const out: string[] = [];
  const re = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body || ''))) if (!out.includes(m[1])) out.push(m[1]);
  return out;
};

export function WhatsApp() {
  const [statusF, setStatusF] = useState('');
  const [q, setQ] = useState('');
  const { rows, count, err, page, setPage, reload } = usePaged('/whatsapp/messages/', { ...(statusF ? { status: statusF } : {}), ...(q ? { search: q } : {}) });
  const [templates, setTemplates] = useState<any[]>([]);
  const [live, setLive] = useState<any>(null);
  const [form, setForm] = useState({ to_number: '', template: '', body: '' });
  const [vars, setVars] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [tplForm, setTplForm] = useState({ id: 0, name: '', category: 'general', language: 'en', body: '', is_active: true });
  const [confirmDelTpl, setConfirmDelTpl] = useState<number | null>(null);
  const { values: cfg } = useAcademySettings();

  const loadAux = async () => {
    try {
      const [t, s] = await Promise.all([
        api.get('/whatsapp/templates/', { params: { page_size: 100 } }),
        api.get('/whatsapp/status/'),
      ]);
      setTemplates(toRows(t.data)); setLive(s.data);
    } catch { /* banner simply stays neutral */ }
  };
  useEffect(() => { loadAux(); }, []);
  useEffect(() => {
    const want = String(cfg['whatsapp.default_template'] || '').trim().toLowerCase();
    if (want && templates.length && !form.template) {
      const hit = templates.find((t: any) => String(t.name || '').toLowerCase() === want);
      if (hit) setForm((f) => (f.template ? f : { ...f, template: String(hit.id) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, cfg['whatsapp.default_template']]);

  const selTpl = templates.find((t: any) => String(t.id) === String(form.template));
  const tokens = selTpl ? waTokens(selTpl.body) : [];
  const preview = tokens.reduce((s: string, k: string) => s.split(`{{${k}}}`).join(vars[k] || `{{${k}}}`), selTpl?.body || form.body || '');

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!form.to_number.trim()) { setMsg('Recipient number is required.'); return; }
    if (form.template && tokens.some((k) => !String(vars[k] || '').trim())) { setMsg(`Fill every template variable (${tokens.join(', ')}).`); return; }
    try {
      const { data } = await api.post('/whatsapp/messages/', {
        to_number: form.to_number.trim(), template: form.template ? Number(form.template) : null,
        variables: form.template ? vars : {}, body: form.template ? undefined : form.body,
      });
      setForm({ to_number: '', template: '', body: '' }); setVars({});
      setOk(data.status === 'failed' ? `Recorded but delivery failed: ${data.failure_info || 'see row'}` : `Sent via ${data.provider} · status ${data.status}. Delivery updates arrive by webhook.`);
      reload();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const retry = async (id: number) => {
    setMsg(''); setOk('');
    try { await api.post(`/whatsapp/messages/${id}/retry/`); setOk('Retried.'); reload(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };
  const saveTpl = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!tplForm.name.trim() || !tplForm.body.trim()) { setMsg('Template name and body are required.'); return; }
    const payload = { name: tplForm.name.trim(), category: tplForm.category, language: tplForm.language || 'en', body: tplForm.body, is_active: tplForm.is_active };
    try {
      if (tplForm.id) await api.patch(`/whatsapp/templates/${tplForm.id}/`, payload);
      else await api.post('/whatsapp/templates/', payload);
      setTplForm({ id: 0, name: '', category: 'general', language: 'en', body: '', is_active: true });
      setOk('Template saved. For real delivery its name + language must exactly match a Meta-approved template.');
      loadAux();
    } catch (e: any) { setMsg(errMsg(e)); }
  };
  const delTpl = async (id: number) => {
    setConfirmDelTpl(null);
    try { await api.delete(`/whatsapp/templates/${id}/`); loadAux(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Insights / WhatsApp" title="WhatsApp" count={count} sub={`${count} messages · real-time delivery via provider + webhook`} actions={<Button size="sm" variant="secondary" onClick={() => { reload(); loadAux(); }}>Refresh</Button>} />
      <Toast msg={err || msg} kind={(err || msg) ? 'danger' : 'warning'} />
      {ok && <Toast msg={ok} kind="success" />}
      <div className="jetz-card" style={{ marginBottom: 14, borderLeft: `4px solid ${live?.live ? 'var(--jetz-success)' : '#d97706'}` }}>
        <div className="jetz-panel-title">
          {live ? (live.live ? `● LIVE via ${live.provider}` : `● ${live.provider === 'mock' ? 'MOCK — messages are recorded, not delivered' : `● ${live.provider} (not configured)`}`) : 'Checking provider…'}
        </div>
        <div className="jetz-panel-sub">
          {live ? `${live.active_templates ?? 0} active templates. Statuses (sent → delivered → read) arrive from the provider webhook in real time.` : 'Contacting backend…'}
        </div>
        {live && !live.live && (
          <div className="jetz-panel-sub" style={{ marginTop: 6 }}>
            To go live: set WHATSAPP_PROVIDER=meta_cloud with WHATSAPP_API_TOKEN + WHATSAPP_PHONE_NUMBER_ID, approve templates in WhatsApp Manager, and subscribe the webhook URL with WHATSAPP_VERIFY_TOKEN.
          </div>
        )}
      </div>

      <Section title="Send message" sub="Template sends deliver any time · plain text only works inside Meta's 24h service window">
        <form onSubmit={send} className="jetz-card" style={{ marginBottom: 0 }}>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <Field label="To number *" placeholder="9198…" value={form.to_number} onChange={(e) => setForm({ ...form, to_number: e.target.value })} required />
            <label><span className="jetz-label">Template</span>
              <Select value={form.template} onChange={(e) => { setForm({ ...form, template: e.target.value }); setVars({}); }}>
                <option value="">— plain text —</option>
                {templates.filter((t: any) => t.is_active).map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.language || 'en'} · {t.category})</option>)}
              </Select>
            </label>
            {!form.template && <Field label="Body" placeholder="Message text" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />}
            {tokens.map((k) => (
              <Field key={k} label={`{{${k}}} *`} placeholder={`Value for ${k}`} value={vars[k] || ''} onChange={(e) => setVars((v) => ({ ...v, [k]: e.target.value }))} required />
            ))}
            <Can code="whatsapp.send"><Button type="submit" variant="accent">Send</Button></Can>
          </div>
          {(form.template || preview) && (
            <div style={{ marginTop: 10, background: 'var(--jetz-bg, #f6f8fb)', borderRadius: 8, padding: 10 }}>
              <div className="jetz-panel-sub">Preview</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }}>{preview || '—'}</div>
            </div>
          )}
        </form>
      </Section>

      <Section title="Templates" sub="Names must exactly match Meta-approved templates for real delivery">
        <form onSubmit={saveTpl} className="jetz-card" style={{ marginBottom: 12 }}>
          <div className="jetz-form-card" style={{ marginBottom: 0 }}>
            <Field label="Name *" placeholder="fee_reminder" value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} required />
            <label><span className="jetz-label">Category</span>
              <Select value={tplForm.category} onChange={(e) => setTplForm({ ...tplForm, category: e.target.value })}>
                {['fee_reminder', 'payment_confirmation', 'session', 'general'].map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </label>
            <Field label="Language *" placeholder="en" value={tplForm.language} onChange={(e) => setTplForm({ ...tplForm, language: e.target.value })} required />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={tplForm.is_active} onChange={(e) => setTplForm({ ...tplForm, is_active: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--jetz-accent)' }} />
              <span className="jetz-label" style={{ margin: 0 }}>Active</span>
            </label>
          </div>
          <label style={{ display: 'block', marginTop: 8 }}><span className="jetz-label">Body * (use {'{{1}}'}, {'{{2}}'}… for Meta parameters)</span>
            <textarea className="jetz-input" rows={3} placeholder="Hi {{1}}, your fee of Rs.{{2}} is due on {{3}}." value={tplForm.body} onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })} required />
          </label>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <Can code="whatsapp.manage"><Button type="submit" variant="accent">{tplForm.id ? 'Save changes' : 'Add template'}</Button></Can>
            {!!tplForm.id && <Button type="button" variant="secondary" onClick={() => setTplForm({ id: 0, name: '', category: 'general', language: 'en', body: '', is_active: true })}>Cancel</Button>}
          </div>
        </form>
        <DataTable
          columns={['Name', 'Category', 'Lang', 'Body', 'Active', 'Actions']}
          rows={templates.map((t: any) => [
            t.name, t.category, t.language || 'en', String(t.body || '').slice(0, 70),
            <StatusBadge key={t.id} value={t.is_active ? 'active' : 'inactive'} />,
            <span key={'a' + t.id} style={{ display: 'flex', gap: 6 }}>
              <Can code="whatsapp.manage"><Button size="sm" variant="secondary" onClick={() => setTplForm({ id: t.id, name: t.name, category: t.category, language: t.language || 'en', body: t.body, is_active: t.is_active })}>Edit</Button></Can>
              <Can code="whatsapp.manage"><Button size="sm" variant="secondary" onClick={() => setConfirmDelTpl(t.id)}>Delete</Button></Can>
            </span>,
          ])}
          empty="No templates yet — add one above."
        />
      </Section>

      <Section title="Messages" sub="Live statuses · failed sends show the provider error and can be retried">
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search number…" />
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            <option value="">All statuses</option>
            {['queued', 'sent', 'delivered', 'read', 'failed'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          {(q || statusF) && <Button variant="secondary" onClick={() => { setQ(''); setStatusF(''); }}>Clear</Button>}
        </Toolbar>
        <DataTable
          columns={['To', 'Template', 'Status', 'Provider', 'Message ID', 'Error', 'Action']}
          rows={rows.map((m: any) => [
            m.to_number, m.template_name || templates.find((t: any) => t.id === m.template)?.name || '—',
            <StatusBadge key={m.id} value={m.status} />, m.provider || '-',
            <span key={'i' + m.id} title={m.provider_message_id || ''}>{(m.provider_message_id || '-').slice(0, 18)}</span>,
            <span key={'e' + m.id} title={m.failure_info || ''} style={{ color: m.status === 'failed' ? 'var(--jetz-danger, #dc2626)' : undefined }}>{(m.failure_info || '-').slice(0, 40)}</span>,
            m.status === 'failed' ? <Can code="whatsapp.send"><Button key={'r' + m.id} size="sm" onClick={() => retry(m.id)}>Retry</Button></Can> : '-',
          ])}
        />
        <Pager page={page} count={count} setPage={setPage} />
      </Section>
      {confirmDelTpl !== null && (
        <ConfirmDialog
          title="Delete this template?"
          message="The template will be removed. Past messages that used it keep their history."
          confirmLabel="Delete template"
          danger
          onConfirm={() => delTpl(confirmDelTpl)}
          onCancel={() => setConfirmDelTpl(null)}
        />
      )}
    </div>
  );
}

/* ================= NOTIFICATIONS ================= */

export function Notifications() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [q, setQ] = useState('');
  const { rows, count, err, page, setPage, reload, loading } = usePaged('/notifications/', filter === 'unread' ? { is_read: false } : {});
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [seen, setSeen] = useState<Set<number> | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [bcTitle, setBcTitle] = useState('');
  const [bcMsg, setBcMsg] = useState('');
  const [bcRoles, setBcRoles] = useState<string[]>(['coach', 'parent']);
  const [bcWa, setBcWa] = useState(false);
  const [bcSport, setBcSport] = useState('');
  const [bcBatch, setBcBatch] = useState('');
  const [bcBusy, setBcBusy] = useState(false);
  const bcSports = useOptions('/sports/sports/');
  const bcBatches = useOptions('/batches/');
  const unread = rows.filter((n: any) => !n.is_read).length;
  // Live polling: refresh every 20s while the tab is visible.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      reload();
    }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, filter]);
  useEffect(() => { setUpdatedAt(Date.now()); }, [rows]);
  // First load establishes the baseline; later arrivals get a "new" flash.
  useEffect(() => {
    if (seen === null && rows.length) setSeen(new Set(rows.map((n: any) => n.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const ago = (ts: number) => {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    return m === 1 ? '1m ago' : `${m}m ago`;
  };
  const rel = (iso?: string) => {
    if (!iso) return '-';
    const t = new Date(iso).getTime();
    const d = Date.now() - t;
    if (d < 60000) return 'just now';
    if (d < 3600000) return `${Math.round(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.round(d / 3600000)}h ago`;
    return iso.slice(0, 10);
  };
  const markRead = async (id: number) => {
    try { await api.post(`/notifications/${id}/read/`, {}); setOk(''); reload(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };
  const markAll = async () => {
    if (busyAll) return;
    setBusyAll(true); setMsg('');
    try { const { data } = await api.post('/notifications/mark_all_read/', {}); setOk(`Marked ${data.marked ?? ''} as read.`); reload(); }
    catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusyAll(false); }
  };
  const toggleBcRole = (r: string) =>
    setBcRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  const broadcast = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!bcTitle.trim() || !bcMsg.trim()) { setMsg('Broadcast needs a title and a message.'); return; }
    if (!bcRoles.length) { setMsg('Pick at least one audience role for the inbox push.'); return; }
    if (bcBusy) return;
    setBcBusy(true);
    try {
      const { data } = await api.post('/notifications/broadcast/', {
        title: bcTitle.trim(), message: bcMsg.trim(), roles: bcRoles, whatsapp: bcWa,
        ...(bcSport ? { sport: Number(bcSport) } : {}),
        ...(bcBatch ? { batch: Number(bcBatch) } : {}),
      });
      setOk(`Pushed to ${data.inbox ?? 0} inbox(es)` + (bcWa ? ` · WhatsApp sent ${data.wa_sent ?? 0}, failed ${data.wa_failed ?? 0}, skipped ${data.wa_skipped ?? 0}.` : '.'));
      setBcTitle(''); setBcMsg('');
      reload();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBcBusy(false); }
  };
  const shown = rows.filter((n: any) =>
    !q.trim() || `${n.title || ''} ${n.message || ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Insights / Notifications" title="Notifications" count={unread} sub={`${unread} unread · auto-refreshes while you're here`} actions={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span title={live ? 'Live updates on' : 'Live updates paused'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: live ? 'var(--jetz-success)' : 'var(--jetz-muted)', fontWeight: 600 }}>
          <i style={{ width: 8, height: 8, borderRadius: '50%', background: live ? 'var(--jetz-success)' : 'var(--jetz-faint)', display: 'inline-block' }} />
          {live ? `Live · ${ago(updatedAt)}` : 'Paused'}
        </span>
        <Button size="sm" variant="secondary" onClick={() => setLive((v) => !v)}>{live ? 'Pause' : 'Resume'}</Button>
        <Button size="sm" variant="secondary" onClick={reload}>Refresh</Button>
        <Button size="sm" variant="accent" onClick={markAll} disabled={busyAll || unread === 0}>{busyAll ? 'Marking…' : 'Mark all read'}</Button>
      </span>} />
      <Toast msg={err || msg} />
      {ok && <Toast msg={ok} kind="success" />}
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search title or message…" />
        <Select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="all">All</option>
          <option value="unread">Unread only</option>
        </Select>
        {(q || filter !== 'all') && <Button variant="secondary" onClick={() => { setQ(''); setFilter('all'); }}>Clear</Button>}
        <span style={{ fontSize: 12.5, color: 'var(--jetz-muted)', alignSelf: 'center' }}>{loading ? 'Loading…' : `${shown.length} shown`}</span>
      </Toolbar>
      {shown.length === 0 && !loading ? (
        <div className="jetz-table-wrap"><Empty message={filter === 'unread' ? 'All caught up — no unread notifications.' : 'No notifications yet. New alerts appear here automatically.'} /></div>
      ) : (
        <DataTable
          columns={['', 'Title', 'Message', 'Received', 'Action']}
          rows={shown.map((n: any) => [
            !n.is_read ? <span key={'d' + n.id} title="Unread" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--jetz-accent)', display: 'inline-block' }} /> : <span key={'d' + n.id} />,
            <strong key={'t' + n.id}>{n.title}{seen && !seen.has(n.id) ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--jetz-accent)', background: 'var(--jetz-accent-soft)', borderRadius: 999, padding: '2px 8px' }}>NEW</span> : null}</strong>,
            (n.message || '').slice(0, 90),
            rel(n.created_at),
            !n.is_read ? <Button key={n.id} size="sm" onClick={() => markRead(n.id)}>Mark read</Button> : <span key={n.id} style={{ color: 'var(--jetz-faint)', fontSize: 12.5 }}>Read</span>,
          ])}
        />
      )}
      <Pager page={page} count={count} setPage={setPage} />
      <Can code="notifications.send">
        <Section title="Broadcast" sub="Push to inboxes by role · optionally WhatsApp every parent · audited">
          <form onSubmit={broadcast} className="jetz-card" style={{ marginBottom: 0 }}>
            <div className="jetz-form-card" style={{ marginBottom: 0 }}>
              <Field label="Title *" placeholder="Holiday camp on Sunday" value={bcTitle} onChange={(e) => setBcTitle(e.target.value)} required />
              <Field label="Message *" placeholder="Sessions start 7 AM at Main Ground…" value={bcMsg} onChange={(e) => setBcMsg(e.target.value)} required />
              <span className="jetz-field" style={{ display: 'block' }}>
                <span className="jetz-label">Inbox audience *</span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['coach', 'parent', 'academy_admin', 'school_admin'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleBcRole(r)}
                      aria-pressed={bcRoles.includes(r)}
                      style={{
                        padding: '8px 14px', borderRadius: 999, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                        fontFamily: 'var(--jetz-font)',
                        background: bcRoles.includes(r) ? 'var(--jetz-navy)' : '#fff',
                        color: bcRoles.includes(r) ? '#fff' : 'var(--jetz-text)',
                        border: `1.5px solid ${bcRoles.includes(r) ? 'var(--jetz-navy)' : 'var(--jetz-border-strong)'}`,
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </span>
              </span>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', alignSelf: 'center' }}>
                <input type="checkbox" checked={bcWa} onChange={(e) => setBcWa(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--jetz-accent)' }} />
                <span className="jetz-label" style={{ margin: 0 }}>Also WhatsApp parents</span>
              </label>
              <label><span className="jetz-label">WhatsApp: sport filter</span>
                <Select value={bcSport} onChange={(e) => setBcSport(e.target.value)}>
                  <option value="">All sports</option>
                  {bcSports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </label>
              <label><span className="jetz-label">WhatsApp: batch filter</span>
                <Select value={bcBatch} onChange={(e) => setBcBatch(e.target.value)}>
                  <option value="">All batches</option>
                  {bcBatches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </label>
              <Button type="submit" variant="accent" disabled={bcBusy}>{bcBusy ? 'Pushing…' : 'Push broadcast'}</Button>
            </div>
          </form>
        </Section>
      </Can>
    </div>
  );
}

/* ================= SETTINGS / AUDIT ================= */
export function Settings() {
  const { store, values, loading, error, reload } = useAcademySettings();
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const val = (k: string) => (k in drafts ? drafts[k] : values[k]);
  const sameVal = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const dirtyKeys = (ids: string[]) => ids.filter((k) => k in drafts && !sameVal(drafts[k], store[k]?.value ?? ALL_DEFS[k]?.def));

  const saveSection = async (sec: SettingSection) => {
    const keys = dirtyKeys(sec.fields.map((f) => f.key));
    if (!keys.length) return;
    setSaving(sec.id); setMsg(''); setOk('');
    try {
      for (const k of keys) await saveSetting(store, k, drafts[k]);
      setDrafts((d) => {
        const n = { ...d };
        keys.forEach((k) => delete n[k]);
        return n;
      });
      setOk(`${sec.title} saved.`);
      reload();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setSaving(null); }
  };

  const customRows = Object.values(store).filter((s) => !(s.key in ALL_DEFS));
  const addCustom = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!customKey.trim()) { setMsg('Enter a key.'); return; }
    let parsed: any;
    try { parsed = JSON.parse(customVal || 'null'); }
    catch { setMsg('Value must be valid JSON.'); return; }
    try { await saveSetting(store, customKey.trim(), parsed); setCustomKey(''); setCustomVal(''); setOk('Custom setting saved.'); reload(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };
  const delCustom = async (id?: number) => {
    if (!id) return;
    try { await api.delete(`/settings/${id}/`); setOk('Deleted.'); reload(); }
    catch (e: any) { setMsg(errMsg(e)); }
  };

  const renderField = (f: SettingFieldDef) => {
    const v = val(f.key);
    const set = (nv: any) => setDrafts((d) => ({ ...d, [f.key]: nv }));
    const isDefault = !(f.key in store);
    const wrap = (control: React.ReactNode) => (
      <div key={f.key} style={{ minWidth: 200, flex: f.fullWidth ? '1 1 100%' : '1 1 220px' }}>
        {control}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          {f.hint && <span className="jetz-field-hint">{f.hint}</span>}
          {isDefault && !(f.key in drafts) && <span className="jetz-badge jetz-badge-grey">default</span>}
          {f.key in drafts && <span className="jetz-badge jetz-badge-amber">edited</span>}
        </div>
      </div>
    );
    if (f.type === 'textarea') return wrap(<><span className="jetz-label">{f.label}</span><textarea className="jetz-input" rows={3} value={v ?? ''} onChange={(e) => set(e.target.value)} /></>);
    if (f.type === 'number') return wrap(<Field label={f.label} type="number" min={f.min} max={f.max} value={v ?? ''} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} />);
    if (f.type === 'time') return wrap(<Field label={f.label} type="time" value={v ?? ''} onChange={(e) => set(e.target.value)} />);
    if (f.type === 'select') return wrap(<label><span className="jetz-label">{f.label}</span><Select value={v ?? ''} onChange={(e) => set(e.target.value)}>{(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</Select></label>);
    if (f.type === 'toggle') return wrap(
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0' }}>
        <input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--jetz-accent)' }} />
        <span className="jetz-label" style={{ margin: 0 }}>{f.label}</span>
      </label>
    );
    if (f.type === 'weekdays') {
      const sel: number[] = Array.isArray(v) ? v : [];
      const toggleDay = (d: number) => set(sel.includes(d) ? sel.filter((x) => x !== d) : [...sel, d].sort());
      return wrap(
        <div>
          <span className="jetz-label">{f.label}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {WEEKDAYS.map((name, d) => {
              const on = sel.includes(d);
              return (
                <label key={name} style={{ display: 'inline-flex', gap: 7, alignItems: 'center', border: `1.5px solid ${on ? 'var(--jetz-accent)' : 'var(--jetz-border-strong)'}`, background: on ? 'var(--jetz-accent-soft, #fff1e8)' : '#fff', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>
                  <input type="checkbox" checked={on} onChange={() => toggleDay(d)} style={{ width: 16, height: 16, accentColor: 'var(--jetz-accent)' }} />
                  {name}
                </label>
              );
            })}
          </div>
        </div>
      );
    }
    return wrap(<Field label={f.label} value={v ?? ''} onChange={(e) => set(e.target.value)} />);
  };

  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Admin / Settings" title="Academy Settings" sub="Client-friendly academy configuration · no JSON typing needed" actions={<Button size="sm" variant="secondary" onClick={() => { setDrafts({}); reload(); }}>Refresh</Button>} />
      <Toast msg={error || msg} kind={error || msg ? 'danger' : 'warning'} />
      {ok && <Toast msg={ok} kind="success" />}
      <Section title="My Account" sub="Change the password you use to sign in. Applies immediately on every device.">
        <ChangePasswordCard />
      </Section>
      {loading ? <SkeletonGrid count={6} /> : SETTING_SECTIONS.map((sec) => {
        const dirty = dirtyKeys(sec.fields.map((f) => f.key));
        return (
          <Section key={sec.id} title={sec.title} sub={sec.sub}>
            <div className="jetz-card">
              <div className="jetz-form-card" style={{ marginBottom: 0 }}>
                {sec.fields.map(renderField)}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Can code="settings.edit"><Button size="sm" variant="accent" disabled={!dirty.length || saving === sec.id} onClick={() => saveSection(sec)}>
                  {saving === sec.id ? 'Saving…' : dirty.length ? `Save ${sec.title} (${dirty.length})` : 'Saved'}
                </Button></Can>
                {!!dirty.length && <Button size="sm" variant="secondary" onClick={() => setDrafts((d) => { const n = { ...d }; dirty.forEach((k) => delete n[k]); return n; })}>Discard</Button>}
              </div>
            </div>
          </Section>
        );
      })}

      <Section title="Advanced · custom settings" sub="Raw key-value store for integrations. Regular options above cover daily needs.">
        <div className="jetz-card" style={{ marginBottom: 12 }}>
          <Button size="sm" variant="secondary" onClick={() => setShowCustom((v) => !v)}>{showCustom ? 'Hide' : 'Show'} custom settings ({customRows.length})</Button>
          {showCustom && (
            <div style={{ marginTop: 12 }}>
              <form onSubmit={addCustom} className="jetz-form-card">
                <Field label="Key" placeholder="integration.flag" value={customKey} onChange={(e) => setCustomKey(e.target.value)} />
                <Field label="Value (JSON)" placeholder='{"x": 1}' value={customVal} onChange={(e) => setCustomVal(e.target.value)} />
                <Can code="settings.edit"><Button type="submit" variant="accent">Save custom</Button></Can>
              </form>
              <DataTable
                columns={['Key', 'Value', 'Action']}
                rows={customRows.map((s) => [s.key, JSON.stringify(s.value), <Can key={s.key} code="settings.edit"><Button size="sm" variant="secondary" onClick={() => delCustom(s.id)}>Delete</Button></Can>])}
                empty="No custom settings."
              />
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

export function Audit() {
  const params = new URLSearchParams(window.location.search);
  const [module, setModule] = useState('');
  const [userId, setUserId] = useState(params.get('user') || '');
  const { rows, count, err, page, setPage, reload } = usePaged('/audit/logs/', { ...(module ? { module } : {}), ...(userId ? { user: userId } : {}) });
  return (
    <div>
      <PageHeader eyebrow="JETZ Academy / Insights / Audit Logs" title="Audit Logs" count={count} sub={`${count} recorded actions · who changed what, when`} actions={<Button size="sm" variant="secondary" onClick={reload}>Refresh</Button>} />
      <Toast msg={err} />
      {params.get('user') && <p className="jetz-note">Filtered to one account's history. <Button size="sm" variant="secondary" onClick={() => { setUserId(''); window.history.replaceState(null, '', '/audit'); }}>Show all</Button></p>}
      <Toolbar>
        <Field label="Module filter" placeholder="students, fees…" value={module} onChange={(e) => setModule(e.target.value)} />
        <Field label="User ID filter" placeholder="e.g. 7" value={userId} onChange={(e) => setUserId(e.target.value)} />
        {(module || userId) && <Button variant="secondary" onClick={() => { setModule(''); setUserId(''); window.history.replaceState(null, '', '/audit'); }}>Clear</Button>}
      </Toolbar>
      <DataTable columns={['Time', 'User', 'Action', 'Module', 'Record']} rows={rows.map((a: any) => [(a.created_at || '').slice(0, 16).replace('T', ' '), a.username || a.user, a.action, a.module, a.record])} />
      <Pager page={page} count={count} setPage={setPage} />
    </div>
  );
}
