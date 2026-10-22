import React, { useEffect, useRef, useState } from 'react';
import {
  ClipboardList, RefreshCw, Plus, Send, Paperclip, Wrench, CheckCircle,
  ThumbsUp, ThumbsDown, Clock, AlertTriangle, Play, RotateCcw, XCircle,
} from 'lucide-react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  Button,
  DataTable,
  DetailRows,
  Drawer,
  Field,
  FilterBar,
  PageHeader,
  SearchInput,
  Select,
  Section,
  SkeletonGrid,
  StatCard,
  StatusBadge,
  Toast,
} from '../components/ui';

function toRows(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

type Paged = { rows: any[]; count: number; err: string; page: number; setPage: (n: number) => void; reload: () => void; loading: boolean };

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
    api.get(url, { params: { ...JSON.parse(key), page, page_size: pageSize } })
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

const CATEGORIES = [
  ['new_feature', 'New Feature'],
  ['ui_ux', 'UI/UX Improvement'],
  ['report', 'Report or Analytics'],
  ['workflow', 'Workflow Change'],
  ['bug_fix', 'Bug Fix'],
  ['access_permission', 'Access/Permission'],
  ['notification_integration', 'Notification/Integration'],
  ['other', 'Other'],
] as const;

const PRIORITIES = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['urgent', 'Urgent'],
] as const;

const STATUSES = [
  ['draft', 'Draft'],
  ['submitted', 'Submitted'],
  ['under_review', 'Under Review'],
  ['clarification_required', 'Clarification Required'],
  ['approved', 'Approved'],
  ['assigned', 'Assigned'],
  ['in_progress', 'In Progress'],
  ['ready_for_review', 'Ready for Review'],
  ['completed', 'Completed'],
  ['rejected', 'Rejected'],
  ['cancelled', 'Cancelled'],
] as const;

const label = (list: readonly (readonly [string, string])[], value: string) =>
  list.find(([v]) => v === value)?.[1] || value;

const ts = (v?: string) => (v || '').slice(0, 16).replace('T', ' ');

function Can({ code, children }: { code: string; children: React.ReactNode }) {
  const { can } = useAuth();
  return can(code) ? <>{children}</> : null;
}

