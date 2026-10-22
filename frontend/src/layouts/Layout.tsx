import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FolderOpen,
  HeartHandshake,
  IndianRupee,
  KeyRound,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessageCircle,
  PanelLeftClose,
  ScrollText,
  Settings,
  ShieldCheck,
  Trophy,
  User,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAcademyBrand } from '../api/settings';
import { ROUTE_PERMS } from '../api/rbac';
import api from '../api/client';

type Link = { to: string; label: string; Icon: any; end?: boolean };
const groups: Array<{ title: string; links: Link[] }> = [
  { title: 'Overview', links: [{ to: '/', label: 'Dashboard', Icon: LayoutDashboard, end: true }] },
  {
    title: 'Academy',
    links: [
      { to: '/sports', label: 'Sports', Icon: Trophy },
      { to: '/students', label: 'Students', Icon: Users },
      { to: '/parents', label: 'Parents', Icon: HeartHandshake },
      { to: '/batches', label: 'Batches', Icon: Layers },
      { to: '/sessions', label: 'Sessions', Icon: CalendarDays },
      { to: '/timetable', label: 'Timetable', Icon: CalendarDays },
      { to: '/attendance', label: 'Attendance', Icon: ClipboardCheck },
      { to: '/trainer-attendance', label: 'Trainer Attendance', Icon: ShieldCheck },
      { to: '/trainers', label: 'Trainers', Icon: ShieldCheck },
      { to: '/documents', label: 'Documents', Icon: FolderOpen },
    ],
  },
  {
    title: 'Finance',
    links: [
      { to: '/fees', label: 'Fees', Icon: Wallet },
      { to: '/payments', label: 'Payments', Icon: CreditCard },
      { to: '/trainer-fees', label: 'Trainer Fees', Icon: IndianRupee },
    ],
  },
  {
    title: 'Insights',
    links: [
      { to: '/reports', label: 'Reports', Icon: BarChart3 },
      { to: '/whatsapp', label: 'WhatsApp', Icon: MessageCircle },
      { to: '/notifications', label: 'Notifications', Icon: Bell },
      { to: '/support', label: 'Support', Icon: LifeBuoy },
      { to: '/customization', label: 'Customization', Icon: Wrench },
      { to: '/audit', label: 'Audit Logs', Icon: ScrollText },
    ],
  },
  {
    title: 'Admin',
    links: [
      { to: '/schools', label: 'Schools', Icon: Layers },
      { to: '/users', label: 'Users', Icon: ShieldCheck },
      { to: '/roles', label: 'Roles', Icon: Users },
      { to: '/settings', label: 'Settings', Icon: Settings },
    ],
  },
];

