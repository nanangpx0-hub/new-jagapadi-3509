import {
  Activity,
  Bell,
  Bug,
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  FileText,
  House,
  LogOut,
  Map,
  MapPinned,
  Menu,
  PlusCircle,
  ScrollText,
  Search,
  ShieldCheck,
  Sprout,
  Users,
  X,
} from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { readXsrfToken } from '../lib/api';
import {
  listNotifications,
  listReports,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { useOfflineReports } from '../offline/use-offline-reports';
import { ThemeToggle } from './ThemeToggle';

const FieldSyncContext = createContext<ReturnType<typeof useOfflineReports> | null>(null);

export function useFieldSync() {
  const ctx = useContext(FieldSyncContext);
  if (!ctx) throw new Error('useFieldSync must be used within AppShell');
  return ctx;
}

/**
 * Status aktif menu. NavLink bawaan memakai prefix match sehingga "/reports"
 * ikut aktif di "/reports/new". Di sini "/reports" hanya aktif untuk daftar
 * laporan, detail/edit laporan, dan filter status yang sesuai.
 */
function navItemActive(to: string, pathname: string, search: string): boolean {
  const [path, query = ''] = to.split('?');
  if (path === '/reports') {
    if (pathname === '/reports') {
      const wantsSubmitted = new URLSearchParams(query).get('status') === 'Submitted';
      const showsSubmitted = new URLSearchParams(search).get('status') === 'Submitted';
      return wantsSubmitted === showsSubmitted;
    }
    return /^\/reports\/\d+(?:\/edit)?$/.test(pathname);
  }
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

const BREADCRUMB: Record<string, string> = {
  '/': 'Beranda',
  '/peta': 'Peta Sebaran GIS',
  '/fenomena': 'Rekap Fenomena BPS',
  '/reports': 'Daftar Laporan',
  '/reports/new': 'Buat Laporan Baru',
  '/wilayah': 'Master Wilayah & SLS',
  '/opts': 'Katalog OPT Pangan',
  '/users': 'Manajemen Pengguna',
  '/audit-logs': 'Audit Log Sistem',
  '/status': 'Status Sistem',
  '/akun': 'Pengaturan Akun',
};

function crumbs(pathname: string): string[] {
  const out: string[] = ['Beranda'];
  if (pathname === '/') return out;
  if (pathname.startsWith('/reports/')) {
    out.push('Laporan');
    if (pathname.endsWith('/edit')) out.push('Perbaiki');
    else if (pathname.endsWith('/new')) out.push('Baru');
    else out.push('Detail');
    return out;
  }
  const label = BREADCRUMB[pathname];
  if (label && label !== 'Beranda') out.push(label);
  return out;
}

const SECTIONS: Array<{
  label: string;
  items: Array<{
    to: string;
    label: string;
    Icon: typeof House;
    permission?: string;
    roles?: string[];
    badge?: number;
  }>;
}> = [
  {
    label: 'MENU UTAMA',
    items: [
      { to: '/', label: 'Beranda / Dashboard', Icon: House },
      { to: '/peta', label: 'Peta Sebaran GIS', Icon: Map },
    ],
  },
  {
    label: 'PELAPORAN & ANALISIS',
    items: [
      { to: '/reports', label: 'Daftar Laporan', Icon: FileText },
      { to: '/reports/new', label: 'Buat Laporan Baru', Icon: PlusCircle, permission: 'reports.create' },
      { to: '/reports?status=Submitted', label: 'Verifikasi Laporan', Icon: ShieldCheck, permission: 'reports.verify' },
      {
        to: '/fenomena',
        label: 'Rekap Fenomena BPS',
        Icon: ClipboardList,
        roles: ['superadmin', 'admin', 'operator', 'statistisi', 'viewer'],
      },
    ],
  },
  {
    label: 'DATA MASTER',
    items: [
      { to: '/wilayah', label: 'Master Wilayah & SLS', Icon: MapPinned },
      { to: '/opts', label: 'Katalog OPT Pangan', Icon: Bug },
    ],
  },
  {
    label: 'ADMINISTRASI',
    items: [
      { to: '/users', label: 'Manajemen Pengguna', Icon: Users, permission: 'users.manage' },
      { to: '/audit-logs', label: 'Audit Log Sistem', Icon: ScrollText, permission: 'audit.view' },
      { to: '/status', label: 'Status Sistem', Icon: Activity, roles: ['superadmin', 'admin', 'operator'] },
      { to: '/akun', label: 'Pengaturan Akun', Icon: CircleUserRound },
    ],
  },
];

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function ShellInner() {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jagapadi-sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const sync = useOfflineReports({
    endpoint: '/api/reports',
    ownerId: String(user?.id ?? 'anonymous'),
    getSession: async (): Promise<{ ownerId: string; headers: Record<string, string> } | null> => {
      if (!user) return null;
      const xsrf = readXsrfToken();
      const headers: Record<string, string> = xsrf ? { 'X-XSRF-TOKEN': xsrf } : {};
      return { ownerId: String(user.id), headers };
    },
  });

  const submittedCountQuery = useQuery({
    queryKey: ['reports-submitted-count'],
    queryFn: () => listReports({ status: 'Submitted', page: 1 }),
    enabled: !!user && hasPermission('reports.verify'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const submittedCount = submittedCountQuery.data?.meta.total ?? 0;

  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: listNotifications,
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const notifications = notificationsQuery.data?.data ?? [];
  const unreadCount = notificationsQuery.data?.unread_count ?? 0;

  const openNotification = async (notification: (typeof notifications)[number]) => {
    setNotificationsOpen(false);
    try {
      await markNotificationRead(notification.id);
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      // Abaikan kegagalan penandaan; navigasi tetap dilakukan.
    }
    if (notification.report_id) navigate(`/reports/${notification.report_id}`);
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      // Biarkan state lama bila gagal.
    }
  };

  const visibleSections = useMemo(() => {
    const canSeeItem = (item: (typeof SECTIONS)[number]['items'][number]): boolean => {
      if (item.permission && !hasPermission(item.permission)) return false;
      if (item.roles && (!user || !item.roles.some((r) => user.roles.includes(r)))) return false;
      return true;
    };

    return SECTIONS.map((section) => {
      const items = section.items.filter(canSeeItem);
      const label =
        section.label === 'ADMINISTRASI' && !items.some((i) => i.to === '/users' || i.to === '/status')
          ? 'AKUN'
          : section.label;
      return { ...section, label, items };
    }).filter((section) => section.items.length > 0);
  }, [hasPermission, user]);

  const filteredPages = useMemo(() => {
    const pages = visibleSections.flatMap((s) => s.items).map((item) => ({ path: item.to, label: item.label }));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pages.slice(0, 6);
    return pages.filter((page) => page.label.toLowerCase().includes(q));
  }, [searchQuery, visibleSections]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    if (!searchOpen && !profileOpen && !notificationsOpen) return;
    const handler = (event: MouseEvent) => {
      if (searchOpen && !searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
      if (profileOpen && !profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
      if (notificationsOpen && !notificationsRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen, profileOpen, notificationsOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('jagapadi-sidebar-collapsed', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const navigatePage = (path: string) => {
    navigate(path);
    setSearchQuery('');
    setSearchOpen(false);
  };

  const sidebarWidth = collapsed ? 'w-[76px]' : 'w-[264px]';
  const crumbLabels = crumbs(location.pathname);

  // Pengguna yang wajib mengganti kata sandi diarahkan ke halaman Akun.
  if (user?.must_change_password && location.pathname !== '/akun') {
    return <Navigate to="/akun" replace />;
  }

  return (
    <FieldSyncContext.Provider value={sync}>
      <div className="min-h-screen bg-latar text-tinta">
        {/* Sidebar — desktop */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar-bg transition-[width] duration-200 lg:flex ${sidebarWidth}`}
        >
          <div className={`flex items-center gap-3 border-b border-sidebar-border px-3 py-4 ${collapsed ? 'justify-center' : ''}`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-padi/20">
              <Sprout size={24} strokeWidth={2} className="text-sidebar-accent" aria-hidden="true" />
            </span>
            {!collapsed && (
              <span>
                <span className="block font-display text-lg font-bold leading-5 tracking-tight text-sidebar-active-fg">
                  JAGAPADI
                </span>
                <span className="block text-[10px] font-medium text-sidebar-fg-dim">
                  Kabupaten Jember · BPS 3509
                </span>
              </span>
            )}
          </div>

          {!collapsed && user && (
            <div className="border-b border-sidebar-border bg-sidebar-card p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent font-display text-sm font-bold text-sawah950">
                  {initials(user.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-sidebar-active-fg">{user.name}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-sidebar-fg">
                    <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
                    Online · <span className="capitalize">{user.roles.join(', ')}</span>
                  </span>
                  {user.assigned_district && (
                    <span className="mt-0.5 block truncate text-[10px] text-sidebar-fg-dim">
                      Kec. {user.assigned_district.name}
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4" aria-label="Menu utama">
            {visibleSections.map((section) => (
              <div key={section.label}>
                {!collapsed && (
                  <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-fg-dim">
                    {section.label}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items.map(({ to, label, Icon, permission }) => {
                    const active = navItemActive(to, location.pathname, location.search);
                    return (
                      <Link
                        key={to}
                        to={to}
                        title={collapsed ? label : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-semibold transition-colors ${
                          active
                            ? 'bg-sidebar-active text-sidebar-active-fg'
                            : 'text-sidebar-fg hover:bg-sidebar-card hover:text-sidebar-active-fg'
                        } ${collapsed ? 'justify-center' : ''}`}
                      >
                        <Icon size={19} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{label}</span>
                            {permission === 'reports.verify' && submittedCount > 0 && (
                              <span className="rounded-full bg-chip-warn-fg px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {submittedCount}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-sidebar-border p-3">
            <button
              type="button"
              onClick={logout}
              title="Keluar"
              aria-label="Keluar dari aplikasi"
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-semibold text-sidebar-fg transition-colors hover:bg-chip-ditolak-bg/15 hover:text-err ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <LogOut size={18} aria-hidden="true" />
              {!collapsed && 'Keluar'}
            </button>
          </div>
        </aside>

        {/* Sidebar — mobile (off-canvas) */}
        {mobileOpen && (
          <>
            <button
              type="button"
              aria-label="Tutup menu"
              className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-[70] flex w-[272px] flex-col border-r border-sidebar-border bg-sidebar-bg px-3 py-4 lg:hidden">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sprout size={22} className="text-sidebar-accent" aria-hidden="true" />
                  <span className="font-display text-lg font-bold text-sidebar-active-fg">JAGAPADI</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Tutup"
                  className="flex h-10 w-10 items-center justify-center rounded-md text-sidebar-fg hover:bg-sidebar-card"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              {user && (
                <div className="mb-3 rounded-md bg-sidebar-card p-3">
                  <p className="text-sm font-semibold text-sidebar-active-fg">{user.name}</p>
                  <p className="text-[11px] capitalize text-sidebar-fg-dim">
                    {user.roles.join(', ')}
                    {user.assigned_district ? ` · Kec. ${user.assigned_district.name}` : ''}
                  </p>
                </div>
              )}
              <nav className="flex-1 space-y-1 overflow-y-auto">
                {visibleSections.flatMap((s) => s.items)
                  .map(({ to, label, Icon, permission }) => {
                    const active = navItemActive(to, location.pathname, location.search);
                    return (
                      <Link
                        key={to}
                        to={to}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
                          active ? 'bg-sidebar-active text-sidebar-active-fg' : 'text-sidebar-fg hover:bg-sidebar-card hover:text-sidebar-active-fg'
                        }`}
                      >
                        <Icon size={19} aria-hidden="true" />
                        {label}
                        {permission === 'reports.verify' && submittedCount > 0 && (
                          <span className="ml-auto rounded-full bg-chip-warn-fg px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {submittedCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
              </nav>
            </aside>
          </>
        )}

        {/* Layout Utama (Header + Konten) */}
        <div
          className="flex min-h-screen flex-col transition-[padding] duration-200 lg:pl-[var(--sidebar-w)]"
          style={{ ['--sidebar-w' as string]: collapsed ? '76px' : '264px' }}
        >
          {/* Top navbar */}
          <header className="sticky top-0 z-20 border-b border-garis bg-panel">
            <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 1024) setMobileOpen(true);
                  else toggleCollapsed();
                }}
                aria-label="Toggle sidebar"
                className="flex h-11 w-11 items-center justify-center rounded-md text-tinta2 transition-colors hover:bg-panel2 hover:text-tinta"
              >
                <Menu size={20} aria-hidden="true" />
              </button>

              {/* Breadcrumb */}
              <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-sm sm:flex">
                {crumbLabels.map((label, index) => (
                  <span key={index} className="inline-flex items-center gap-1.5">
                    {index > 0 && <span className="text-tinta3">/</span>}
                    <span className={index === crumbLabels.length - 1 ? 'font-semibold text-tinta' : 'text-tinta2'}>
                      {label}
                    </span>
                  </span>
                ))}
              </nav>

              {/* Quick search */}
              <div ref={searchRef} className="relative ml-auto hidden md:block">
                <div className="flex items-center gap-2 rounded-md border border-garis bg-panel2 px-3 py-2">
                  <Search size={16} className="text-tinta3" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredPages.length > 0) {
                        navigatePage(filteredPages[0].path);
                      }
                    }}
                    placeholder="Cari menu / halaman…"
                    aria-label="Cari menu"
                    className="w-56 bg-transparent text-sm text-tinta outline-none placeholder:text-tinta3"
                  />
                </div>
                {searchOpen && filteredPages.length > 0 && (
                  <ul className="absolute right-0 top-12 z-50 min-w-[260px] rounded-md border border-garis bg-panel p-1.5 shadow-pop">
                    {filteredPages.map((page) => (
                      <li key={page.path}>
                        <button
                          type="button"
                          onClick={() => navigatePage(page.path)}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-tinta2 transition-colors hover:bg-panel2 hover:text-tinta"
                        >
                          <ChevronDown size={14} className="-rotate-90 text-tinta3" aria-hidden="true" />
                          {page.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Badge verifikasi */}
              {hasPermission('reports.verify') && submittedCount > 0 && (
                <Link
                  to="/reports?status=Submitted"
                  title={`${submittedCount} laporan perlu verifikasi`}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-tinta2 transition-colors hover:bg-panel2 hover:text-tinta"
                >
                  <ShieldCheck size={20} aria-hidden="true" />
                  <span className="absolute ml-5 -mt-5 flex h-4 w-4 items-center justify-center rounded-full bg-chip-warn-fg text-[9px] font-bold text-white">
                    {submittedCount > 9 ? '9+' : submittedCount}
                  </span>
                </Link>
              )}

              {/* Notifikasi in-app */}
              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((v) => !v)}
                  aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} belum dibaca` : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={notificationsOpen}
                  className="relative flex h-11 w-11 items-center justify-center rounded-md text-tinta2 transition-colors hover:bg-panel2 hover:text-tinta"
                >
                  <Bell size={20} aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-chip-warn-fg px-1 text-[9px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-garis bg-panel shadow-pop"
                  >
                    <div className="flex items-center justify-between border-b border-garis px-4 py-2.5">
                      <p className="text-sm font-bold text-tinta">Notifikasi</p>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void markAllRead()}
                          className="text-[11px] font-semibold text-cta hover:underline"
                        >
                          Tandai semua dibaca
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-tinta2">Belum ada notifikasi.</p>
                      ) : (
                        notifications.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            role="menuitem"
                            onClick={() => void openNotification(notification)}
                            className={`block w-full border-b border-garis px-4 py-3 text-left transition-colors hover:bg-panel2 ${
                              notification.read_at === null ? 'bg-cta/5' : ''
                            }`}
                          >
                            <p className="text-xs font-bold text-tinta">{notification.title}</p>
                            <p className="mt-0.5 text-[11px] leading-4 text-tinta2">{notification.body}</p>
                            <p className="mt-1 text-[10px] text-tinta3">
                              {notification.created_at
                                ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(notification.created_at))
                                : ''}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <ThemeToggle />

              {/* Profil dropdown */}
              <div ref={profileRef} className="relative ml-1">
                <button
                  type="button"
                  onClick={() => setProfileOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  className="flex items-center gap-2 rounded-md border border-garis bg-panel2 px-2 py-1.5 transition-colors hover:bg-panel"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sawah800 font-display text-xs font-bold text-white">
                    {initials(user?.name ?? 'U')}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-xs font-bold leading-tight text-tinta">
                      {user?.name.split(' ')[0]}
                    </span>
                    <span className="block text-[10px] capitalize text-tinta3">
                      {user?.roles.join(', ')}
                    </span>
                  </span>
                  <ChevronDown size={14} className="text-tinta3" aria-hidden="true" />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-12 z-50 min-w-[230px] rounded-md border border-garis bg-panel p-1.5 shadow-pop">
                    <div className="border-b border-garis px-3 py-2.5">
                      <p className="text-xs font-bold text-tinta">{user?.name}</p>
                      <p className="mt-0.5 text-[11px] text-tinta2">{user?.email}</p>
                      {user?.assigned_district && (
                        <p className="mt-0.5 text-[11px] font-medium text-tinta2">
                          Wilayah: Kec. {user.assigned_district.name}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {user?.roles.map((role) => (
                          <span
                            key={role}
                            className="rounded-full bg-kpi-blue-bg px-2 py-0.5 text-[10px] font-bold capitalize text-kpi-blue-fg"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Link
                      to="/akun"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-tinta2 transition-colors hover:bg-panel2 hover:text-tinta"
                    >
                      <CircleUserRound size={15} aria-hidden="true" />
                      Pengaturan Akun
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-err transition-colors hover:bg-chip-ditolak-bg/20"
                    >
                      <LogOut size={15} aria-hidden="true" />
                      Keluar dari aplikasi
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Konten */}
          <main className="flex-1 pb-24 lg:pb-8">
            <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Bottom nav — mobile */}
        <nav
          aria-label="Navigasi mobile"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-garis bg-panel pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <BotNavItem to="/" label="Beranda" Icon={House} />
          <BotNavItem to="/reports" label="Laporan" Icon={FileText} />
          {hasPermission('reports.create') ? (
            <Link
              to="/reports/new"
              aria-label="Buat laporan baru"
              aria-current={navItemActive('/reports/new', location.pathname, location.search) ? 'page' : undefined}
              className="group flex flex-col items-center justify-center gap-0.5 py-2"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cta text-ctafg shadow-pop transition-transform group-active:scale-95">
                <PlusCircle size={22} strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="text-[11px] font-semibold text-tinta2">Lapor</span>
            </Link>
          ) : (
            <BotNavItem to="/peta" label="Peta" Icon={Map} />
          )}
          <BotNavItem to="/akun" label="Akun" Icon={CircleUserRound} />
        </nav>
      </div>
    </FieldSyncContext.Provider>
  );
}

function BotNavItem({
  to,
  label,
  Icon,
}: {
  to: string;
  label: string;
  Icon: typeof House;
}) {
  const { pathname, search } = useLocation();
  const active = navItemActive(to, pathname, search);
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
        active ? 'text-cta' : 'text-tinta3'
      }`}
    >
      <Icon size={22} strokeWidth={2} aria-hidden="true" />
      <span className="text-[11px] font-semibold">{label}</span>
    </Link>
  );
}

export function AppShell() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <ShellInner />;
}
