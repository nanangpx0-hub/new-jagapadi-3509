import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ROLES, REPORT_TYPES } from '@jagapadi/shared';
import { getHealth } from './lib/api';
import { compressPhoto } from './offline/compress-image';
import { getFieldDB } from './offline/database';
import { AuthProvider, useAuth } from './lib/auth';
import { CascadingRegionSelect, DistrictItem, VillageItem } from './components/CascadingRegionSelect';

function MainApp() {
  const [online, setOnline] = useState(navigator.onLine);
  const [tab, setTab] = useState<'status' | 'wilayah' | 'opts'>('status');
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictItem | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<VillageItem | null>(null);
  const [loginEmail, setLoginEmail] = useState('petugas@jagapadi.test');
  const [loginPassword, setLoginPassword] = useState('password');
  const [loginError, setLoginError] = useState<string | null>(null);

  const { user, isAuthenticated, login, logout } = useAuth();

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, refetchInterval: 30000, retry: 1 });

  // Query Master OPT
  const optsQuery = useQuery<{ status: string; data: Array<{ id: number; code: string; name: string; category: string; danger_level: string; description: string | null }> }>({
    queryKey: ['opts'],
    queryFn: async () => {
      const res = await fetch('/api/opts');
      if (!res.ok) throw new Error('Gagal memuat OPT');
      return res.json();
    },
    enabled: tab === 'opts',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login gagal.');
      }
      login(data.token, data.user);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login gagal');
    }
  };

  const labels = { database: 'PostgreSQL', postgis: 'PostGIS', redis: 'Redis', storage: 'Storage' } as const;

  return (
    <main className="mx-auto max-w-5xl p-5 md:p-10 font-sans">
      <header className="mb-6 rounded-2xl bg-green-800 p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-green-200">Kabupaten Jember · BPS 3509</p>
            <h1 className="my-1 text-3xl font-extrabold">JAGAPADI v3</h1>
            <p className="text-sm text-green-100">Sistem Pelaporan & Analitik Pertanian Geospasial Terpadu</p>
          </div>
          {isAuthenticated ? (
            <div className="bg-green-900/80 rounded-xl p-3 text-right">
              <p className="text-sm font-bold">{user?.name}</p>
              <p className="text-xs text-green-200 capitalize">{user?.roles.join(', ')} · {user?.email}</p>
              <button
                onClick={logout}
                className="mt-2 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md font-medium"
              >
                Logout
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="bg-green-900/80 rounded-xl p-3 flex flex-col gap-2 w-full md:w-auto">
              <div className="flex flex-wrap gap-2">
                <select
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="text-xs p-1.5 rounded bg-white text-slate-900"
                >
                  <option value="admin@jagapadi.test">Admin (Semua Akses)</option>
                  <option value="operator@jagapadi.test">Operator (Dinas)</option>
                  <option value="statistisi@jagapadi.test">Statistisi (Verifikator)</option>
                  <option value="petugas@jagapadi.test">Petugas (POPT / Lapangan)</option>
                  <option value="viewer@jagapadi.test">Viewer (Pimpinan)</option>
                </select>
                <button
                  type="submit"
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded"
                >
                  Masuk Akun Demo
                </button>
              </div>
              {loginError && <p className="text-xs text-red-300">{loginError}</p>}
            </form>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-green-700/60">
          <button
            onClick={() => setTab('status')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              tab === 'status' ? 'bg-white text-green-900' : 'bg-green-700/50 hover:bg-green-700 text-white'
            }`}
          >
            Status Sistem
          </button>
          <button
            onClick={() => setTab('wilayah')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              tab === 'wilayah' ? 'bg-white text-green-900' : 'bg-green-700/50 hover:bg-green-700 text-white'
            }`}
          >
            Master Wilayah (31 Kec / 248 Desa)
          </button>
          <button
            onClick={() => setTab('opts')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              tab === 'opts' ? 'bg-white text-green-900' : 'bg-green-700/50 hover:bg-green-700 text-white'
            }`}
          >
            Katalog OPT ({optsQuery.data?.data.length ?? '49'})
          </button>
        </div>
      </header>

      {/* Tab Content: Status Sistem */}
      {tab === 'status' && (
        <div className="space-y-6">
          <section aria-labelledby="health-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 id="health-heading" className="text-xl font-bold text-slate-800">Kesehatan Infrastruktur (Fase 0 & 1)</h2>
            <p className="my-2 text-sm text-slate-600" role="status">
              {health.isPending
                ? 'Memeriksa layanan…'
                : health.error
                ? 'Backend belum terhubung: ' + health.error.message
                : health.data?.status === 'ok'
                ? '✅ Seluruh layanan host & kontainer aktif normal.'
                : 'Sebagian layanan mengalami gangguan'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              {Object.entries(labels).map(([key, label]) => {
                const check = health.data?.checks[key as keyof typeof labels];
                return (
                  <article key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-base font-bold text-slate-700">{label}</h3>
                    <p className={check?.status === 'ok' ? 'font-semibold text-green-700' : 'font-semibold text-red-600'}>
                      {check?.status === 'ok' ? 'Terhubung (OK)' : check ? 'Gangguan' : 'Belum diketahui'}
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-1">
                      {check?.version ?? check?.driver ?? check?.response ?? (check?.writable === true ? 'Penyimpanan lokal dapat ditulis' : '')}
                    </p>
                  </article>
                );
              })}
            </div>
            <button
              className="mt-4 rounded-lg bg-green-700 hover:bg-green-800 px-4 py-2 text-sm font-bold text-white transition disabled:opacity-60"
              disabled={health.isFetching}
              onClick={() => void health.refetch()}
            >
              Periksa Ulang
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="offline-heading">
            <h2 id="offline-heading" className="text-xl font-bold text-slate-800">Kesiapan Offline Lapangan (PWA)</h2>
            <div className="grid gap-3 text-sm text-slate-600 mt-3 sm:grid-cols-2">
              <p>📡 Status Sinyal: <span className="font-semibold">{online ? 'Online' : 'Offline'}</span></p>
              <p>🖼️ Kompresi WebP: <span className="font-semibold text-green-700">{typeof compressPhoto === 'function' ? 'Aktif' : 'Belum siap'}</span></p>
              <p>💾 IndexedDB Draft: <span className="font-semibold text-green-700">{typeof getFieldDB === 'function' && 'indexedDB' in window ? 'Didukung' : 'Tidak didukung'}</span></p>
              <p>⚙️ Service Worker: <span className="font-semibold text-green-700">{'serviceWorker' in navigator ? 'Didukung' : 'Tidak didukung'}</span></p>
            </div>
          </section>

          <div className="grid gap-5 sm:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 mb-2">5 Peran Pengguna (RBAC)</h2>
              <ul className="list-inside list-disc text-sm text-slate-600 space-y-1">
                {Object.values(ROLES).map((role) => (
                  <li key={role} className="capitalize">{role}</li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 mb-2">6 Domain Laporan Pertanian</h2>
              <ul className="list-inside list-disc text-sm text-slate-600 space-y-1">
                {Object.values(REPORT_TYPES).map((type) => (
                  <li key={type} className="capitalize">{type}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {/* Tab Content: Master Wilayah */}
      {tab === 'wilayah' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-800">Dropdown Wilayah Bertingkat (Cascading Select)</h2>
          <p className="text-sm text-slate-600">
            Komponen pemilih wilayah Kabupaten Jember (BPS 3509) dengan 31 Kecamatan dan 248 Desa/Kelurahan yang dihubungkan ke PostGIS.
          </p>

          <CascadingRegionSelect
            onDistrictChange={setSelectedDistrict}
            onVillageChange={setSelectedVillage}
          />

          {(selectedDistrict || selectedVillage) && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-slate-700 mt-4">
              <p className="font-semibold text-green-900">Wilayah Terpilih:</p>
              <p>Kecamatan: <span className="font-medium">{selectedDistrict ? `${selectedDistrict.code} - ${selectedDistrict.name}` : '-'}</span></p>
              <p>Koordinat Centroid: <span className="font-mono text-xs">{selectedDistrict?.latitude}, {selectedDistrict?.longitude}</span></p>
              <p>Desa/Kelurahan: <span className="font-medium">{selectedVillage ? `${selectedVillage.code} - ${selectedVillage.name}` : 'Belum dipilih'}</span></p>
            </div>
          )}
        </section>
      )}

      {/* Tab Content: Master OPT */}
      {tab === 'opts' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Katalog Organisme Pengganggu Tumbuhan (OPT)</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
              {optsQuery.data?.data.length ?? 0} Jenis Terdaftar
            </span>
          </div>

          {optsQuery.isLoading ? (
            <p className="text-sm text-slate-500">Memuat katalog OPT...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {optsQuery.data?.data.map((opt) => (
                <article key={opt.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:shadow transition">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-mono font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      {opt.code}
                    </span>
                    <span className="text-xs capitalize font-medium text-slate-500">
                      {opt.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-800 mt-2">{opt.name}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                    {opt.description || 'Tidak ada deskripsi'}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {health.data && (
        <footer className="mt-8 text-xs text-slate-400 text-center">
          JAGAPADI v3 · Zona Waktu: {health.data.timezone} · Waktu Server: {health.data.timestamp}
        </footer>
      )}
    </main>
  );
}

export default function App() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <BrowserRouter>
          <MainApp />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
