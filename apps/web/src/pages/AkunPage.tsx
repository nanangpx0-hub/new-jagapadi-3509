import { Leaf, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../lib/auth';
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
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();

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
        {user.must_change_password && (
          <p role="alert" className="mt-4 rounded-md border border-chip-warn-bg bg-chip-warn-bg/40 px-3 py-2 text-xs font-semibold text-chip-warn-fg">
            Kata sandi Anda wajib diganti. Hubungi admin untuk reset dan masukkan kata sandi baru pada login berikutnya.
          </p>
        )}
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
