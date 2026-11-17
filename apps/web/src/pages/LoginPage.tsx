import { ChevronRight, Eye, EyeOff, Leaf, Loader2, ShieldCheck, Sprout, Tractor } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin } from '../lib/api';
import { useAuth } from '../lib/auth';

const DEMO_ACCOUNTS = [
  { email: 'petugas@jagapadi.test', label: 'Petugas lapangan', hint: 'mitra statistik / PPL / TPHP' },
  { email: 'operator@jagapadi.test', label: 'Operator data', hint: 'dinas kabupaten' },
  { email: 'statistisi@jagapadi.test', label: 'Statistisi', hint: 'verifikator laporan' },
  { email: 'admin@jagapadi.test', label: 'Admin', hint: 'kelola sistem & master' },
  { email: 'superadmin@jagapadi.test', label: 'Super Admin', hint: 'akses tertinggi sistem BPS 3509' },
  { email: 'viewer@jagapadi.test', label: 'Pimpinan', hint: 'baca dashboard & laporan resmi' },
];

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('petugas@jagapadi.test');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await apiLogin(email.trim(), password);
      login(data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk. Periksa email dan password Anda.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Panel brand — desktop */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sawah950 p-10 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/5"
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-white/10">
            <Sprout size={28} strokeWidth={2} className="text-padi" />
          </span>
          <span>
            <span className="block font-display text-2xl font-bold tracking-tight">JAGAPADI</span>
            <span className="text-xs font-medium text-white/60">Kabupaten Jember · BPS 3509</span>
          </span>
        </div>

        <div className="relative max-w-lg">
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
            Kenali kondisi sekitar.
            <br />
            Laporkan lebih cepat.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/75">
            Sistem pelaporan &amp; analitik pertanian Kabupaten Jember — hama, penyakit tanaman,
            banjir dan kerusakan irigasi tercatat dari lapangan, terverifikasi, dan terbaca untuk
            pengambilan keputusan.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/75">
            <li className="flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-padi" aria-hidden="true" />
              Data lapangan terverifikasi oleh statistisi sebelum terbit
            </li>
            <li className="flex items-center gap-2.5">
              <Leaf size={18} className="text-padi" aria-hidden="true" />
              Validasi titik GPS terhadap batas desa otomatis (PostGIS)
            </li>
            <li className="flex items-center gap-2.5">
              <Tractor size={18} className="text-padi" aria-hidden="true" />
              Offline-first — draf tersimpan di perangkat saat sinyal lemah
            </li>
          </ul>
        </div>

        <p className="relative text-[11px] font-medium uppercase tracking-wider text-white/40">
          Badan Pusat Statistik Kabupaten Jember · Dinas TPHP
        </p>
      </section>

      {/* Form masuk */}
      <section className="flex flex-col items-center justify-center bg-latar px-4 py-10 sm:px-8">
        {/* Brand ringkas — mobile */}
        <div className="mb-6 flex items-center gap-2 lg:hidden">
          <Sprout size={24} strokeWidth={2} className="text-sawah800" aria-hidden="true" />
          <span className="font-display text-xl font-bold tracking-tight text-tinta">JAGAPADI</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-lg border border-garis bg-panel p-6 shadow-card sm:p-8"
        >
          <h2 className="font-display text-2xl font-bold tracking-tight text-tinta">Masuk</h2>
          <p className="mt-1 text-sm text-tinta2">
            Khusus mitra statistik BPS, PPL, dan petugas Dinas TPHP Kabupaten Jember.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-semibold text-tinta2">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta placeholder:text-tinta3 focus:outline-none focus:ring-2 focus:ring-cta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@jagapadi.test"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-semibold text-tinta2">
                Kata sandi
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 pr-11 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-md text-tinta3 hover:text-tinta"
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-3 py-2 text-xs font-semibold text-chip-ditolak-fg"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-cta px-4 text-sm font-bold text-ctafg shadow-pop transition-colors hover:bg-sawah800 disabled:opacity-60"
            >
              {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              Masuk
            </button>
          </div>

          <details className="mt-5 border-t border-garis pt-4">
            <summary className="cursor-pointer text-xs font-semibold text-tinta2 hover:text-tinta">
              Gunakan akun demo <span className="font-normal text-tinta3">(password: password)</span>
            </summary>
            <ul className="mt-3 space-y-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword('password');
                      setError(null);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-garis bg-panel2 px-3 py-2 text-left transition-colors hover:border-cta"
                  >
                    <span>
                      <span className="block text-xs font-bold text-tinta">{account.label}</span>
                      <span className="block text-[11px] text-tinta3">{account.hint} · {account.email}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-tinta3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </form>

        <p className="mt-6 text-center text-[11px] text-tinta3">
          Lupa kata sandi? Hubungi admin kabupaten Jember melalui BPS 3509.
        </p>
      </section>
    </main>
  );
}
