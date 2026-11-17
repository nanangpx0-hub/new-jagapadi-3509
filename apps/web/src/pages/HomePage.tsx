import {
  BadgeCheck,
  ChevronRight,
  FileText,
  Inbox,
  Loader2,
  PenLine,
  Send,
  TriangleAlert,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { KpiCard } from '../components/KpiCard';
import { MapLegend, MapView } from '../components/MapView';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { listReports } from '../lib/api';
import { useAuth } from '../lib/auth';
import { REPORT_TYPE_LABEL, type Report } from '../lib/types';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 19) return 'Selamat sore';
  return 'Selamat malam';
}

function formatDateId(date: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function ReportRow({ report, action }: { report: Report; action?: string }) {
  return (
    <li>
      <Link
        to={`/reports/${report.id}`}
        className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-panel2"
      >
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-semibold text-tinta">
            {report.report_number ?? 'DRAF'}
            <span className="ml-2 font-body text-[11px] font-medium text-tinta3">
              {REPORT_TYPE_LABEL[report.report_type]}
            </span>
          </p>
          <p className="mt-0.5 truncate text-[11px] text-tinta2">
            {report.district?.name ?? '—'} · {formatDateId(report.report_date)}
          </p>
        </div>
        <StatusBadge status={report.status} size="sm" />
        <ChevronRight size={16} className="shrink-0 text-tinta3" aria-hidden="true" />
        {action && <span className="sr-only">{action}</span>}
      </Link>
    </li>
  );
}

export function HomePage() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const isVerifier = hasPermission('reports.verify');

  const recent = useQuery({
    queryKey: ['reports', { page: 1 }],
    queryFn: () => listReports({ page: 1 }),
  });
  const submitted = useQuery({
    queryKey: ['reports', { status: 'Submitted', page: 1 }],
    queryFn: () => listReports({ status: 'Submitted', page: 1 }),
  });
  const verified = useQuery({
    queryKey: ['reports', { status: 'Diverifikasi', page: 1 }],
    queryFn: () => listReports({ status: 'Diverifikasi', page: 1 }),
  });
  const drafted = useQuery({
    queryKey: ['reports', { status: 'Draf', page: 1 }],
    queryFn: () => listReports({ status: 'Draf', page: 1 }),
  });
  const rejected = useQuery({
    queryKey: ['reports', { status: 'Ditolak', page: 1 }],
    queryFn: () => listReports({ status: 'Ditolak', page: 1 }),
  });

  const mapReports = recent.data?.data ?? [];
  const latest = recent.data?.data.slice(0, 6) ?? [];
  const reviewQueue = submitted.data?.data.slice(0, 5) ?? [];

  const todayId = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">
            {todayId}
            {user?.assigned_district ? ` · Kec. ${user.assigned_district.name}` : ''}
            {' · Kabupaten Jember'}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-tinta sm:text-3xl">
            {greeting()}, {user?.name.split(' ')[0]}
          </h1>
          <p className="mt-0.5 text-xs text-tinta2">
            Ringkasan {isVerifier ? 'laporan masuk se-kabupaten' : 'laporan lapangan Anda'} hari ini.
          </p>
        </div>
        {hasPermission('reports.create') && !isVerifier && (
          <button
            type="button"
            onClick={() => navigate('/reports/new')}
            className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cta px-5 text-sm font-bold text-ctafg shadow-pop transition-colors hover:bg-sawah800"
          >
            <PenLine size={19} strokeWidth={2.25} aria-hidden="true" />
            Buat Laporan
          </button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {isVerifier ? (
          <>
            <KpiCard label="Total Laporan Masuk" value={recent.data?.meta.total ?? '—'} icon={Inbox} tone="blue" hint="semua status" />
            <KpiCard label="Perlu Verifikasi" value={submitted.data?.meta.total ?? '—'} icon={Send} tone="amber" hint="menunggu tinjauan" />
            <KpiCard label="Diverifikasi" value={verified.data?.meta.total ?? '—'} icon={BadgeCheck} tone="green" hint="laporan resmi" />
          </>
        ) : (
          <>
            <KpiCard label="Dikirim" value={submitted.data?.meta.total ?? '—'} icon={Send} tone="blue" hint="menunggu review" />
            <KpiCard label="Diverifikasi" value={verified.data?.meta.total ?? '—'} icon={BadgeCheck} tone="green" hint="selesai" />
            <KpiCard label="Perlu Diperbaiki" value={rejected.data?.meta.total ?? '—'} icon={TriangleAlert} tone="amber" hint="ditolak, kirim ulang" />
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        {/* Peta */}
        <Panel
          className="xl:col-span-3"
          title="Peta Sebaran Laporan"
          subtitle="Titik adalah laporan terbaru dengan koordinat GPS"
        >
          {recent.isLoading ? (
            <div className="flex h-[380px] items-center justify-center sm:h-[420px]">
              <Loader2 size={28} className="animate-spin text-tinta3" aria-hidden="true" />
            </div>
          ) : (
            <>
              <MapView reports={mapReports} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <MapLegend types={['pest', 'irrigation']} />
                <p className="text-[11px] text-tinta3">
                  Menampilkan {mapReports.length} laporan terbaru ·{' '}
                  <Link to="/reports" className="font-semibold text-cta underline underline-offset-2">
                    Lihat semua
                  </Link>
                </p>
              </div>
            </>
          )}
        </Panel>

        {/* Antrean verifikasi / laporan terbaru */}
        {isVerifier ? (
          <Panel
            className="xl:col-span-2"
            title="Antrean Verifikasi"
            subtitle="Laporan masuk yang menunggu tinjauan"
            actions={
              <Link
                to="/reports?status=Submitted"
                className="text-xs font-bold text-cta underline underline-offset-2 hover:text-sawah800"
              >
                Lihat semua ({submitted.data?.meta.total ?? 0})
              </Link>
            }
            bodyClassName="p-2"
          >
            {submitted.isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-tinta3" aria-hidden="true" />
              </div>
            ) : reviewQueue.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-tinta2">
                Tidak ada laporan menunggu verifikasi.
              </p>
            ) : (
              <ul className="divide-y divide-garis">
                {reviewQueue.map((report) => (
                  <ReportRow key={report.id} report={report} />
                ))}
              </ul>
            )}
          </Panel>
        ) : (
          <Panel
            className="xl:col-span-2"
            title="Laporan Terbaru"
            subtitle="Enam laporan terakhir yang Anda buat"
            actions={
              <Link
                to="/reports"
                className="text-xs font-bold text-cta underline underline-offset-2 hover:text-sawah800"
              >
                Lihat semua
              </Link>
            }
            bodyClassName="p-2"
          >
            {recent.isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-tinta3" aria-hidden="true" />
              </div>
            ) : latest.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <FileText size={28} className="mx-auto mb-2 text-tinta3" aria-hidden="true" />
                <p className="text-sm font-semibold text-tinta">Belum ada laporan</p>
                <p className="mt-0.5 text-xs text-tinta2">Ketuk “Buat Laporan” untuk membuat laporan pertama Anda.</p>
              </div>
            ) : (
              <ul className="divide-y divide-garis">
                {latest.map((report) => (
                  <ReportRow key={report.id} report={report} />
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      {/* Ringkasan draf untuk petugas */}
      {!isVerifier && (drafted.data?.meta.total ?? 0) > 0 && (
        <Link
          to="/reports?status=Draf"
          className="flex items-center justify-between gap-3 rounded-lg border border-chip-dikirim-bg bg-chip-dikirim-bg/25 px-4 py-3 text-sm font-semibold text-chip-dikirim-fg transition-colors hover:bg-chip-dikirim-bg/40"
        >
          <span>
            Anda memiliki <strong>{drafted.data?.meta.total}</strong> draf belum terkirim
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
