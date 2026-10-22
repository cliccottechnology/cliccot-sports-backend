import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, CheckCircle2, Inbox, Info, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAcademyBrand } from '../api/settings';
import { PORTAL_PATHS, canUsePortal, homeFor } from '../api/rbac';
import { errMsg } from '../api/client';

/* ---------- formatting (live data only) ---------- */
export const formatINR = (n: number | string) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const formatNum = (n: number | string) => Number(n || 0).toLocaleString('en-IN');

/* ---------- Button (navy default, orange = key actions) ---------- */
type BtnVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export function Button({
  variant = 'primary',
  size,
  block,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm'; block?: boolean }) {
  const cls = ['jetz-btn', `jetz-btn-${variant}`, size === 'sm' ? 'jetz-btn-sm' : '', block ? 'jetz-btn-block' : '', className || '']
    .filter(Boolean)
    .join(' ');
  return <button className={cls} {...rest} />;
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} disabled={loading} title="Refresh dashboard data">
      <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'jetz-spin 1s linear infinite' : undefined }} />
      {loading ? 'Refreshing…' : 'Refresh'}
    </Button>
  );
}

/* ---------- Form ---------- */
/* Required-marker: Field adds the red asterisk itself, unless the label
   already ends with one (older call sites pass "Name *"). */
const needsStar = (label?: string, required?: boolean) =>
  !!required && !!label && !/\*\s*$/.test(label);

export function Field({
  label,
  error,
  hint,
  required,
  children,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string; required?: boolean; children?: React.ReactNode }) {
  // If children are provided, render as a wrapped custom control (e.g. file input trigger).
  if (children !== undefined) {
    return (
      <span className="jetz-field" style={{ display: 'block', minWidth: 180, flex: '1 1 180px' }}>
        {label && (
          <span className="jetz-label">
            {label} {needsStar(label, required) && <span className="jetz-req" aria-hidden="true">*</span>}
          </span>
        )}
        {children}
        {error && (
          <span className="jetz-field-err" role="alert">
            {error}
          </span>
        )}
        {!error && hint && <span className="jetz-field-hint">{hint}</span>}
      </span>
    );
  }
  return (
    <label className="jetz-field" style={{ display: 'block', minWidth: 180, flex: '1 1 180px' }}>
      {label && (
        <span className="jetz-label">
          {label} {needsStar(label, required) ? <span className="jetz-req" aria-hidden="true">*</span> : null}
        </span>
      )}
      <input className={`jetz-input${error ? ' invalid' : ''}`} aria-invalid={!!error} required={required} {...props} />
      {error && (
        <span className="jetz-field-err" role="alert">
          {error}
        </span>
      )}
      {!error && hint && <span className="jetz-field-hint">{hint}</span>}
    </label>
  );
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="jetz-select" style={{ width: 'auto', minWidth: 180 }} {...props} />;
}

/* ---------- Feedback ---------- */
const TOAST_ICON = {
  warning: AlertTriangle,
  danger: AlertTriangle,
  success: CheckCircle2,
  info: Info,
} as const;
export function Toast({ msg, kind = 'warning' }: { msg: string; kind?: 'warning' | 'danger' | 'success' | 'info' }) {
  if (!msg) return null;
  const Icon = TOAST_ICON[kind] || Info;
  return (
    <div role="alert" className={`jetz-alert jetz-alert-${kind} jetz-toast-in`}>
      <Icon className="jetz-alert-icon" aria-hidden="true" />
      <span>{msg}</span>
    </div>
  );
}
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="jetz-loading" aria-busy="true" aria-live="polite">
      <span className="jetz-spinner jetz-spinner-lg" />
      <span>{label}</span>
    </div>
  );
}
export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="jetz-stat-grid" aria-busy="true" aria-label="Loading statistics">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="jetz-skeleton" />
      ))}
    </div>
  );
}
export function Empty({ message = 'No records found.', title, action }: { message?: string; title?: string; action?: React.ReactNode }) {
  return (
    <div className="jetz-state-wrap">
      <div className="jetz-state-icon"><Inbox /></div>
      {title && <div className="jetz-state-title">{title}</div>}
      <div className="jetz-state-sub">{message}</div>
      {action}
    </div>
  );
}

