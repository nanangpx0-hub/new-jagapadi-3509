import { ChevronLeft, ChevronRight, FileText, Loader2, PenLine } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '../components/EmptyState';
import { KpiCard } from '../components/KpiCard';
import { StatusBadge } from '../components/StatusBadge';
import { getReportMetrics, listDistricts, listReports } from '../lib/api';
import { useAuth } from '../lib/auth';
import { REPORT_STATUS_LABEL, REPORT_TYPE_LABEL, type ReportStatus } from '../lib/types';

const STATUS_FILTERS: Array<ReportStatus | 'all'> = ['all', 'Draf', 'Submitted', 'Diverifikasi', 'Ditolak', 'Diarsipkan'];

function formatDateId(date: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function ReportsPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get('status') ?? 'all') as ReportStatus | 'all';
  const reportType = searchParams.get('report_type') ?? 'all';
  const districtId = searchParams.get('district_id') ? Number(searchParams.get('district_id')) : undefined;
  const subround = searchParams.get('subround') ?? '';
  const quarter = searchParams.get('quarter') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const query = useQuery({
    queryKey: ['reports', { status, report_type: reportType, district_id: districtId, subround, quarter, page }],
    queryFn: () =>
      listReports({
        status: status === 'all' ? undefined : status,
        report_type: reportType === 'all' ? undefined : reportType,
        district_id: districtId,
        subround: subround ? Number(subround) : undefined,
        quarter: quarter ? Number(quarter) : undefined,
        page,
      }),
    placeholderData: (previous) => previous,
  });

  const metricsQuery = useQuery({
    queryKey: ['report-metrics', { report_type: reportType, district_id: districtId, subround, quarter }],
    queryFn: () => getReportMetrics({
      report_type: reportType === 'all' ? undefined : reportType,
      district_id: districtId,
      subround: subround ? Number(subround) : undefined,
      quarter: quarter ? Number(quarter) : undefined,
    }),
  });

  const districtsQuery = useQuery({ queryKey: ['districts'], queryFn: listDistricts });

  const reports = query.data?.data ?? [];
  const meta = query.data?.meta;
  const metrics = metricsQuery.data;

  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    if (!('page' in updates)) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Laporan</h1>
          <p className="mt-0.5 text-xs text-tinta2">
            {meta ? `${meta.total} laporan` : 'Memuat…'} · Kabupaten Jember
          </p>
        </div>
        {hasPermission('reports.create') && (
          <Link
            to="/reports/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cta px-4 text-sm font-bold text-ctafg shadow-pop transition-colors hover:bg-sawah800"
          >
            <PenLine size={17} aria-hidden="true" />
            Buat Laporan
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total Laporan" value={metrics?.total ?? '—'} icon={FileText} tone="blue" />
        <KpiCard label="Diverifikasi" value={metrics?.diverifikasi ?? '—'} icon={FileText} tone="green" />
        <KpiCard
          label={hasPermission('reports.verify') ? 'Perlu Verifikasi' : 'Menunggu Verifikasi'}
          value={metrics?.submitted ?? '—'}
          icon={FileText}
          tone="amber"
        />
        <KpiCard label="Luas Terdampak (Ha)" value={metrics ? metrics.affected_area_ha.toLocaleString('id-ID') : '—'} icon={FileText} tone="green" />
      </div>

      {/* Filter status */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filter status">
        {STATUS_FILTERS.map((item) => {
          const active = status === item;
          const label = item === 'all' ? 'Semua' : REPORT_STATUS_LABEL[item];
          return (
            <button
              key={item}
              role="tab"
              aria-selected={active}
              onClick={() => setParams({ status: item === 'all' ? null : item })}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-bold transition-colors ${
                active
                  ? 'border-cta bg-cta text-ctafg'
                  : 'border-garis bg-panel text-tinta2 hover:text-tinta'
              }`}
            >
              {label}
            </button>
          );
        })}
        <select
          aria-label="Filter jenis laporan"
          className="ml-auto min-h-10 shrink-0 rounded-full border border-garis bg-panel px-3 text-xs font-semibold text-tinta2 focus:outline-none focus:ring-2 focus:ring-cta"
          value={reportType}
          onChange={(e) => setParams({ report_type: e.target.value === 'all' ? null : e.target.value })}
        >
          <option value="all">Semua jenis</option>
          {(Object.keys(REPORT_TYPE_LABEL) as Array<keyof typeof REPORT_TYPE_LABEL>).map((type) => (
            <option key={type} value={type}>{REPORT_TYPE_LABEL[type]}</option>
          ))}
        </select>
        <select
          aria-label="Filter subround"
          className="min-h-10 shrink-0 rounded-full border border-garis bg-panel px-3 text-xs font-semibold text-tinta2 focus:outline-none focus:ring-2 focus:ring-cta"
          value={subround}
          onChange={(e) => setParams({ subround: e.target.value || null, quarter: null })}
        >
          <option value="">Semua SR</option>
          <option value="1">SR I</option>
          <option value="2">SR II</option>
          <option value="3">SR III</option>
        </select>
        <select
          aria-label="Filter triwulan"
          className="min-h-10 shrink-0 rounded-full border border-garis bg-panel px-3 text-xs font-semibold text-tinta2 focus:outline-none focus:ring-2 focus:ring-cta"
          value={quarter}
          onChange={(e) => setParams({ quarter: e.target.value || null, subround: null })}
        >
          <option value="">Semua Tw</option>
          <option value="1">Tw I</option>
          <option value="2">Tw II</option>
          <option value="3">Tw III</option>
          <option value="4">Tw IV</option>
        </select>
        <select
          aria-label="Filter kecamatan"
          className="min-h-10 shrink-0 rounded-full border border-garis bg-panel px-3 text-xs font-semibold text-tinta2 focus:outline-none focus:ring-2 focus:ring-cta"
          value={districtId ?? ''}
          onChange={(e) => setParams({ district_id: e.target.value || null })}
        >
          <option value="">Semua kecamatan</option>
          {(districtsQuery.data ?? []).map((district) => (
            <option key={district.id} value={district.id}>
              {district.code} — {district.name}
            </option>
          ))}
        </select>
      </div>

      {query.isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={28} className="animate-spin text-tinta3" aria-hidden="true" />
        </div>
      ) : query.isError ? (
        <p role="alert" className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-4 py-3 text-sm font-semibold text-chip-ditolak-fg">
          Gagal memuat daftar laporan. {(query.error as Error)?.message}
        </p>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada laporan"
          description={
            hasPermission('reports.create')
              ? 'Tidak ada laporan yang cocok dengan filter ini. Buat laporan baru dari lapangan atau ubah filternya.'
              : 'Tidak ada laporan yang cocok dengan filter ini.'
          }
          action={
            hasPermission('reports.create') ? (
              <Link to="/reports/new" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cta px-4 text-sm font-bold text-ctafg">
                <PenLine size={17} aria-hidden="true" /> Buat Laporan
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Tabel — desktop */}
          <div className="hidden overflow-hidden rounded-lg border border-garis bg-panel shadow-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-garis text-left text-[11px] uppercase tracking-wider text-tinta3">
                  <th className="px-4 py-3 font-semibold">Nomor</th>
                  <th className="px-4 py-3 font-semibold">Jenis</th>
                  <th className="px-4 py-3 font-semibold">Wilayah</th>
                  <th className="px-4 py-3 font-semibold">Tanggal</th>
                  <th className="px-4 py-3 font-semibold">Pelapor</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-garis">
                {reports.map((report) => (
                  <tr key={report.id} className="transition-colors hover:bg-panel2">
                    <td className="px-4 py-3">
                      <Link to={`/reports/${report.id}`} className="font-mono text-xs font-semibold text-cta underline underline-offset-2 hover:text-sawah800">
                        {report.report_number ?? 'DRAF'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-tinta2">{REPORT_TYPE_LABEL[report.report_type]}</td>
                    <td className="px-4 py-3 text-tinta2">{report.district?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-tinta2">{formatDateId(report.report_date)}</td>
                    <td className="px-4 py-3 text-tinta2">{report.user?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={report.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kartu — mobile */}
          <ul className="grid gap-2 md:hidden">
            {reports.map((report) => (
              <li key={report.id}>
                <Link
                  to={`/reports/${report.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-garis bg-panel p-4 shadow-card"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-xs font-bold text-tinta">{report.report_number ?? 'DRAF'}</span>
                    <span className="mt-0.5 block text-[11px] text-tinta2">
                      {REPORT_TYPE_LABEL[report.report_type]} · {report.district?.name ?? '—'}
                    </span>
                    <span className="block text-[11px] text-tinta3">{formatDateId(report.report_date)}</span>
                  </span>
                  <StatusBadge status={report.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Paginasi */}
          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setParams({ page: String(page - 1) })}
                className="inline-flex min-h-11 items-center gap-1 rounded-md border border-garis bg-panel px-4 text-sm font-semibold text-tinta2 disabled:opacity-40"
              >
                <ChevronLeft size={17} aria-hidden="true" /> Sebelumnya
              </button>
              <p className="text-xs font-medium text-tinta2">
                Halaman {meta.current_page} dari {meta.last_page} · {meta.total} laporan
              </p>
              <button
                type="button"
                disabled={page >= meta.last_page}
                onClick={() => setParams({ page: String(page + 1) })}
                className="inline-flex min-h-11 items-center gap-1 rounded-md border border-garis bg-panel px-4 text-sm font-semibold text-tinta2 disabled:opacity-40"
              >
                Berikutnya <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