const greetingFor = (h = new Date().getHours()): string => {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

function useUnreadCount(): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let live = true;
    const fetchCount = () => {
      if (document.visibilityState !== 'visible') return;
      api
        .get('/notifications/', { params: { is_read: false, page_size: 1 } })
        .then((r) => {
          if (!live) return;
          const n = typeof r.data?.count === 'number' ? r.data.count : 0;
          setUnread(n);
        })
        .catch(() => {});
    };
    fetchCount();
    const t = setInterval(fetchCount, 30000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  return unread;
}

export default function Layout() {
  const { user, logout, can, refresh, isSuper } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Collapsible nav groups: only the active group opens by default.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('jetz_nav_open') || '{}');
    } catch {
      return {};
    }
  });
  const loc = useLocation();
  const nav = useNavigate();
  const unread = useUnreadCount();
  const brand = useAcademyBrand();
  // Navigation follows effective permissions (refreshed from the server on
  // every route change, so grants/revokes re-shape the menu without re-login).
  useEffect(() => { refresh(); }, [loc.pathname]);
  // Platform-only modules: academy admins never manage schools or customization.
  const superOnly = new Set(['/schools', '/customization']);
  const visibleGroups = groups
    .map((g) => ({ ...g, links: g.links.filter((l) => (isSuper() || !superOnly.has(l.to)) && can(ROUTE_PERMS[l.to] || 'reports.view')) }))
    .filter((g) => g.links.length > 0);
  const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 1024;

  const toggle = () => {
    if (isMobile()) setMobileOpen((v) => !v);
    else setCollapsed((v) => !v);
  };
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shortDate = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const initial = (user?.username || 'C').charAt(0).toUpperCase();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [loc.pathname]);

  // Keep the active group open on navigation; persist manual toggles.
  const activeGroup = visibleGroups.find((g) => g.links.some((l) => l.to === loc.pathname))?.title;
  useEffect(() => {
    if (!activeGroup) return;
    setOpenGroups((prev) => {
      if (prev[activeGroup]) return prev;
      const next = { ...prev, [activeGroup]: true };
      try {
        localStorage.setItem('jetz_nav_open', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [activeGroup]);
  const toggleGroup = (title: string) =>
    setOpenGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        localStorage.setItem('jetz_nav_open', JSON.stringify(next));
      } catch {}
      return next;
    });

    useEffect(() => {
        const label = groups.flatMap((g) => g.links).find((l) => l.to === loc.pathname)?.label
            || (loc.pathname === '/' ? 'Dashboard' : '');
        // Tab shows section + account so side-by-side portals stay distinguishable.
        document.title = [label, user?.username, brand.name].filter(Boolean).join(' · ') || brand.name;
    }, [brand.name, loc.pathname, user?.username]);

  return (
    <div className={`jetz-app${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      {mobileOpen && <button aria-label="Close menu" className="jetz-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className="jetz-sidebar" aria-label="Primary navigation">
        <div className="jetz-brand">
          <div className="jetz-brand-mark" aria-hidden="true">{(brand.name.trim().charAt(0) || '★').toUpperCase()}</div>
          <div className="jetz-brand-text">
            {brand.name.trim() ? <div className="jetz-brand-name" title={brand.name}>{brand.name.trim()}</div> : null}
            {brand.tagline.trim() ? <div className="jetz-brand-sub" title={brand.tagline}>{brand.tagline.trim()}</div> : null}
          </div>
        </div>
        <nav className="jetz-nav">
          {visibleGroups.length === 0 && (
            <div className="jetz-nav-empty">
              No modules assigned yet.
              <span>Ask your Super Admin to grant this account access.</span>
            </div>
          )}
          {visibleGroups.map((g) => {
            const isOpen = collapsed ? true : !!openGroups[g.title];
            const hasActive = g.links.some((l) => l.to === loc.pathname);
            return (
              <div key={g.title}>
                {collapsed ? (
                  <div className="jetz-nav-group">{g.title}</div>
                ) : (
                  <button
                    type="button"
                    className={`jetz-nav-toggle${hasActive ? ' has-active' : ''}`}
                    aria-expanded={isOpen}
                    onClick={() => toggleGroup(g.title)}
                    title={`${isOpen ? 'Collapse' : 'Expand'} ${g.title}`}
                  >
                    <span className="jetz-nav-group" style={{ padding: 0 }}>{g.title}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                      <span className="jetz-nav-count">{g.links.length}</span>
                      <svg className={`jetz-nav-chev${isOpen ? ' open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </button>
                )}
                {isOpen &&
                  g.links.map(({ to, label, Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => `jetz-nav-link${isActive ? ' active' : ''}`}
                      title={label}
                    >
                      <Icon />
                      <span className="lbl">{label}</span>
                      {to === '/notifications' && unread > 0 && (
                        <span
                          className="lbl"
                          style={{
                            marginLeft: 'auto',
                            background: 'var(--jetz-accent)',
                            color: '#fff',
                            fontSize: 10.5,
                            fontWeight: 700,
                            borderRadius: 999,
                            padding: '1px 7px',
                          }}
                        >
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </NavLink>
                  ))}
              </div>
            );
          })}
        </nav>
        <div className="jetz-sidebar-foot">
          <button onClick={() => logout()} className="jetz-logout-btn">
            <LogOut />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="jetz-main">
        <header className="jetz-topbar">
          <button className="jetz-icon-btn jetz-menu-btn" onClick={toggle} aria-label="Toggle navigation" title="Toggle sidebar">
            {collapsed && !isMobile() ? <PanelLeftClose /> : <Menu />}
          </button>
          <span className="jetz-topbar-vdiv" aria-hidden="true" />
          <div className="jetz-topbar-main">
            <div className="jetz-topbar-heading">
              <span className="jetz-topbar-greet">
                {greetingFor()}, <strong>{user?.username || 'Administrator'}</strong>
              </span>
            </div>
          </div>
          <div className="jetz-topbar-side">
            <span className="jetz-date-pill" title={today}>
              <CalendarDays aria-hidden="true" /> {shortDate}
            </span>
            <button
              className="jetz-icon-btn jetz-bell"
              onClick={() => nav('/notifications')}
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              title="Notifications"
            >
              <Bell />
              {unread > 0 && <span className="jetz-bell-dot">{unread > 99 ? '99+' : unread}</span>}
            </button>
            <span className="jetz-topbar-divider" aria-hidden="true" />
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                className={`jetz-profile-chip${menuOpen ? ' open' : ''}`}
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                style={{ cursor: 'pointer', font: 'inherit' }}
              >
                <span className="jetz-avatar-wrap">
                  <span className="jetz-avatar" title={user?.username || 'user'}>
                    {initial}
                  </span>
                  <span className="jetz-status-dot" aria-hidden="true" />
                </span>
                <span className="who">
                  <b>{user?.username || '—'}</b>
                  <span>{user?.role_name || 'Administrator'}</span>
                </span>
                <ChevronDown className="jetz-chip-chevron" aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className="jetz-profile-menu" role="menu">
                  <div className="jetz-profile-menu-head">
                    <span className="jetz-avatar" aria-hidden="true">{initial}</span>
                    <div>
                      <b>{user?.username || '—'}</b>
                      <span>{user?.role_name || 'Administrator'}</span>
                    </div>
                  </div>
                  <button role="menuitem" onClick={() => nav('/account')}>
                    <KeyRound /> Change password
                  </button>
                  <button role="menuitem" onClick={() => nav('/settings')}>
                    <Settings /> Academy settings
                  </button>
                  <button role="menuitem" onClick={() => nav('/notifications')}>
                    <Bell /> Notifications
                    {unread > 0 ? <span className="jetz-menu-count">{unread > 99 ? '99+' : unread}</span> : null}
                  </button>
                  <button role="menuitem" onClick={() => nav('/')}>
                    <User /> My dashboard
                  </button>
                  <div className="jetz-menu-sep" aria-hidden="true" />
                  <button role="menuitem" className="danger" onClick={() => logout()}>
                    <LogOut /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="jetz-content">
          <Outlet />
        </main>
        <footer style={{ padding: '14px 24px 20px', fontSize: 12, color: 'var(--jetz-faint)', textAlign: 'center' }}>
          {brand.name} · <Link to="/audit" style={{ color: 'inherit' }}>Audit trail enabled</Link> · Role-based access enforced
        </footer>
      </div>
    </div>
  );
}