/* ---------- Data display ---------- */
export function PageHeader({
  title,
  sub,
  actions,
  eyebrow,
  count,
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
  count?: number | string;
}) {
  // Breadcrumbs are written with the default brand ("JETZ Academy / …").
  // Swap the leading segment for the live academy name from Settings; if the
  // name is unavailable the segment is dropped rather than shown hardcoded.
  const brand = useAcademyBrand();
  const brandName = brand.name.trim();
  const parts = (eyebrow || '').split('/');
  if (parts.length && parts[0].trim().toUpperCase().replace(/\s+/g, ' ') === 'JETZ ACADEMY') {
    parts[0] = brandName;
  }
  const crumbs = parts.map((p) => p.trim()).filter((p) => p.length > 0);
  return (
    <div className="jetz-page-head">
      <div style={{ minWidth: 0 }}>
        {eyebrow && crumbs.length > 0 && (
          <div className="jetz-page-eyebrow" aria-label="Breadcrumb">
            {crumbs.map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && <span className="sep">/</span>}
              </span>
            ))}
          </div>
        )}
        <h1>
          {title}
          {count !== undefined && count !== '' && <span className="jetz-count-chip">{count}</span>}
        </h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="jetz-page-actions">{actions}</div>}
    </div>
  );
}
export function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="jetz-section">
      <div className="jetz-section-head">
        <h2>{title}</h2>
        {sub && <span style={{ fontSize: 12, color: 'var(--jetz-muted)' }}>{sub}</span>}
      </div>
      {children}
    </section>
  );
}
/** @deprecated use Section instead */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="jetz-section-title">{children}</h3>;
}

