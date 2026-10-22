import React, { useEffect, useRef, useState } from 'react';
import { LifeBuoy, MessageSquare, Paperclip, Plus, RefreshCw, Send } from 'lucide-react';
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
  ['technical', 'Technical'],
  ['billing', 'Billing & Fees'],
  ['account', 'Account & Access'],
  ['academic', 'Academic / Academy'],
  ['other', 'Other'],
] as const;
const PRIORITIES = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['urgent', 'Urgent'],
] as const;
const STATUSES = [
  ['open', 'Open'],
  ['in_progress', 'In progress'],
  ['resolved', 'Resolved'],
  ['closed', 'Closed'],
] as const;

const label = (list: readonly (readonly [string, string])[], value: string) =>
  list.find(([v]) => v === value)?.[1] || value;

function Can({ code, children }: { code: string; children: React.ReactNode }) {
  const { can } = useAuth();
  return can(code) ? <>{children}</> : null;
}

function Pager({ page, count, setPage, pageSize = 20 }: { page: number; count: number; setPage: (n: number) => void; pageSize?: number }) {
  const total = Math.max(1, Math.ceil(count / pageSize));
  if (total <= 1) return null;
  return (
    <div className="jetz-table-foot jetz-pager-standalone">
      <span>Page {page} of {total} · {count} tickets</span>
      <div className="jetz-pager">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
        <Button size="sm" variant="secondary" disabled={page >= total} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function Support() {
  const { can, user } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const { rows, count, err, page, setPage, reload, loading } = usePaged('/support/tickets/', {
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(category ? { category } : {}),
  });
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'technical', priority: 'medium', description: '' });
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const canManage = can('support.manage');

  const loadStats = () => api.get('/support/tickets/stats/').then((r) => setStats(r.data)).catch(() => {});
  useEffect(() => { loadStats(); }, [page, status, priority, category, search]);
  useEffect(() => {
    if (canManage && can('users.view')) {
      api.get('/users/', { params: { page_size: 200 } }).then((r) => setStaff(toRows(r.data))).catch(() => {});
    }
  }, [canManage, can]);

  const refreshAll = () => { reload(); loadStats(); };

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setOk('');
    if (!form.subject.trim() || !form.description.trim()) { setMsg('Subject and description are required.'); return; }
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/support/tickets/', form);
      setForm({ subject: '', category: 'technical', priority: 'medium', description: '' });
      setShowForm(false);
      setOk('Ticket raised — the support team has been notified.');
      refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };

  const openDetail = async (t: any) => {
    setMsg(''); setOk(''); setReplyBody(''); setReplyInternal(false);
    try {
      const { data } = await api.get(`/support/tickets/${t.id}/`);
      setDetail(data);
    } catch (e: any) { setMsg(errMsg(e)); }
  };

  const postReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !replyBody.trim()) return;
    setReplyBusy(true); setMsg('');
    try {
      const { data } = await api.post(`/support/tickets/${detail.id}/reply/`, { body: replyBody.trim(), is_internal: replyInternal });
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
      await api.post(`/support/tickets/${detail.id}/attachments/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { data } = await api.get(`/support/tickets/${detail.id}/`);
      setDetail(data);
      setOk('Attachment uploaded.');
    } catch (e: any) { setMsg(errMsg(e)); }
  };

  const managerUpdate = async (patch: Record<string, any>) => {
    if (!detail) return;
    setMsg('');
    try {
      if ('assigned_to' in patch) {
        const { data } = await api.post(`/support/tickets/${detail.id}/assign/`, patch);
        setDetail(data);
      } else {
        const { data } = await api.patch(`/support/tickets/${detail.id}/`, patch);
        setDetail(data);
      }
      setOk('Ticket updated.');
      refreshAll();
    } catch (e: any) { setMsg(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="JETZ Academy / Insights / Support"
        title="Support Tickets"
        count={count}
        sub="Raise issues for the platform team and follow the conversation. Super Admin manages every ticket."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={refreshAll} disabled={loading}>
              <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
            </Button>
            <Can code="support.create">
              <Button size="sm" variant="accent" onClick={() => setShowForm((v) => !v)}>
                <Plus style={{ width: 14, height: 14 }} /> Raise ticket
              </Button>
            </Can>
          </>
        }
      />
      {stats && (
        <div className="jetz-stat-grid" style={{ marginBottom: 14 }}>
          <StatCard label="Total tickets" value={stats.total ?? 0} sub={canManage ? 'All tickets' : 'Your tickets'} icon={<LifeBuoy />} accent />
          <StatCard label="Open" value={stats.open ?? 0} sub="Awaiting first response" icon={<MessageSquare />} />
          <StatCard label="In progress" value={stats.in_progress ?? 0} sub="Being worked on" icon={<MessageSquare />} />
          <StatCard label="Resolved" value={stats.resolved ?? 0} sub="Closed out" icon={<MessageSquare />} />
        </div>
      )}
      <Toast msg={err || msg} kind={err || msg ? 'danger' : 'warning'} />
      {ok && <Toast msg={ok} kind="success" />}

      <Can code="support.create">
        {showForm && (
          <form onSubmit={create} className="jetz-card" style={{ marginBottom: 14 }}>
            <div className="jetz-panel-title">Raise a support ticket</div>
            <div className="jetz-panel-sub">Describe the issue clearly. Attach screenshots after creating the ticket.</div>
            <div className="jetz-form-card" style={{ marginBottom: 0 }}>
              <Field label="Subject *" placeholder="Short summary" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
              <label className="jetz-field" style={{ display: 'block' }}>
                <span className="jetz-label">Category</span>
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ width: '100%' }}>
                  {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </label>
              <label className="jetz-field" style={{ display: 'block' }}>
                <span className="jetz-label">Priority</span>
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={{ width: '100%' }}>
                  {PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </label>
            </div>
            <div style={{ marginTop: 12 }}>
              <span className="jetz-label">Description *</span>
              <textarea className="jetz-input" rows={4} placeholder="What happened, what you expected, steps to reproduce…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Submitting…' : 'Submit ticket'}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Can>

      <FilterBar count={count} loading={loading}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search subject, description…" label="Search" />
        <label className="jetz-field" style={{ display: 'block' }}>
          <span className="jetz-label">Status</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
            <option value="">All statuses</option>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </label>
        <label className="jetz-field" style={{ display: 'block' }}>
          <span className="jetz-label">Priority</span>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ width: '100%' }}>
            <option value="">All priorities</option>
            {PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </label>
        <label className="jetz-field" style={{ display: 'block' }}>
          <span className="jetz-label">Category</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%' }}>
            <option value="">All categories</option>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </label>
        {(search || status || priority || category) && (
          <Button variant="ghost" onClick={() => { setSearch(''); setStatus(''); setPriority(''); setCategory(''); }}>Clear all</Button>
        )}
      </FilterBar>

      <DataTable
        columns={['#', 'Subject', 'Category', 'Priority', 'Status', canManage ? 'Raised by' : 'Assigned', 'Replies', 'Updated', 'Actions']}
        rows={rows.map((t: any) => [
          `#${t.id}`,
          <span key={'s' + t.id} style={{ fontWeight: 600 }}>{t.subject}</span>,
          label(CATEGORIES, t.category),
          label(PRIORITIES, t.priority),
          <StatusBadge key={t.id} value={t.status} />,
          canManage ? (t.created_by_name || '—') : (t.assigned_to_name || 'Unassigned'),
          t.reply_count ?? 0,
          (t.updated_at || '').slice(0, 16).replace('T', ' '),
          <Button key={'a' + t.id} size="sm" variant="secondary" onClick={() => openDetail(t)}>View</Button>,
        ])}
        empty={search || status || priority || category ? 'No tickets match these filters.' : 'No support tickets yet.'}
      />
      <Pager page={page} count={count} setPage={setPage} />

      {detail && (
        <Drawer
          eyebrow={`Support / Ticket #${detail.id}`}
          title={detail.subject}
          sub={`${label(CATEGORIES, detail.category)} · raised by ${detail.created_by_name || '—'} · ${(detail.created_at || '').slice(0, 16).replace('T', ' ')}`}
          onClose={() => setDetail(null)}
        >
          <DetailRows
            rows={[
              ['Status', <StatusBadge key="st" value={detail.status} />],
              ['Priority', label(PRIORITIES, detail.priority)],
              ['Category', label(CATEGORIES, detail.category)],
              ['Raised by', detail.created_by_name || '—'],
              ['Assigned to', detail.assigned_to_name || 'Unassigned'],
              ['Last updated', (detail.updated_at || '').slice(0, 16).replace('T', ' ')],
              ['Resolved', detail.resolved_at ? (detail.resolved_at || '').slice(0, 16).replace('T', ' ') : '—'],
            ]}
          />

          {canManage && (
            <Section title="Manage ticket" sub="Change status, priority or assign an owner.">
              <div className="jetz-form-card" style={{ marginBottom: 0 }}>
                <label className="jetz-field" style={{ display: 'block' }}>
                  <span className="jetz-label">Status</span>
                  <Select value={detail.status} onChange={(e) => managerUpdate({ status: e.target.value })} style={{ width: '100%' }}>
                    {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </label>
                <label className="jetz-field" style={{ display: 'block' }}>
                  <span className="jetz-label">Priority</span>
                  <Select value={detail.priority} onChange={(e) => managerUpdate({ priority: e.target.value })} style={{ width: '100%' }}>
                    {PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </label>
                {staff.length > 0 && (
                  <label className="jetz-field" style={{ display: 'block' }}>
                    <span className="jetz-label">Assign to</span>
                    <Select value={detail.assigned_to || ''} onChange={(e) => managerUpdate({ assigned_to: e.target.value || null })} style={{ width: '100%' }}>
                      <option value="">Unassigned</option>
                      {staff.map((u: any) => <option key={u.id} value={u.id}>{u.username}{u.role_name ? ` (${u.role_name})` : ''}</option>)}
                    </Select>
                  </label>
                )}
              </div>
            </Section>
          )}

          <Section title="Description" sub="">
            <div className="jetz-card" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{detail.description}</div>
          </Section>

          <Section title={`Conversation (${(detail.replies || []).length})`} sub="">
            <div style={{ display: 'grid', gap: 10 }}>
              {(detail.replies || []).length === 0 && <p className="jetz-note" style={{ margin: 0 }}>No replies yet.</p>}
              {(detail.replies || []).map((r: any) => (
                <div key={r.id} className="jetz-card" style={{ margin: 0, borderLeft: r.is_internal ? '3px solid var(--jetz-warn, #d97706)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <strong style={{ fontSize: 13.5 }}>
                      {r.author_name || 'User'}
                      {r.is_internal && <span className="jetz-badge jetz-badge-amber" style={{ marginLeft: 8 }}>internal note</span>}
                    </strong>
                    <span style={{ fontSize: 12, color: 'var(--jetz-faint)' }}>{(r.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }}>{r.body}</div>
                  {(r.attachments || []).length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {(r.attachments || []).map((a: any) => (
                        <a key={a.id} href={a.file} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>
                          <Paperclip style={{ width: 12, height: 12, verticalAlign: '-2px' }} /> {a.file_name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {can('support.reply') ? (
              <form onSubmit={postReply} style={{ marginTop: 12 }}>
                <span className="jetz-label">Reply</span>
                <textarea className="jetz-input" rows={3} placeholder="Type your reply…" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
                {canManage && (
                  <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={replyInternal} onChange={(e) => setReplyInternal(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--jetz-accent)' }} />
                    Internal note (hidden from the raiser)
                  </label>
                )}
                <div style={{ marginTop: 10 }}>
                  <Button type="submit" variant="accent" disabled={replyBusy || !replyBody.trim()}>
                    <Send style={{ width: 14, height: 14 }} /> {replyBusy ? 'Sending…' : 'Send reply'}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="jetz-note" style={{ marginTop: 12 }}>You need the <strong>support.reply</strong> permission to reply.</p>
            )}
          </Section>

          <Section title={`Attachments (${(detail.attachments || []).length})`} sub="">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <Can code="support.reply">
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
                (a.created_at || '').slice(0, 16).replace('T', ' '),
              ])}
              empty="No attachments."
            />
          </Section>
        </Drawer>
      )}
    </div>
  );
}
