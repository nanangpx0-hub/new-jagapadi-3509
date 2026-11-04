import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ROLES, REPORT_TYPES } from '@jagapadi/shared';
import { getHealth } from './lib/api';
import { compressPhoto } from './offline/compress-image';
import { getFieldDB } from './offline/database';

function StatusPage() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, refetchInterval: 30000, retry: 1 });
  const labels = { database: 'PostgreSQL', postgis: 'PostGIS', redis: 'Redis', storage: 'Storage' } as const;
  return <main className="mx-auto max-w-5xl p-5 md:p-10">
    <header className="mb-8 rounded-2xl bg-green-800 p-6 text-white">
      <p className="text-sm font-semibold">Kabupaten Jember · BPS 3509</p>
      <h1 className="my-2 text-3xl font-bold">JAGAPADI v3</h1>
      <p>Pondasi sistem pelaporan lapangan pertanian</p>
    </header>
    <section aria-labelledby="health-heading">
      <h2 id="health-heading" className="text-2xl font-bold">Status sistem</h2>
      <p className="my-3" role="status">{health.isPending ? 'Memeriksa layanan…' : health.error ? 'Backend belum terhubung: ' + health.error.message : health.data?.status === 'ok' ? 'Seluruh layanan siap' : 'Sebagian layanan mengalami gangguan'}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(labels).map(([key, label]) => {
          const check = health.data?.checks[key as keyof typeof labels];
          return <article key={key} className="rounded-xl border-2 border-slate-300 bg-white p-5">
            <h3 className="text-xl font-bold">{label}</h3>
            <p className={check?.status === 'ok' ? 'font-semibold text-green-800' : 'font-semibold text-red-800'}>{check?.status === 'ok' ? 'Terhubung' : check ? 'Gangguan' : 'Belum diketahui'}</p>
            <p>{check?.version ?? check?.driver ?? check?.response ?? (check?.writable === true ? 'Penyimpanan dapat ditulis' : '')}</p>
          </article>;
        })}
      </div>
      <button className="my-4 rounded-lg bg-green-800 px-5 py-3 font-bold text-white disabled:opacity-60" disabled={health.isFetching} onClick={() => void health.refetch()}>Periksa ulang</button>
    </section>
    <section className="my-6 rounded-xl border-2 border-slate-300 bg-white p-5" aria-labelledby="offline-heading">
      <h2 id="offline-heading" className="text-2xl font-bold">Kesiapan Offline PWA</h2>
      <p>Jaringan: {online ? 'online' : 'offline'}. Status ini tidak menjamin API terjangkau.</p>
      <p>Modul kompresi foto: {typeof compressPhoto === 'function' ? 'tersedia' : 'belum siap'}.</p>
      <p>Modul draft IndexedDB: {typeof getFieldDB === 'function' && 'indexedDB' in window ? 'tersedia' : 'tidak didukung browser'}.</p>
      <p>Service worker: {'serviceWorker' in navigator ? 'didukung; cache aktif setelah build produksi dan kunjungan awal' : 'tidak didukung'}.</p>
      <p className="mt-2">Halaman ini adalah status fondasi. Login dan alur laporan belum diaktifkan.</p>
    </section>
    <div className="grid gap-5 sm:grid-cols-2">
      <section><h2 className="text-xl font-bold">5 Role</h2><ul className="list-inside list-disc">{Object.values(ROLES).map(role => <li key={role}>{role}</li>)}</ul></section>
      <section><h2 className="text-xl font-bold">6 Domain Laporan</h2><ul className="list-inside list-disc">{Object.values(REPORT_TYPES).map(type => <li key={type}>{type}</li>)}</ul></section>
    </div>
    {health.data && <footer className="mt-8 text-sm">Zona waktu: {health.data.timezone} · Pemeriksaan: {health.data.timestamp}</footer>}
  </main>;
}
export default function App() {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}><BrowserRouter><StatusPage /></BrowserRouter></QueryClientProvider>;
}
