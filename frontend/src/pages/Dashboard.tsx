import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Gauge,
  Hourglass,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import {
  BarList,
  Button,
  DataTable,
  Donut,
  Empty,
  PageHeader,
  Pie,
  RefreshButton,
  Section,
  SkeletonGrid,
  StatCard,
  Toast,
  formatINR,
  formatNum,
  useAsync,
} from '../components/ui';

const CHART_COLORS: Record<string, string> = {
  present: '#16A34A',
  active: '#16A34A',
  paid: '#16A34A',
  completed: '#16A34A',
  sent: '#16A34A',
  delivered: '#16A34A',
  absent: '#DC2626',
  cancelled: '#DC2626',
  failed: '#DC2626',
  overdue: '#DC2626',
  suspended: '#DC2626',
  late: '#D97706',
  pending: '#D97706',
  due: '#D97706',
  partially_paid: '#0D9488',
  leave: '#7C3AED',
  upcoming: '#FF6B2C',
  in_progress: '#FF6B2C',
  queued: '#64748B',
  read: '#0EA5E9',
  not_marked: '#94A3B8',
  inactive: '#94A3B8',
  withdrawn: '#94A3B8',
  refunded: '#94A3B8',
};

const colorFor = (key: string) => CHART_COLORS[key] || '#102A56';

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => api.get('/reports/dashboard/').then((r) => r.data));
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="JETZ Academy / Overview / Dashboard" title="Dashboard" sub="Live academy statistics across students, sessions and fees." />
        <SkeletonGrid count={12} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <PageHeader
          eyebrow="JETZ Academy / Overview / Dashboard"
          title="Dashboard"
          sub="Live academy statistics across students, sessions and fees."
          actions={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}
        />
        <Toast msg={`Failed to load dashboard: ${error || 'unknown error'}`} kind="danger" />
      </div>
    );
  }

  const d = data;
  const perSport = (d.students.per_sport || []).map((r: any) => ({
    label: r.sport__name || 'Unassigned',
    value: Number(r.count) || 0,
  }));
  const waEntries = Object.entries(d.whatsapp || {}) as Array<[string, any]>;
  const attPresent = Number(d.attendance.present) || 0;
  const attAbsent = Number(d.attendance.absent) || 0;
  const attLate = Number(d.attendance.late) || 0;
  const attLeave = Number(d.attendance.leave) || 0;
  const attNotMarked = Number(d.attendance.not_marked) || 0;
  const attMarked = Number(d.attendance.marked) || 0;
  // Attendance donut: percentages use MARKED records as the base;
  // Not Marked rows are reported separately, never in the base.
  const attPct = (n: number) => (attMarked ? Math.round((100 * n) / attMarked) : 0);
  const attSegments = [
    { value: attPresent, color: colorFor('present'), label: `Present · ${attPct(attPresent)}%` },
    { value: attAbsent, color: colorFor('absent'), label: `Absent · ${attPct(attAbsent)}%` },
    { value: attLate, color: colorFor('late'), label: `Late · ${attPct(attLate)}%` },
    { value: attLeave, color: colorFor('leave'), label: `Leave · ${attPct(attLeave)}%` },
  ].filter((s) => s.value > 0);
  const statusPie = (block: Record<string, any>) =>
    Object.entries(block || {}).map(([k, v]) => ({
      label: String(k).replace(/_/g, ' '),
      value: Number(v) || 0,
      color: colorFor(k),
    })).filter((s) => s.value > 0);
  const distPie = (rows: any[]) =>
    (rows || []).map((r) => ({
      label: `${r.label}${r.pct != null ? ` · ${r.pct}%` : ''}`,
      value: Number(r.count) || 0,
      color: colorFor(String(r.value || '').toLowerCase()),
    })).filter((s) => s.value > 0);

  return (
    <div>
      <PageHeader
        eyebrow="JETZ Academy / Overview / Dashboard"
        title="Dashboard"
        sub="Live academy statistics across students, sessions and fees."
        actions={<RefreshButton onClick={reload} loading={false} />}
      />
      <div className="jetz-hero">
        <div>
          <div className="jetz-hero-eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div className="jetz-hero-title">{greet}, {user?.username || 'Coach'}</div>
          <div className="jetz-hero-sub">
            {formatNum(d.sessions.today)} sessions today · {d.attendance.percentage}% attendance · {formatINR(d.fees.collected)} collected
          </div>
        </div>
        <div className="jetz-hero-mark" aria-hidden="true">{(user?.username || 'J').charAt(0).toUpperCase()}</div>
      </div>

            {d.schools && (
        <Section title="Schools" sub={`${formatNum(d.schools.total)} onboarded · live status`}>
          <div className="jetz-stat-grid">
            <StatCard label="Schools Onboarded" value={formatNum(d.schools.total)} icon={<Building2 />} accent />
            <StatCard label="Active Schools" value={formatNum(d.schools.active)} icon={<BadgeCheck />} />
            <StatCard label="Students in Schools" value={formatNum((d.schools.schools || []).reduce((a: number, s: any) => a + (Number(s.students) || 0), 0))} icon={<Users />} />
            <StatCard label="Sessions Today (all schools)" value={formatNum((d.schools.schools || []).reduce((a: number, s: any) => a + (Number(s.sessions_today) || 0), 0))} icon={<CalendarDays />} />
          </div>
          <div className="jetz-card" style={{ marginTop: 14 }}>
            <div className="jetz-panel-title">Live status per school</div>
            <div className="jetz-panel-sub">Students · batches · coaches · today's sessions</div>
            <DataTable
              columns={['School', 'Students', 'Batches', 'Coaches', 'Today', 'Status']}
              rows={(d.schools.schools || []).map((s: any) => [
                s.name,
                formatNum(s.students),
                formatNum(s.batches),
                formatNum(s.coaches),
                formatNum(s.sessions_today),
                s.active ? 'Active' : 'Inactive',
              ])}
            />
          </div>
        </Section>
      )}

      <Section title="Students" sub={`${formatNum(d.students.total)} enrolled`}>        <div className="jetz-stat-grid">
          <StatCard label="Total Students" value={formatNum(d.students.total)} icon={<Users />} accent />
          <StatCard label="Active Students" value={formatNum(d.students.active)} icon={<UserCheck />} />
          <StatCard label="New This Month" value={formatNum(d.students.new_this_month)} icon={<UserPlus />} />
          <StatCard label="Active Sports" value={formatNum(d.sports.active)} icon={<Trophy />} />
        </div>
        <div className="jetz-panel-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
          <div className="jetz-card">
            <div className="jetz-panel-title">Enrolment by sport</div>
            <div className="jetz-panel-sub">Live student counts per sport</div>
            {perSport.length ? <BarList items={perSport} /> : <Empty />}
          </div>
          <div className="jetz-card">
            <div className="jetz-panel-title">Coaches today</div>
            <div className="jetz-panel-sub">Staffing snapshot</div>
            <div className="jetz-bar-row"><span className="jetz-bar-label">Total coaches</span><strong>{formatNum(d.coaches.total)}</strong></div>
            <div className="jetz-bar-row"><span className="jetz-bar-label">Active</span><strong>{formatNum(d.coaches.active)}</strong></div>
            <div className="jetz-bar-row"><span className="jetz-bar-label">Today's sessions</span><strong>{formatNum(d.coaches.today_sessions)}</strong></div>
          </div>
        </div>
      </Section>

      <Section title="Sessions & Attendance" sub="Today's schedule and turnout">
        <div className="jetz-stat-grid">
          <StatCard label="Today's Sessions" value={formatNum(d.sessions.today)} icon={<CalendarDays />} />
          <StatCard label="Completed Sessions" value={formatNum(d.sessions.completed)} icon={<CheckCircle2 />} />
          <StatCard
            label="Present Students"
            value={formatNum(d.attendance.present)}
            sub={`${formatNum(d.attendance.absent)} absent · ${formatNum(attMarked)} marked`}
            icon={<ClipboardCheck />}
          />
          <StatCard label="Attendance Percentage" value={`${d.attendance.percentage}%`} icon={<Gauge />} accent />
        </div>
        <div className="jetz-panel-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="jetz-card">
            <div className="jetz-panel-title">Attendance today</div>
            <div className="jetz-panel-sub">{attMarked ? `${formatNum(attMarked)} records marked` : 'No attendance marked yet today'}</div>
            {attMarked ? (
              <Donut
                segments={[
                  { value: attPresent, color: '#16A34A', label: 'Present' },
                  { value: attAbsent, color: '#DC2626', label: 'Absent' },
                ]}
                centerLabel={`${d.attendance.percentage}%`}
                centerSub="present"
              />
            ) : (
              <Empty message="No attendance records for today yet." />
            )}
          </div>
          <div className="jetz-card">
            <div className="jetz-panel-title">Session activity</div>
            <div className="jetz-panel-sub">Today vs upcoming vs cancelled</div>
            <BarList
              items={[
                { label: 'Today', value: Number(d.sessions.today) || 0, color: '#102A56' },
                { label: 'Completed', value: Number(d.sessions.completed) || 0, color: '#16A34A' },
                { label: 'Upcoming', value: Number(d.sessions.upcoming) || 0, color: '#FF6B2C' },
                { label: 'Cancelled', value: Number(d.sessions.cancelled) || 0, color: '#DC2626' },
              ]}
            />
          </div>
        </div>
      </Section>

      <Section title="Fees & Payments" sub="Collections and verification status">
        <div className="jetz-stat-grid">
          <StatCard label="Fees Collected" value={formatINR(d.fees.collected)} icon={<Wallet />} accent />
          <StatCard label="Pending Fees" value={formatINR(d.fees.pending)} icon={<Hourglass />} />
          <StatCard label="Overdue Fees" value={formatINR(d.fees.overdue)} icon={<AlertTriangle />} />
          <StatCard
            label="Payments Successful / Failed"
            value={`${formatNum(d.payments.success)} / ${formatNum(d.payments.failed)}`}
            sub={`${formatNum(d.payments.pending)} pending verification`}
            icon={<CreditCard />}
          />
        </div>
        <div className="jetz-panel-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
          <div className="jetz-card">
            <div className="jetz-panel-title">Fee collection</div>
            <div className="jetz-panel-sub">Collected vs pending vs overdue</div>
            <BarList
              items={[
                { label: 'Collected', value: Number(d.fees.collected) || 0, color: '#16A34A' },
                { label: 'Pending', value: Number(d.fees.pending) || 0, color: '#D97706' },
                { label: 'Overdue', value: Number(d.fees.overdue) || 0, color: '#DC2626' },
              ]}
            />
            <div className="jetz-legend">
              <span><i style={{ background: '#16A34A' }} />Collected {formatINR(d.fees.collected)}</span>
              <span><i style={{ background: '#D97706' }} />Pending {formatINR(d.fees.pending)}</span>
              <span><i style={{ background: '#DC2626' }} />Overdue {formatINR(d.fees.overdue)}</span>
            </div>
          </div>
          <div className="jetz-card">
            <div className="jetz-panel-title">Trainer payouts</div>
            <div className="jetz-panel-sub">Payable vs paid to date</div>
            <div className="jetz-bar-row"><span className="jetz-bar-label">Payable</span><strong>{formatINR(d.trainer_fees.payable)}</strong></div>
            <div className="jetz-bar-row"><span className="jetz-bar-label">Paid</span><strong>{formatINR(d.trainer_fees.paid)}</strong></div>
            <div className="jetz-panel-sub" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BadgeCheck style={{ width: 14, height: 14 }} /> Verified in Trainer Fees module
            </div>
          </div>
        </div>
      </Section>

      <Section title="Breakdown" sub="Sport-wise enrolment and messaging status">
        <div className="jetz-panel-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div className="jetz-panel-title" style={{ marginBottom: 8 }}>Sport-wise students</div>
            <DataTable
              columns={['Sport', 'Count']}
              rows={(d.students.per_sport || []).map((r: any) => [r.sport__name || '-', String(r.count)])}
            />
          </div>
          <div>
            <div className="jetz-panel-title" style={{ marginBottom: 8 }}>WhatsApp status</div>
            <DataTable columns={['Status', 'Count']} rows={waEntries.map(([k, v]) => [k, String(v as any)])} />
          </div>
        </div>
      </Section>
    </div>
  );
}

export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <PageHeader eyebrow="JETZ Academy" title={title} sub="Module wired to live backend APIs." />
    </div>
  );
}
