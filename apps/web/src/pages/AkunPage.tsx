import { KeyRound, Leaf, Loader2, LogOut, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { changePasswordRequest } from '../lib/api';
import { useTheme, type ThemePreference } from '../lib/theme';
import { Panel } from '../components/Panel';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'sawah', label: 'Tampilan Sekarang (Sawah)', Icon: Leaf },
  { value: 'white', label: 'Putih Bersih (White)', Icon: Sun },
  { value: 'dark', label: 'Gelap (Dark)', Icon: Moon },
];

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function AkunPage() {
  const { user, login, logout } = useAuth();
  const { preference, setPreference } = useTheme();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordNotice(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }
    setPasswordBusy(true);
    try {
      const res = await changePasswordRequest({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      // Perbarui sesi klien agar banner must_change_password langsung hilang.
      if (user) login({ ...user, must_change_password: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordNotice(res.message || 'Kata sandi berhasil diubah.');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Gagal mengubah kata sandi.');
    } finally {
      setPasswordBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Akun Saya</h1>
        <p className="mt-0.5 text-xs text-tinta2">Profil, peran, dan preferensi tampilan aplikasi</p>
      </div>

      <Panel title="Profil" bodyClassName="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sawah800 font-display text-xl font-bold text-white">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-tinta">{user.name}</p>
            <p className="text-sm text-tinta2">{user.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {user.roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-kpi-blue-bg px-2.5 py-0.5 text-[11px] font-bold capitalize text-kpi-blue-fg"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-garis pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">NIP / ID Mitra</dt>
            <dd className="mt-0.5 font-mono text-tinta">{user.nip ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Telepon</dt>
            <dd className="mt-0.5 text-tinta">{user.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Wilayah Tugas</dt>
            <dd className="mt-0.5 text-tinta">
              {user.assigned_district
                ? `Kec. ${user.assigned_district.name} (${user.assigned_district.code})`
                : 'Seluruh Kabupaten Jember (3509)'}
            </dd>
          </div>
        </dl>
        {user.must_change_password && (
          <p role="alert" className="mt-4 rounded-md border border-chip-warn-bg bg-chip-warn-bg/40 px-3 py-2 text-xs font-semibold text-chip-warn-fg">
            Kata sandi Anda wajib diganti. Hubungi admin untuk reset dan masukkan kata sandi baru pada login berikutnya.
          </p>
        )}
      </Panel>

      <Panel title="Ubah Kata Sandi" subtitle="Gunakan minimal 8 karakter" bodyClassName="p-5">
        <form onSubmit={(e) => void submitPassword(e)} className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-tinta2">Kata sandi saat ini</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-tinta2">Kata sandi baru</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-tinta2">Konfirmasi kata sandi baru</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            />
          </label>
          {passwordError && (
            <p role="alert" className="sm:col-span-2 rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-3 py-2 text-xs font-semibold text-chip-ditolak-fg">
              {passwordError}
            </p>
          )}
          {passwordNotice && (
            <p role="status" className="sm:col-span-2 rounded-md border border-chip-verifikasi-bg bg-chip-verifikasi-bg/40 px-3 py-2 text-xs font-semibold text-chip-verifikasi-fg">
              {passwordNotice}
            </p>
          )}
          <button
            type="submit"
            disabled={passwordBusy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cta px-4 text-sm font-bold text-ctafg transition-colors hover:bg-sawah800 disabled:opacity-60 sm:col-span-2"
          >
            {passwordBusy
              ? <Loader2 size={17} className="animate-spin" aria-hidden="true" />
              : <KeyRound size={17} aria-hidden="true" />}
            Simpan Kata Sandi Baru
          </button>
        </form>
      </Panel>

      <Panel title="Tampilan" subtitle="Mode terang cocok untuk lapangan; mode gelap untuk kantor" bodyClassName="p-5">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Pilih mode tampilan">
          {THEME_OPTIONS.map(({ value, label, Icon }) => {
            const active = preference === value;
            return (
              <button
                key={value}
                role="radio"
                aria-checked={active}
                onClick={() => setPreference(value)}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-3 py-3 text-xs font-bold transition-colors ${
                  active
                    ? 'border-cta bg-cta text-ctafg'
                    : 'border-garis bg-panel2 text-tinta2 hover:text-tinta'
                }`}
              >
                <Icon size={20} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Aplikasi" bodyClassName="p-5">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Versi</dt>
            <dd className="mt-0.5 font-mono text-tinta">JAGAPADI v3.0.0</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Wilayah kerja</dt>
            <dd className="mt-0.5 text-tinta">Kabupaten Jember (3509)</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={logout}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-chip-ditolak-fg/40 px-4 text-sm font-bold text-chip-ditolak-fg transition-colors hover:bg-chip-ditolak-bg/30 sm:w-auto"
        >
          <LogOut size={18} aria-hidden="true" />
          Keluar dari aplikasi
        </button>
      </Panel>
    </div>
  );
}