function Pager({ page, count, setPage, pageSize = 20 }: { page: number; count: number; setPage: (n: number) => void; pageSize?: number }) {
  const total = Math.max(1, Math.ceil(count / pageSize));
  if (total <= 1) return null;
  return (
    <div className="jetz-table-foot jetz-pager-standalone">
      <span>Page {page} of {total} · {count} requests</span>
      <div className="jetz-pager">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
        <Button size="sm" variant="secondary" disabled={page >= total} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function Customization() {
  const { can, user } = useAuth();
  const canCreate = can('customization.create');
  const canReply = can('customization.reply');
  const canReview = can('customization.review') || can('customization.manage');
  const canManage = can('customization.manage');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [requestId, setRequestId] = useState('');
  const { rows, count, err, page, setPage, reload, loading } = usePaged('/customization/requests/', {
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(priority ? { priority } : {}),
    ...(requestId ? { request_id: requestId } : {}),
  });
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [assignTeam, setAssignTeam] = useState('');
  const [prioritySet, setPrioritySet] = useState('medium');
  const [assignees, setAssignees] = useState<any[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const emptyForm = {
    title: '', category: 'new_feature', priority: 'medium', module_page: '',
    description: '', reason: '', expected_outcome: '', save_as_draft: false,
  };
  const [form, setForm] = useState(emptyForm);

  const loadStats = () => api.get('/customization/requests/stats/').then((r) => setStats(r.data)).catch(() => {});
  useEffect(() => { loadStats(); }, [page, status, category, priority, search, requestId]);
  useEffect(() => {
    if (canReview) {
      api.get('/customization/requests/assignees/').then((r) => setAssignees(toRows(r.data))).catch(() => {});
    }
  }, [canReview]);

  const refreshAll = () => { reload(); loadStats(); };

  const create = async (e: React.FormEvent, draft = false) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!form.title.trim() || !form.description.trim()) { setMsg('Title and description are required.'); return; }
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/customization/requests/', { ...form, save_as_draft: draft });
      setForm(emptyForm); setShowForm(false);
      setOk(draft ? 'Saved as draft.' : 'Request submitted — the Super Admin has been notified.');
      refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };

  const openDetail = async (r: any) => {
    setMsg(''); setOk(''); setReplyBody(''); setReplyInternal(false); setNote(''); setReason('');
    try {
      const { data } = await api.get(`/customization/requests/${r.id}/`);
      setDetail(data);
      setAssignTo(data.assigned_to || '');
      setAssignTeam(data.assigned_team || '');
      setPrioritySet(data.priority || 'medium');
    } catch (e: any) { setMsg(errMsg(e)); }
  };

  const postReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !replyBody.trim()) return;
    setReplyBusy(true); setMsg('');
    try {
      const { data } = await api.post(`/customization/requests/${detail.id}/reply/`, { body: replyBody.trim(), is_internal: replyInternal });
      setDetail(data); setReplyBody(''); setReplyInternal(false);
      refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setReplyBusy(false); }
  };

  const uploadAttachment = async (f: File | undefined) => {
    if (!detail || !f) return;
    setMsg('');
    const fd = new FormData();
    fd.append('file', f);
    try {
      await api.post(`/customization/requests/${detail.id}/attachments/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { data } = await api.get(`/customization/requests/${detail.id}/`);
      setDetail(data); setOk('Attachment uploaded.');
    } catch (e: any) { setMsg(errMsg(e)); }
  };

  const doAction = async (action: string, extra: Record<string, any> = {}) => {
    if (!detail) return;
    setMsg(''); setOk('');
    try {
      const { data } = await api.post(`/customization/requests/${detail.id}/transition/`, { action, ...extra });
      setDetail(data); setOk('Request updated.'); refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
  };

  const fmt = (p: string) => label(PRIORITIES, p);

  return (
    <div>
      <PageHeader
        eyebrow="JETZ Academy / Insights / Customization"
        title="Customization Requests"
        count={count}
        sub="Submit feature/customization requests, track progress, and (as Super Admin) review, prioritize, assign and verify work."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={refreshAll} disabled={loading}>
              <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
            </Button>
            <Can code="customization.create">
              <Button size="sm" variant="accent" onClick={() => setShowForm((v) => !v)}>
                <Plus style={{ width: 14, height: 14 }} /> New request
              </Button>
            </Can>
          </>
        }
      />

      {canReview && stats && (
        <div className="jetz-stat-grid" style={{ marginBottom: 14 }}>
          <StatCard label="Total" value={stats.total ?? 0} sub="All requests" icon={<ClipboardList />} accent />
          <StatCard label="New" value={stats.submitted ?? 0} sub="Awaiting review" icon={<Clock />} />
          <StatCard label="Under review" value={stats.under_review ?? 0} sub="Being reviewed" icon={<Clock />} />
          <StatCard label="Clarification" value={stats.awaiting_clarification ?? 0} sub="Awaiting admin reply" icon={<AlertTriangle />} />
          <StatCard label="Approved" value={stats.approved ?? 0} sub="Authorized" icon={<ThumbsUp />} />
          <StatCard label="In progress" value={stats.in_progress ?? 0} sub="Being implemented" icon={<Wrench />} />
          <StatCard label="Completed" value={stats.completed ?? 0} sub="Verified & done" icon={<CheckCircle />} />
          <StatCard label="Rejected" value={stats.rejected ?? 0} sub="Declined" icon={<ThumbsDown />} />
        </div>
      )}

      <Toast msg={err || msg} kind={err || msg ? 'danger' : 'warning'} />
      {ok && <Toast msg={ok} kind="success" />}

      <Can code="customization.create">
        {showForm && (
          <form onSubmit={(e) => create(e, false)} className="jetz-card" style={{ marginBottom: 14 }}>
            <div className="jetz-panel-title">New customization request</div>
            <div className="jetz-panel-sub">Explain what you need and why. The Super Admin reviews every request.</div>
            <div className="jetz-form-card" style={{ marginBottom: 0 }}>
              <Field label="Title *" placeholder="e.g. Customize attendance report" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <label className="jetz-field" style={{ display: 'block' }}>
                <span className="jetz-label">Category</span>
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ width: '100%' }}>
                  {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </label>
              <label className="jetz-field" style={{ display: 'block' }}>
                <span className="jetz-label">Priority requested</span>
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={{ width: '100%' }}>
                  {PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </label>
              <Field label="Relevant module / page" placeholder="e.g. Attendance, Fees export…" value={form.module_page} onChange={(e) => setForm({ ...form, module_page: e.target.value })} />
            </div>
            <div style={{ marginTop: 12 }}>
              <span className="jetz-label">Detailed requirements *</span>
              <textarea className="jetz-input" rows={4} placeholder="Describe the feature, change or report in detail…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="jetz-form-card" style={{ marginTop: 12, marginBottom: 0 }}>
              <div>
                <span className="jetz-label">Reason for the request</span>
                <textarea className="jetz-input" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
              <div>
                <span className="jetz-label">Expected outcome</span>
                <textarea className="jetz-input" rows={2} value={form.expected_outcome} onChange={(e) => setForm({ ...form, expected_outcome: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={(e) => create(e as any, true)}>Save as draft</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Can>

      <FilterBar count={count} loading={loading}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, description…" label="Search" />
        <label className="jetz-field" style={{ display: 'block' }}>
          <span className="jetz-label">Request ID</span>
          <input className="jetz-input" value={requestId} onChange={(e) => setRequestId(e.target.value)} placeholder="HARI-CR-…" />
        </label>
        <label className="jetz-field" style={{ display: 'block' }}>
          <span className="jetz-label">Status</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
            <option value="">All statuses</option>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </label>
        <label className="jetz-field" style={{ display: 'block' }}>
          <span className="jetz-label">Category</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%' }}>
            <option value="">All categories</option>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </label>
        <label className="jetz-field" style={{ display: 'block' }}>
          <span className="jetz-label">Priority</span>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ width: '100%' }}>
            <option value="">All priorities</option>
            {PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </label>
        {(search || status || category || priority || requestId) && (
          <Button variant="ghost" onClick={() => { setSearch(''); setStatus(''); setCategory(''); setPriority(''); setRequestId(''); }}>Clear all</Button>
        )}
      </FilterBar>

      {loading && rows.length === 0 ? <SkeletonGrid count={6} /> : (
        <DataTable
          columns={['Request ID', 'Title', 'Category', 'Priority', 'Status', canManage ? 'Requested by' : 'Assigned', 'Updated', 'Actions']}
          rows={rows.map((t: any) => [
            <span key={'id' + t.id} style={{ fontFamily: 'monospace', fontWeight: 600 }}>{t.request_id}</span>,
            <span key={'t' + t.id} style={{ fontWeight: 600 }}>{t.title}</span>,
            label(CATEGORIES, t.category),
            fmt(t.priority),
            <StatusBadge key={t.id} value={t.status} />,
            canManage ? (t.created_by_name || '—') : (t.assigned_to_name || t.assigned_team || 'Unassigned'),
            ts(t.updated_at),
            <Button key={'a' + t.id} size="sm" variant="secondary" onClick={() => openDetail(t)}>View</Button>,
          ])}
          empty="No customization requests yet."
        />
      )}
      <Pager page={page} count={count} setPage={setPage} />

      {detail && (
        <Drawer
          eyebrow={`Customization / ${detail.request_id}`}
          title={detail.title}
          sub={`${label(CATEGORIES, detail.category)} · raised by ${detail.created_by_name || '—'} · ${ts(detail.created_at)}`}
          onClose={() => setDetail(null)}
        >
          <DetailRows
            rows={[
              ['Status', <StatusBadge key="st" value={detail.status} />],
              ['Priority', fmt(detail.priority)],
              ['Category', label(CATEGORIES, detail.category)],
              ['Module / page', detail.module_page || '—'],
              ['School', detail.school_name || '—'],
              ['Requested by', detail.created_by_name || '—'],
              ['Assigned to', detail.assigned_to_name || detail.assigned_team || 'Unassigned'],
              ['Submitted', ts(detail.submitted_at || detail.created_at)],
              ['Completed', detail.completed_at ? ts(detail.completed_at) : '—'],
            ]}
          />

          {detail.decision_reason && (
            <Section title="Decision reason" sub="">
              <div className="jetz-card" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{detail.decision_reason}</div>
            </Section>
          )}

          <Section title="Requirements" sub="">
            <div className="jetz-card" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{detail.description}</div>
            {detail.reason && <div className="jetz-card" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}><strong>Reason:</strong> {detail.reason}</div>}
            {detail.expected_outcome && <div className="jetz-card" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}><strong>Expected outcome:</strong> {detail.expected_outcome}</div>}
          </Section>

          {canReview && (
            <Section title="Review & decisions" sub="Approve, reject, request clarification, prioritize, assign and track.">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <Can code="customization.review">
                  {detail.status === 'submitted' && <Button size="sm" onClick={() => doAction('review')}>Start review</Button>}
                  {['submitted', 'under_review', 'clarification_required'].includes(detail.status) && (
                    <Button size="sm" variant="accent" onClick={() => doAction('approve')}><ThumbsUp style={{ width: 14, height: 14 }} /> Approve</Button>
                  )}
                </Can>
                <Can code="customization.manage">
                  {['approved', 'assigned'].includes(detail.status) && (
                    <Button size="sm" onClick={() => doAction('start')}><Play style={{ width: 14, height: 14 }} /> Start work</Button>
                  )}
                  {detail.status === 'in_progress' && (
                    <Button size="sm" onClick={() => doAction('ready')}>Ready for review</Button>
                  )}
                  {['completed', 'rejected', 'cancelled'].includes(detail.status) && (
                    <Button size="sm" variant="secondary" onClick={() => doAction('reopen')}><RotateCcw style={{ width: 14, height: 14 }} /> Reopen</Button>
                  )}
                </Can>
                <Can code="customization.review">
                  {['ready_for_review', 'in_progress'].includes(detail.status) && (
                    <Button size="sm" variant="accent" onClick={() => doAction('complete')}><CheckCircle style={{ width: 14, height: 14 }} /> Mark completed</Button>
                  )}
                </Can>
              </div>

              <Can code="customization.review">
                {detail.status === 'under_review' && (
                  <div style={{ marginBottom: 10 }}>
                    <span className="jetz-label">Request clarification</span>
                    <textarea className="jetz-input" rows={2} placeholder="Ask the admin for more details…" value={note} onChange={(e) => setNote(e.target.value)} />
                    <div style={{ marginTop: 6 }}>
                      <Button size="sm" disabled={!note.trim()} onClick={() => { doAction('clarify', { note: note.trim() }); setNote(''); }}>Send clarification request</Button>
                    </div>
                  </div>
                )}
                {['submitted', 'under_review', 'clarification_required', 'approved'].includes(detail.status) && (
                  <div style={{ marginBottom: 10 }}>
                    <span className="jetz-label">Rejection reason (mandatory to reject)</span>
                    <textarea className="jetz-input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div style={{ marginTop: 6 }}>
                      <Button size="sm" variant="danger" disabled={!reason.trim()} onClick={() => { doAction('reject', { reason: reason.trim() }); setReason(''); }}>
                        <ThumbsDown style={{ width: 14, height: 14 }} /> Reject request
                      </Button>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <span className="jetz-label" style={{ margin: 0 }}>Set priority</span>
                  <Select value={prioritySet} onChange={(e) => setPrioritySet(e.target.value)} style={{ width: 140 }}>
                    {PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Button size="sm" variant="secondary" onClick={() => doAction('set_priority', { priority: prioritySet })}>Update priority</Button>
                </div>
              </Can>

              <Can code="customization.manage">
                <div className="jetz-form-card" style={{ marginBottom: 0 }}>
                  <label className="jetz-field" style={{ display: 'block' }}>
                    <span className="jetz-label">Assign to</span>
                    <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} style={{ width: '100%' }}>
                      <option value="">Unassigned</option>
                      {assignees.map((u: any) => <option key={u.id} value={u.id}>{u.username}{u.role ? ` (${u.role})` : ''}</option>)}
                    </Select>
                  </label>
                  <Field label="Team / note" placeholder="e.g. Dev Team A" value={assignTeam} onChange={(e) => setAssignTeam(e.target.value)} />
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <Button size="sm" onClick={() => doAction('assign', { assigned_to: assignTo || null, assigned_team: assignTeam })}>Assign work</Button>
                  </div>
                </div>
              </Can>
            </Section>
          )}

          {!canReview && detail.status !== 'completed' && detail.status !== 'cancelled' && (detail.created_by === user?.id) && ['draft', 'submitted'].includes(detail.status) && (
            <Section title="Actions" sub="">
              <Button size="sm" variant="secondary" onClick={() => doAction('cancel')}><XCircle style={{ width: 14, height: 14 }} /> Cancel request</Button>
            </Section>
          )}

          <Section title={`Conversation & timeline (${((detail.comments || []).length) + ((detail.history || []).length)})`} sub="">
            <div style={{ display: 'grid', gap: 10 }}>
              {(detail.comments || []).map((c: any) => (
                <div key={c.id} className="jetz-card" style={{ margin: 0, borderLeft: c.is_internal ? '3px solid var(--jetz-warn, #d97706)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <strong style={{ fontSize: 13.5 }}>
                      {c.author_name || 'User'}
                      {c.is_internal && <span className="jetz-badge jetz-badge-amber" style={{ marginLeft: 8 }}>internal note</span>}
                    </strong>
                    <span style={{ fontSize: 12, color: 'var(--jetz-faint)' }}>{ts(c.created_at)}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }}>{c.body}</div>
                  {(c.attachments || []).map((a: any) => (
                    <a key={a.id} href={a.file} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, marginTop: 6, display: 'inline-block' }}>
                      <Paperclip style={{ width: 12, height: 12, verticalAlign: '-2px' }} /> {a.file_name}
                    </a>
                  ))}
                </div>
              ))}
              {(detail.history || []).map((h: any) => (
                <div key={'h' + h.id} style={{ fontSize: 12.5, color: 'var(--jetz-faint)', borderLeft: '2px solid var(--jetz-border, #e5e7eb)', paddingLeft: 10 }}>
                  {ts(h.created_at)} · {h.from_status || '—'} → {h.to_status} by {h.changed_by_name || 'System'}{h.note ? ` — ${h.note}` : ''}
                </div>
              ))}
              {((detail.comments || []).length + (detail.history || []).length) === 0 && <p className="jetz-note" style={{ margin: 0 }}>No activity yet.</p>}
            </div>

            {canReply ? (
              <form onSubmit={postReply} style={{ marginTop: 12 }}>
                <span className="jetz-label">Comment / reply</span>
                <textarea className="jetz-input" rows={3} placeholder="Add a comment or reply…" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
                {canReview && (
                  <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={replyInternal} onChange={(e) => setReplyInternal(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--jetz-accent)' }} />
                    Internal note (hidden from the requester)
                  </label>
                )}
                <div style={{ marginTop: 10 }}>
                  <Button type="submit" variant="accent" disabled={replyBusy || !replyBody.trim()}>
                    <Send style={{ width: 14, height: 14 }} /> {replyBusy ? 'Sending…' : 'Post'}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="jetz-note" style={{ marginTop: 12 }}>You need the <strong>customization.reply</strong> permission to comment.</p>
            )}
          </Section>

          <Section title={`Attachments (${(detail.attachments || []).length})`} sub="">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <Can code="customization.reply">
                <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
                  <Paperclip style={{ width: 14, height: 14 }} /> Upload file
                </Button>
                <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx" hidden onChange={(e) => { uploadAttachment(e.target.files?.[0]); e.target.value = ''; }} />
                <span className="jetz-file-name">PDF, JPG, PNG, CSV or XLSX · max 10 MB</span>
              </Can>
            </div>
            <DataTable
              columns={['File', 'Uploaded by', 'Date']}
              rows={(detail.attachments || []).map((a: any) => [
                <a key={'f' + a.id} href={a.file} target="_blank" rel="noreferrer">{a.file_name}</a>,
                a.uploaded_by_name || '—',
                ts(a.created_at),
              ])}
              empty="No attachments."
            />
          </Section>
        </Drawer>
      )}
    </div>
  );
}