/** Legacy card (kept for compatibility) */
export function Card({ title, value, sub }: { title: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="jetz-card jetz-stat-card">
      <div>
        <div className="jetz-stat-label" style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>{title}</div>
        <div className="jetz-stat-value">{value}</div>
        {sub && <div className="jetz-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}
export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="jetz-stat-grid">{children}</div>;
}

/** Premium stat card — navy chip default, orange chip for highlight metrics */
export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="jetz-card jetz-stat-card">
      <div className={`jetz-stat-icon${accent ? ' accent' : ''}`}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="jetz-stat-label">{label}</div>
        <div className="jetz-stat-value">{value}</div>
        {sub && <div className="jetz-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ---------- Charts (pure SVG/CSS, live data only — no chart lib) ---------- */
export function Donut({
  segments,
  size = 148,
  thickness = 18,
  centerLabel,
  centerSub,
}: {
  segments: Array<{ value: number; color: string; label: string }>;
  size?: number;
  thickness?: number;
  centerLabel: string;
  centerSub?: string;
}) {
  const total = segments.reduce((a, s) => a + (Number(s.value) || 0), 0) || 1;
  const R = (size - thickness) / 2;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="#EDF1F7" strokeWidth={thickness} />
          {segments.map((s, i) => {
            const frac = (Number(s.value) || 0) / total;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${frac * C} ${C - frac * C}`}
                strokeDashoffset={-acc * C}
                strokeLinecap="butt"
              />
            );
            acc += frac;
            return el;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{centerLabel}</div>
            {centerSub && <div style={{ fontSize: 11.5, color: 'var(--jetz-muted)' }}>{centerSub}</div>}
          </div>
        </div>
      </div>
      <div className="jetz-legend" style={{ flexDirection: 'column', gap: 8, marginTop: 0 }}>
        {segments.map((s, i) => (
          <span key={i}>
            <i style={{ background: s.color }} />
            {s.label} — <strong style={{ color: 'var(--jetz-text)' }}>{formatNum(s.value)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Pie chart (solid slices) for category distribution. Pure SVG, no deps. */
export function Pie({
  segments,
  size = 168,
}: {
  segments: Array<{ value: number; color: string; label: string }>;
  size?: number;
}) {
  const total = segments.reduce((a, s) => a + (Number(s.value) || 0), 0);
  const R = size / 2;
  if (!total) return <Empty message="No data for this chart yet." />;
  let acc = 0;
  const polar = (frac: number) => {
    const a = (acc + frac) * 2 * Math.PI - Math.PI / 2;
    return [R + R * Math.cos(a), R + R * Math.sin(a)];
  };
  const paths = segments.map((s) => {
    const frac = (Number(s.value) || 0) / total;
    const [x0, y0] = polar(0);
    acc += frac;
    const [x1, y1] = polar(0);
    return { s, frac, x0, y0, x1, y1 };
  });
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }} role="img" aria-label="Pie chart">
        {paths.map((p, i) =>
          p.frac <= 0 ? null : p.frac >= 1 ? (
            <circle key={i} cx={R} cy={R} r={R} fill={p.s.color} />
          ) : (
            <path
              key={i}
              d={`M ${R} ${R} L ${p.x0.toFixed(2)} ${p.y0.toFixed(2)} A ${R} ${R} 0 ${p.frac > 0.5 ? 1 : 0} 1 ${p.x1.toFixed(2)} ${p.y1.toFixed(2)} Z`}
              fill={p.s.color}
            />
          ),
        )}
      </svg>
      <div className="jetz-legend" style={{ flexDirection: 'column', gap: 8, marginTop: 0 }}>
        {segments.map((s, i) => {
          const pct = total ? Math.round((100 * (Number(s.value) || 0)) / total) : 0;
          return (
            <span key={i}>
              <i style={{ background: s.color }} />
              {s.label} — <strong style={{ color: 'var(--jetz-text)' }}>{formatNum(s.value)} ({pct}%)</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function BarList({ items }: { items: Array<{ label: string; value: number; color?: string }> }) {  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  if (!items.length) return <Empty />;
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} className="jetz-bar-row">
          <span className="jetz-bar-label" title={it.label}>
            {it.label}
          </span>
          <div className="jetz-bar-track">
            <div className="jetz-bar-fill" style={{ width: `${(100 * (Number(it.value) || 0)) / max}%`, background: it.color || 'var(--jetz-primary)' }} />
          </div>
          <span className="jetz-bar-val">{formatNum(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

const badgeMap = (v: string) => {
  const s = (v || '').toLowerCase();
  if (['active', 'paid', 'success', 'delivered', 'completed', 'verified', 'present', 'resolved', 'approved'].includes(s)) return 'green';
  if (['pending', 'due', 'initiated', 'late', 'leave', 'scheduled', 'in_progress', 'assigned', 'clarification_required'].includes(s)) return 'amber';
  if (['overdue', 'failed', 'cancelled', 'absent', 'inactive', 'rejected'].includes(s)) return 'red';
  if (['not_marked', 'refunded', 'closed', 'draft'].includes(s)) return 'grey';
  return 'blue';
};
export function StatusBadge({ value }: { value: string }) {
  return <span className={`jetz-badge jetz-badge-${badgeMap(value)}`}>{value?.replace(/_/g, ' ')}</span>;
}

export function DataTable({ columns, rows, empty = 'No records found.' }: { columns: string[]; rows: any[][]; empty?: string }) {
  if (!rows.length) {
    return (
      <div className="jetz-table-wrap">
        <Empty message={empty} />
      </div>
    );
  }
  return (
    <div className="jetz-table-wrap">
      <table className="jetz-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useAsync<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  React.useEffect(() => {
    let live = true;
    setLoading(true);
    fn()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errMsg(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [tick]);
  return { data, loading, error, reload };
}

/* ---------- Enterprise primitives ---------- */

const AVATAR_HUES = [214, 222, 200, 168, 24, 0, 262, 190];
export function avatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

/** Identity avatar: photo when available, deterministic initial fallback otherwise. */
export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    return <img src={src} alt="" className="jetz-avatar-img" style={{ width: size, height: size }} loading="lazy" />;
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className="jetz-avatar-fallback"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `hsl(${avatarHue(name || '?')} 45% 32%)` }}
    >
      {initial}
    </span>
  );
}

/** Search input with icon and clear button. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <span className="jetz-field" style={{ display: 'block' }}>
      {label && <span className="jetz-label">{label}</span>}
      <span className="jetz-search-wrap">
        <Search aria-hidden="true" />
        <input
          className="jetz-input jetz-search-input"
          role="searchbox"
          aria-label={label || placeholder}
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
    </span>
  );
}

/** Card wrapper for search + filter controls with a live result count. */
export function FilterBar({ children, count, loading }: { children: React.ReactNode; count?: number; loading?: boolean }) {
  return (
    <div className="jetz-card" style={{ marginBottom: 14 }}>
      <div className="jetz-filterbar" style={{ marginBottom: 0 }}>
        {children}
        <span className="jetz-result-count" aria-live="polite">
          {loading ? 'Loading…' : count !== undefined ? (
            <><strong>{formatNum(count)}</strong> matching</>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/** Numbered form section with title + description. */
export function FormSection({
  index,
  title,
  desc,
  children,
}: {
  index: number;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="jetz-form-section">
      <div className="jetz-form-section-head">
        <div className="jetz-form-section-title">
          <span className="n">{index}</span> {title}
        </div>
        {desc && <p className="jetz-form-section-desc">{desc}</p>}
      </div>
      <div className="jetz-form-grid">{children}</div>
    </div>
  );
}

/** Accessible tabs (uncontrolled by default). */
export function Tabs({ tabs, initial = 0 }: { tabs: Array<{ id: string; label: string; content: React.ReactNode }>; initial?: number }) {
  const [active, setActive] = useState(initial);
  const current = tabs[Math.min(active, tabs.length - 1)];
  return (
    <div>
      <div className="jetz-tabs" role="tablist" aria-label="Details">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            className="jetz-tab"
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setActive((a) => (a + 1) % tabs.length);
              if (e.key === 'ArrowLeft') setActive((a) => (a - 1 + tabs.length) % tabs.length);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}

/** Right slide-over drawer for detail views. */
export function Drawer({
  title,
  eyebrow,
  sub,
  onClose,
  children,
}: {
  title: string;
  eyebrow?: string;
  sub?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <>
      <button aria-label="Close details" className="jetz-drawer-overlay" onClick={onClose} />
      <div className="jetz-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="jetz-drawer-head">
          {eyebrow && <div className="jetz-drawer-eyebrow">{eyebrow}</div>}
          <div className="jetz-drawer-title">{title}</div>
          {sub && <div className="jetz-drawer-sub">{sub}</div>}
          <Button size="sm" variant="secondary" onClick={onClose} aria-label="Close details" className="jetz-drawer-close">
            ✕ Close
          </Button>
        </div>
        <div className="jetz-drawer-body">{children}</div>
      </div>
    </>
  );
}

/** Confirmation dialog for sensitive/destructive actions. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="jetz-modal-overlay" onClick={onCancel}>
      <div className="jetz-modal" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="jetz-modal-title">{title}</div>
        <div className="jetz-modal-sub">{message}</div>
        <div className="jetz-modal-actions">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'accent'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export type ProColumn = {
  key: string;
  label: string;
  sortable?: boolean;
  sortKey?: string;
  hideOnMobile?: boolean;
};

/** Premium table: sortable headers, skeleton rows, empty/error states, footer pagination. */
export function ProTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  emptyTitle = 'No records found',
  emptySub,
  emptyAction,
  sort,
  onSort,
  page,
  count,
  onPage,
  pageSize = 20,
}: {
  columns: ProColumn[];
  rows: React.ReactNode[][];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptySub?: string;
  emptyAction?: React.ReactNode;
  sort?: { key: string; dir: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  page?: number;
  count?: number;
  onPage?: (n: number) => void;
  pageSize?: number;
}) {
  const total = count !== undefined ? Math.max(1, Math.ceil(count / pageSize)) : 1;
  const showFoot = page !== undefined && onPage && (count || 0) > 0;
  const pages: number[] = [];
  if (showFoot && page !== undefined) {
    const start = Math.max(1, Math.min(page - 2, total - 4));
    for (let p = start; p <= Math.min(total, start + 4); p++) pages.push(p);
  }
  return (
    <div className="jetz-table-wrap">
      <div style={{ overflowX: 'auto' }}>
        <table className="jetz-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>
                  {c.sortable && onSort ? (
                    <button
                      type="button"
                      className={`jetz-sort-th${sort?.key === (c.sortKey || c.key) ? ' sorted' : ''}`}
                      onClick={() => onSort(c.sortKey || c.key)}
                      aria-label={`Sort by ${c.label}`}
                      aria-sort={sort?.key === (c.sortKey || c.key) ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      {c.label}
                      {sort?.key === (c.sortKey || c.key) ? (
                        sort.dir === 'asc' ? <ArrowUp /> : <ArrowDown />
                      ) : (
                        <ArrowUpDown />
                      )}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="jetz-skel-row" aria-hidden="true">
                  {columns.map((c) => (
                    <td key={c.key}>
                      <div className="jetz-skel-bar" style={{ width: `${55 + ((i * 13 + c.key.length * 7) % 40)}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={columns[j]?.key || j}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && error ? (
        <div className="jetz-state-wrap" role="alert">
          <div className="jetz-state-title">Couldn't load records</div>
          <div className="jetz-state-sub">{error}</div>
          {onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <div className="jetz-state-wrap">
          <div className="jetz-state-icon"><Inbox /></div>
          <div className="jetz-state-title">{emptyTitle}</div>
          {emptySub && <div className="jetz-state-sub">{emptySub}</div>}
          {emptyAction}
        </div>
      ) : null}
      {showFoot && page !== undefined && onPage ? (
        <div className="jetz-table-foot">
          <span>
            Page {page} of {total} · {formatNum(count || 0)} records
          </span>
          <div className="jetz-pager">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
              Prev
            </Button>
            {pages.map((p) => (
              <button key={p} type="button" className={`jetz-pager-num${p === page ? ' current' : ''}`} aria-label={`Page ${p}`} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>
                {p}
              </button>
            ))}
            <Button size="sm" variant="secondary" disabled={page >= total} onClick={() => onPage(page + 1)} aria-label="Next page">
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Definition-list rows for detail views. */
export function DetailRows({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="jetz-kv">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v || '—'}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/* ---------- Login ---------- */
const PORTAL_COPY: Record<string, { prefill: string; eyebrow: string; title: string; badge?: string; sub: (brand: string) => string; cta: string; wrongRole: string }> = {
  admin: {
    prefill: 'admin', eyebrow: 'Academy workspace', title: 'Welcome back',
    sub: (b) => `Sign in to ${b} to continue.`, cta: 'Sign in',
    wrongRole: '',
  },
  super: {
    prefill: 'hari', eyebrow: 'Restricted · super admin only', title: 'Super Admin', badge: 'super',
    sub: () => 'Full authority over users, roles, finances and settings.', cta: 'Sign in as Super Admin',
    wrongRole: 'This login is for Super Admins only. Use the academy login for staff accounts.',
  },
  trainer: {
    prefill: 'coach1', eyebrow: 'Trainer portal', title: 'Trainer sign in', badge: 'coach',
    sub: (b) => `Your sessions, athletes, attendance and earnings at ${b}.`, cta: 'Sign in as Trainer',
    wrongRole: 'This login is for trainers/coaches only.',
  },
  parent: {
    prefill: 'parent1', eyebrow: 'Parent portal', title: 'Parent sign in', badge: 'parent',
    sub: (b) => `Follow your child's sessions, attendance and fees at ${b}.`, cta: 'Sign in as Parent',
    wrongRole: 'This login is for parents only.',
  },
};

export function LoginPage({ mode = 'admin' }: { mode?: 'admin' | 'super' | 'trainer' | 'parent' }) {
  const { login, logout } = useAuth();
  const brand = useAcademyBrand();
  const brandName = brand.name.trim();
  const nav = useNavigate();
  const copy = PORTAL_COPY[mode];
  const params = new URLSearchParams(window.location.search);
  const [u, setU] = useState(copy.prefill);
  const [p, setP] = useState('');
  const [err, setErr] = useState(params.get('expired') ? 'Your session has expired. Please log in again.' : '');
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    document.title = brandName ? `${copy.title} — ${brandName}` : copy.title;
  }, [mode, brandName]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const me = await login(u, p);
      if (!canUsePortal(me, mode)) {
        await logout(PORTAL_PATHS[mode]);
        setErr(copy.wrongRole || 'This account cannot use this login page.');
        return;
      }
      nav(homeFor(me));
    } catch (ex: any) {
      setErr(errMsg(ex));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="jetz-login-wrap">
      <div className="jetz-login-side" aria-hidden="true">
        <div
          style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #FF7A3D, var(--jetz-accent-hover))',
            color: '#fff', display: 'inline-grid', placeItems: 'center',
            fontWeight: 800, fontSize: 24,
            boxShadow: '0 8px 24px rgba(255,107,44,.45), inset 0 1px 0 rgba(255,255,255,.35)',
          }}
        >
          {(brandName.charAt(0) || '★').toUpperCase()}
        </div>
        {brandName ? <h1>{brandName}</h1> : null}
        <p>{brand.tagline || 'The all-in-one workspace for training, attendance, fees and insight.'}</p>
        <ul className="jetz-login-points">
          <li><Check /><span>Sessions & attendance<small>Day-view scheduling, rosters, AI-assisted check-ins.</small></span></li>
          <li><Check /><span>Fees & payments<small>Plans, allocations, webhook-verified collections.</small></span></li>
          <li><Check /><span>Reports & audit<small>Live analytics, exports, and a full audit trail.</small></span></li>
        </ul>
      </div>
      <div className="jetz-login-main">
        <div style={{ width: 380, maxWidth: '100%' }}>
          <div style={{ marginBottom: 20 }}>
            <div className="jetz-page-eyebrow">{copy.eyebrow}</div>
            <h2 style={{ fontSize: 24, margin: '4px 0 6px' }}>
              {copy.title}{' '}
              {copy.badge && (
                <span className="jetz-badge jetz-badge-orange" style={{ verticalAlign: 'middle' }}>{copy.badge}</span>
              )}
            </h2>
            <p style={{ margin: 0, fontSize: 13.5 }}>{copy.sub(brandName || 'your academy')}</p>
          </div>
          <form onSubmit={submit} className="jetz-card" style={{ padding: 28, overflow: 'hidden', borderRadius: 16 }}>
            <div className="jetz-login-band" />
            <Toast msg={err} kind="danger" />
            <label>
              <span className="jetz-label">Username</span>
              <input className="jetz-input" value={u} onChange={(e) => setU(e.target.value)} placeholder="Username" autoComplete="username" />
            </label>
            <div style={{ height: 12 }} />
            <label>
              <span className="jetz-label">Password</span>
              <input
                className="jetz-input"
                value={p}
                onChange={(e) => setP(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
              />
            </label>
            <div style={{ height: 18 }} />
            <Button type="submit" variant="accent" block disabled={busy}>
              {busy ? 'Signing in…' : copy.cta}
            </Button>
            <p style={{ margin: '14px 0 0', fontSize: 12, textAlign: 'center', color: 'var(--jetz-faint)' }}>
              {mode === 'super' ? (
                <>Staff? Use the <a href="/login">academy login</a> instead.</>
              ) : mode === 'admin' ? (
                <>Super Admin? Use the <a href="/super-admin/login">super admin login</a>. Coach or parent? Use the <a href="/trainer/login">trainer</a> or <a href="/parent/login">parent</a> login.</>
              ) : mode === 'trainer' ? (
                <>Not a trainer? Use the <a href="/login">academy login</a> or <a href="/parent/login">parent login</a>.</>
              ) : (
                <>Not a parent? Use the <a href="/login">academy login</a> or <a href="/trainer/login">trainer login</a>.</>
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
