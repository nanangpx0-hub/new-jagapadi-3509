import {
  Activity,
  CheckCircle2,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getHealth } from '../lib/api';
import { REPORT_TYPE_LABEL, type ReportType } from '../lib/types';

const REPORT_DOMAINS = Object.keys(REPORT_TYPE_LABEL) as ReportType[];

export function StatusPage() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, refetchInterval: 30000, retry: 1 });

  const checks = [
    { key: 'database' as const, label: 'PostgreSQL', Icon: Database },
    { key: 'postgis' as const, label: 'PostGIS', Icon: Activity },
    { key: 'redis' as const, label: 'Redis', Icon: Server },
    { key: 'storage' as const, label: 'Penyimpanan', Icon: HardDrive },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Status Sistem</h1>
          <p className="mt-0.5 text-xs text-tinta2">Kesehatan infrastruktur JAGAPADI v3 — diperbarui tiap 30 detik</p>
        </div>
        <button
          type="button"
          onClick={() => void health.refetch()}
          disabled={health.isFetching}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-garis bg-panel px-4 text-sm font-semibold text-tinta2 transition-colors hover:text-tinta disabled:opacity-60"
        >
          <RefreshCw size={16} className={health.isFetching ? 'animate-spin' : ''} aria-hidden="true" />
          Periksa ulang
        </button>
      </div>

      <section className="rounded-lg border border-garis bg-panel p-5 shadow-card">
        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-tinta">
          {health.isPending ? (
            <>
              <Loader2 size={18} className="animate-spin text-tinta3" aria-hidden="true" />
              Memeriksa layanan…
            </>
          ) : health.error ? (
            <>
              <XCircle size={18} className="text-err" aria-hidden="true" />
              Backend belum terhubung: {health.error.message}
            </>
          ) : health.data?.status === 'ok' ? (
            <>
              <CheckCircle2 size={18} className="text-ok" aria-hidden="true" />
              Seluruh layanan aktif normal.
            </>
          ) : (
            <>
              <XCircle size={18} className="text-err" aria-hidden="true" />
              Sebagian layanan mengalami gangguan.
            </>
          )}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {checks.map(({ key, label, Icon }) => {
            const check = health.data?.checks[key];
            const ok = check?.status === 'ok';
            return (
              <div key={key} className="rounded-md border border-garis bg-panel2 p-3">
                <Icon size={18} className={ok ? 'text-ok' : check ? 'text-err' : 'text-tinta3'} aria-hidden="true" />
                <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-tinta3">{label}</p>
                <p className={`mt-0.5 text-xs font-bold ${ok ? 'text-ok' : check ? 'text-err' : 'text-tinta3'}`}>
                  {check ? (ok ? 'Terhubung' : 'Gangguan') : 'Belum diketahui'}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-tinta3">
                  {check?.version ?? check?.driver ?? check?.response ?? (check?.writable === true ? 'writable' : '')}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-garis bg-panel p-5 shadow-card">
          <h2 className="font-display text-sm font-bold text-tinta">Enam Peran Pengguna</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {['superadmin', 'admin', 'operator', 'statistisi', 'petugas', 'viewer'].map((role) => (
              <li key={role} className="rounded-full bg-chip-draf-bg px-3 py-1 text-xs font-semibold capitalize text-chip-draf-fg">
                {role}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-garis bg-panel p-5 shadow-card">
          <h2 className="font-display text-sm font-bold text-tinta">Domain Laporan</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {REPORT_DOMAINS.map((type) => (
              <li key={type} className="rounded-full bg-kpi-green-bg px-3 py-1 text-xs font-semibold text-kpi-green-fg">
                {REPORT_TYPE_LABEL[type]}
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-tinta3">
            <Wifi size={12} aria-hidden="true" />
            Seluruh 6 domain laporan fenomena pertanian aktif.
          </p>
        </section>
      </div>

      <p className="text-center text-[11px] text-tinta3">
        JAGAPADI v3 ·{' '}
        <Link to="/akun" className="underline underline-offset-2 hover:text-tinta2">
          Akun saya
        </Link>
        {health.data ? ` · Zona waktu ${health.data.timezone}` : ''}
      </p>
    </div>
  );
}
