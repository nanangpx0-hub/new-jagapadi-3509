import { ChevronLeft, ChevronRight, History, Loader2, Search, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '../components/EmptyState';
import { Panel } from '../components/Panel';
import { listAuditLogs } from '../lib/api';
import { useAuth } from '../lib/auth';

const CATEGORIES = ['all', 'auth', 'users', 'reports', 'opts'] as const;

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export function AuditLogsPage() {
  const { hasPermission } = useAuth();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['audit-logs', { category, search, page }],
    queryFn: () => listAuditLogs({
      log_name: category === 'all' ? undefined : category,
      search: search.trim() || undefined,
      per_page: 15,
      page,
    }),
    placeholderData: (previous) => previous,
    enabled: hasPermission('audit.view'),
  });

  const logs = query.data?.data ?? [];
  const meta = query.data?.meta;

  if (!hasPermission('audit.view')) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Audit Log Sistem</h1>
        <p role="alert" className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-4 py-3 text-sm font-semibold text-chip-ditolak-fg">
          Anda tidak memiliki hak akses ke halaman ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Audit Log Sistem</h1>
        <p className="mt-0.5 text-xs text-tinta2">
          {meta ? `${meta.total} aktivitas tercatat` : 'Memuat…'} · Jejak login, pengguna, dan siklus laporan.
        </p>
      </div>

      <div className="-mx-1 flex flex-wrap items-center gap-1.5 px-1 pb-1">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => { setCategory(item); setPage(1); }}
            className={`min-h-10 rounded-full border px-4 text-xs font-bold capitalize transition-colors ${
              category === item
                ? 'border-cta bg-cta text-ctafg'
                : 'border-garis bg-panel text-tinta2 hover:text-tinta'
            }`}
          >
            {item === 'all' ? 'Semua' : item}
          </button>
        ))}
        <label className="relative ml-auto block">
          <span className="sr-only">Cari aktivitas</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta3" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari deskripsi aktivitas…"
            className="min-h-11 w-64 rounded-md border border-garis bg-panel py-2 pl-9 pr-3 text-sm text-tinta placeholder:text-tinta3 focus:outline-none focus:ring-2 focus:ring-cta"
          />
        </label>
      </div>

      <Panel bodyClassName="p-0">
        {query.isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 size={28} className="animate-spin text-tinta3" aria-hidden="true" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={History}
              title="Belum ada aktivitas"
              description="Tidak ada aktivitas yang cocok dengan filter ini."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-panel2 text-[11px] uppercase tracking-wider text-tinta3">
                <tr>
                  <th className="px-4 py-3 font-semibold">Waktu</th>
                  <th className="px-4 py-3 font-semibold">Pelaku</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Deskripsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-garis">
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-panel2/60">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-tinta2">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-tinta">{log.causer?.name ?? 'Sistem'}</p>
                      <p className="text-[11px] text-tinta3">{log.causer?.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-tinta2">{log.log_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-kpi-blue-bg bg-kpi-blue-bg/40 px-2 py-0.5 text-[10px] font-bold text-kpi-blue-fg">
                        {log.event ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-tinta2">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-garis bg-panel px-4 text-sm font-semibold text-tinta2 disabled:opacity-40"
          >
            <ChevronLeft size={16} aria-hidden="true" /> Sebelumnya
          </button>
          <p className="text-xs font-medium text-tinta2">
            Halaman {meta.current_page} dari {meta.last_page} · {meta.total} aktivitas
          </p>
          <button
            type="button"
            disabled={page >= meta.last_page}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-garis bg-panel px-4 text-sm font-semibold text-tinta2 disabled:opacity-40"
          >
            Berikutnya <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-tinta3">
        <ShieldAlert size={12} aria-hidden="true" /> Data audit hanya dapat dilihat oleh administrator dan auditor.
      </p>
    </div>
  );
}
