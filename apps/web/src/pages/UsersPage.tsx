import {
  Loader2,
  Plus,
  Search,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '../components/EmptyState';
import {
  createUser,
  deleteUser,
  listUsers,
  resetUserPassword,
  toggleUserStatus,
  updateUser,
  type UserItem,
} from '../lib/api';
import { useAuth } from '../lib/auth';

const ROLES = ['admin', 'operator', 'statistisi', 'petugas', 'viewer'];

function formatDateId(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function UsersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; user?: UserItem } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ['users', { role: roleFilter, search, page }],
    queryFn: () =>
      listUsers({
        role: roleFilter === 'all' ? undefined : roleFilter,
        search: search.trim() || undefined,
        page,
        per_page: 15,
      }),
    placeholderData: (previous) => previous,
  });
  const users = query.data?.data ?? [];
  const meta = query.data?.meta;

  const toggleMutation = useMutation({
    mutationFn: (id: number) => toggleUserStatus(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
  const resetMutation = useMutation({
    mutationFn: (id: number) => resetUserPassword(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['users'] });

  const handleSave = async (payload: {
    name: string;
    email: string;
    phone: string | null;
    nip: string | null;
    password: string;
    role: string;
    editId?: number;
  }) => {
    setFormError(null);
    setBusy(true);
    try {
      if (payload.editId) {
        await updateUser(payload.editId, {
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          nip: payload.nip,
          role: payload.role,
        });
      } else {
        await createUser({
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          nip: payload.nip,
          password: payload.password,
          role: payload.role,
        });
      }
      setModal(null);
      invalidate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan pengguna.');
    } finally {
      setBusy(false);
    }
  };

  if (!hasPermission('users.manage')) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Manajemen Pengguna</h1>
        <p role="alert" className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-4 py-3 text-sm font-semibold text-chip-ditolak-fg">
          Anda tidak memiliki hak akses ke halaman ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Manajemen Pengguna</h1>
          <p className="mt-0.5 text-xs text-tinta2">
            {meta ? `${meta.total} akun terdaftar` : 'Memuat…'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setModal({ mode: 'create' });
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cta px-4 text-sm font-bold text-ctafg shadow-pop transition-colors hover:bg-sawah800"
        >
          <Plus size={17} aria-hidden="true" />
          Tambah Pengguna
        </button>
      </div>

      {/* Filter */}
      <div className="-mx-1 flex flex-wrap items-center gap-1.5 px-1 pb-1">
        {['all', ...ROLES].map((role) => {
          const active = roleFilter === role;
          const label = role === 'all' ? 'Semua' : role;
          return (
            <button
              key={role}
              onClick={() => {
                setRoleFilter(role);
                setPage(1);
              }}
              className={`min-h-10 rounded-full border px-4 text-xs font-bold capitalize transition-colors ${
                active ? 'border-cta bg-cta text-ctafg' : 'border-garis bg-panel text-tinta2 hover:text-tinta'
              }`}
            >
              {label}
            </button>
          );
        })}
        <label className="relative ml-auto block">
          <span className="sr-only">Cari pengguna</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta3" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama / email / NIP…"
            className="min-h-11 w-56 rounded-md border border-garis bg-panel py-2 pl-9 pr-3 text-sm text-tinta placeholder:text-tinta3 focus:outline-none focus:ring-2 focus:ring-cta"
          />
        </label>
      </div>

      {query.isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={28} className="animate-spin text-tinta3" aria-hidden="true" />
        </div>
      ) : query.isError ? (
        <p role="alert" className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-4 py-3 text-sm font-semibold text-chip-ditolak-fg">
          Gagal memuat daftar pengguna.
        </p>
      ) : users.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Tidak ada pengguna"
          description="Tidak ada akun yang cocok dengan filter. Tambahkan pengguna baru."
        />
      ) : (
        <>
          {/* Tabel — desktop */}
          <div className="hidden overflow-hidden rounded-lg border border-garis bg-panel shadow-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-garis text-left text-[11px] uppercase tracking-wider text-tinta3">
                  <th className="px-4 py-3 font-semibold">Nama &amp; NIP</th>
                  <th className="px-4 py-3 font-semibold">Kontak</th>
                  <th className="px-4 py-3 font-semibold">Peran</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Dibuat</th>
                  <th className="px-4 py-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-garis">
                {users.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-panel2">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-tinta">{user.name}</p>
                      <p className="font-mono text-[11px] text-tinta3">{user.nip ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-tinta2">
                      <p>{user.email}</p>
                      <p className="text-[11px] text-tinta3">{user.phone ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className="mr-1 inline-flex rounded-full bg-kpi-blue-bg px-2 py-0.5 text-[10px] font-bold capitalize text-kpi-blue-fg"
                        >
                          {role}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          user.is_active ? 'bg-chip-verifikasi-bg text-chip-verifikasi-fg' : 'bg-chip-draf-bg text-chip-draf-fg'
                        }`}
                      >
                        {user.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-tinta2">{formatDateId(user.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFormError(null);
                            setModal({ mode: 'edit', user });
                          }}
                          aria-label="Edit"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-tinta2 transition-colors hover:bg-panel2 hover:text-tinta"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Reset kata sandi ke "password"?')) {
                              void resetMutation.mutateAsync(user.id).catch(() => undefined);
                            }
                          }}
                          aria-label="Reset password"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-tinta2 transition-colors hover:bg-panel2 hover:text-tinta"
                        >
                          <KeyIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(user.is_active ? 'Nonaktifkan akun ini?' : 'Aktifkan kembali akun ini?')) {
                              void toggleMutation.mutateAsync(user.id).catch(() => undefined);
                            }
                          }}
                          aria-label={user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          className="flex h-9 w-9 items-center justify-center rounded-md text-tinta2 transition-colors hover:bg-panel2 hover:text-tinta"
                        >
                          <PowerIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Hapus akun (soft delete)?')) {
                              void deleteMutation.mutateAsync(user.id).catch(() => undefined);
                            }
                          }}
                          aria-label="Hapus"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-tinta3 transition-colors hover:text-err"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kartu — mobile */}
          <ul className="grid gap-2 md:hidden">
            {users.map((user) => (
              <li key={user.id} className="rounded-lg border border-garis bg-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-tinta">{user.name}</p>
                    <p className="text-[11px] text-tinta2">{user.email}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full bg-kpi-blue-bg px-2 py-0.5 text-[10px] font-bold capitalize text-kpi-blue-fg"
                        >
                          {role}
                        </span>
                      ))}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          user.is_active ? 'bg-chip-verifikasi-bg text-chip-verifikasi-fg' : 'bg-chip-draf-bg text-chip-draf-fg'
                        }`}
                      >
                        {user.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setModal({ mode: 'edit', user });
                    }}
                    className="min-h-10 rounded-md border border-garis px-3 text-xs font-bold text-tinta2"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Reset kata sandi ke "password"?')) {
                        void resetMutation.mutateAsync(user.id).catch(() => undefined);
                      }
                    }}
                    className="min-h-10 rounded-md border border-garis px-3 text-xs font-bold text-tinta2"
                  >
                    Reset sandi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(user.is_active ? 'Nonaktifkan?' : 'Aktifkan?')) {
                        void toggleMutation.mutateAsync(user.id).catch(() => undefined);
                      }
                    }}
                    className="min-h-10 rounded-md border border-garis px-3 text-xs font-bold text-tinta2"
                  >
                    {user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Hapus akun?')) {
                        void deleteMutation.mutateAsync(user.id).catch(() => undefined);
                      }
                    }}
                    className="min-h-10 rounded-md border border-garis px-3 text-xs font-bold text-err"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-11 items-center gap-1 rounded-md border border-garis bg-panel px-4 text-sm font-semibold text-tinta2 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <p className="text-xs font-medium text-tinta2">
                Halaman {meta.current_page} dari {meta.last_page} · {meta.total} akun
              </p>
              <button
                type="button"
                disabled={page >= meta.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex min-h-11 items-center gap-1 rounded-md border border-garis bg-panel px-4 text-sm font-semibold text-tinta2 disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          )}
        </>
      )}

      {modal && (
        <UserFormModal
          mode={modal.mode}
          user={modal.user}
          busy={busy}
          error={formError}
          onClose={() => {
            if (!busy) setModal(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function UserFormModal({
  mode,
  user,
  busy,
  error,
  onClose,
  onSave,
}: {
  mode: 'create' | 'edit';
  user?: UserItem;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    email: string;
    phone: string | null;
    nip: string | null;
    password: string;
    role: string;
    editId?: number;
  }) => void;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [nip, setNip] = useState(user?.nip ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.roles[0] ?? 'petugas');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      nip: nip.trim() || null,
      password,
      role,
      editId: mode === 'edit' ? user?.id : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg bg-panel p-6 shadow-pop"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-tinta">
            {mode === 'create' ? 'Tambah Pengguna Baru' : 'Edit Pengguna'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-10 w-10 items-center justify-center rounded-md text-tinta3 hover:text-tinta"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-3 py-2 text-xs font-semibold text-chip-ditolak-fg">
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-tinta2">Nama lengkap</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-tinta2">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-tinta2">NIP</span>
            <input
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-tinta2">Telepon</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-tinta2">Peran</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {mode === 'create' && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-tinta2">Kata sandi awal</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
              />
            </label>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-11 rounded-md border border-garis px-4 text-sm font-semibold text-tinta2 disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cta px-5 text-sm font-bold text-ctafg shadow-pop transition-colors hover:bg-sawah800 disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            Simpan
          </button>
        </div>
      </form>
    </div>
  );
}

function PencilIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>;
}

function KeyIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></svg>;
}

function PowerIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" /></svg>;
}
