import { Bug, Check, Loader2, Plus, Search, X, XCircle, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '../components/EmptyState';
import { Panel } from '../components/Panel';
import {
  approveOptProposal,
  createOpt,
  createOptProposal,
  listOptProposals,
  listOpts,
  rejectOptProposal,
  type OptProposal,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import type { OptItem } from '../lib/types';

type CommodityTab = 'all' | 'padi' | 'jagung' | 'kedelai' | 'umbi';

const COMMODITY_TABS: Array<{ value: CommodityTab; label: string }> = [
  { value: 'all', label: 'Semua Pangan' },
  { value: 'padi', label: 'Padi' },
  { value: 'jagung', label: 'Jagung' },
  { value: 'kedelai', label: 'Kedelai' },
  { value: 'umbi', label: 'Umbi-umbian' },
];

const CROP_LABEL: Record<string, string> = {
  padi: 'Padi',
  jagung: 'Jagung',
  kedelai: 'Kedelai',
  ubi_kayu: 'Ubi Kayu',
  ubi_jalar: 'Ubi Jalar',
};

const isUmbi = (crop: string) => crop === 'ubi_kayu' || crop === 'ubi_jalar';

export function OptsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<CommodityTab>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'hama' | 'penyakit'>('all');
  const [selected, setSelected] = useState<OptItem | null>(null);

  const [masterOpen, setMasterOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<OptProposal | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Master OPT
  const [optForm, setOptForm] = useState({
    code: '', name: '', scientific_name: '', local_name: '', category: 'hama', target_crop: 'padi',
    danger_level: 'Sedang', description: '', attack_signs: '',
  });
  // Form Usulan OPT
  const [proposalForm, setProposalForm] = useState({
    name: '', scientific_name: '', local_name: '', category: 'hama', target_crop: 'padi',
    attack_signs: '', description: '',
  });

  const query = useQuery({ queryKey: ['opts'], queryFn: () => listOpts() });
  const allOpts = query.data ?? [];
  const proposalsQuery = useQuery({
    queryKey: ['opt-proposals'],
    queryFn: listOptProposals,
    enabled: hasPermission('opt-proposals.create') || hasPermission('opt-proposals.review'),
  });
  const proposals = proposalsQuery.data ?? [];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['opts'] });
    void queryClient.invalidateQueries({ queryKey: ['opt-proposals'] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveOptProposal(id),
    onSuccess: refresh,
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) => rejectOptProposal(id, notes),
    onSuccess: () => { setRejectTarget(null); setRejectNotes(''); refresh(); },
  });

  const submitMaster = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await createOpt({
        code: optForm.code.trim(),
        name: optForm.name.trim(),
        scientific_name: optForm.scientific_name.trim() || null,
        local_name: optForm.local_name.trim() || null,
        category: optForm.category,
        target_crop: optForm.target_crop,
        danger_level: optForm.danger_level,
        description: optForm.description.trim() || null,
        attack_signs: optForm.attack_signs.trim() || null,
        is_active: true,
      });
      setMasterOpen(false);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menambah OPT.');
    } finally {
      setSaving(false);
    }
  };

  const submitProposal = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await createOptProposal({
        name: proposalForm.name.trim(),
        scientific_name: proposalForm.scientific_name.trim() || null,
        local_name: proposalForm.local_name.trim() || null,
        category: proposalForm.category,
        target_crop: proposalForm.target_crop,
        attack_signs: proposalForm.attack_signs.trim() || null,
        description: proposalForm.description.trim() || null,
      });
      setProposalOpen(false);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal mengirim usulan.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = allOpts.filter((opt) => {
    const matchTab =
      tab === 'all' || (tab === 'umbi' ? isUmbi(opt.target_crop) : opt.target_crop === tab);
    const matchCategory = category === 'all' || opt.category === category;
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      [opt.name, opt.scientific_name, opt.local_name, opt.description, opt.code]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q));
    return matchTab && matchCategory && matchSearch;
  });

  // Tutup modal dengan Escape
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Katalog OPT Pangan</h1>
          <p className="mt-0.5 text-xs text-tinta2">
            Organisme Pengganggu Tanaman komoditas pangan — padi, jagung, kedelai, ubi kayu &amp; ubi jalar
          </p>
        </div>
        <label className="relative block">
          <span className="sr-only">Cari OPT</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta3" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama / kode / gejala OPT…"
            className="min-h-11 w-64 rounded-md border border-garis bg-panel py-2 pl-9 pr-3 text-sm text-tinta placeholder:text-tinta3 focus:outline-none focus:ring-2 focus:ring-cta"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {hasPermission('opts.manage') && (
            <button
              type="button"
              onClick={() => { setFormError(null); setMasterOpen(true); }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-cta px-3 py-2 text-xs font-bold text-ctafg transition-colors hover:bg-sawah800"
            >
              <Plus size={15} aria-hidden="true" /> Tambah OPT
            </button>
          )}
          {hasPermission('opt-proposals.create') && (
            <button
              type="button"
              onClick={() => { setFormError(null); setProposalOpen(true); }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-garis bg-panel px-3 py-2 text-xs font-bold text-tinta2 transition-colors hover:border-cta hover:text-cta"
            >
              <Plus size={15} aria-hidden="true" /> Usulkan OPT Baru
            </button>
          )}
        </div>
      </div>

      {/* Tab komoditas pangan */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filter komoditas">
        {COMMODITY_TABS.map(({ value, label }) => {
          const active = tab === value;
          return (
            <button
              key={value}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(value)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-bold transition-colors ${
                active ? 'border-cta bg-cta text-ctafg' : 'border-garis bg-panel text-tinta2 hover:text-tinta'
              }`}
            >
              {label}
            </button>
          );
        })}
        <span className="mx-1 self-center border-l border-garis pl-2">
          {(['all', 'hama', 'penyakit'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={`min-h-10 shrink-0 rounded-full px-3 text-[11px] font-semibold capitalize transition-colors ${
                category === value ? 'bg-chip-draf-bg text-chip-draf-fg' : 'text-tinta3 hover:text-tinta'
              }`}
            >
              {value === 'all' ? 'Semua' : value}
            </button>
          ))}
        </span>
      </div>

      {query.isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={26} className="animate-spin text-tinta3" aria-hidden="true" />
        </div>
      ) : query.isError ? (
        <p role="alert" className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-4 py-3 text-sm font-semibold text-chip-ditolak-fg">
          Gagal memuat katalog OPT.
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bug}
          title="Tidak ada OPT ditemukan"
          description="Coba kata kunci, komoditas, atau kategori lain."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((opt) => (
            <li
              key={opt.id}
              className="flex flex-col overflow-hidden rounded-lg border border-garis bg-panel shadow-card transition-shadow hover:shadow-pop"
            >
              <div className="relative h-40 overflow-hidden border-b border-garis bg-panel2">
                {opt.photo_url ? (
                  <img
                    src={opt.photo_url}
                    alt={`Ilustrasi skematis ${opt.name}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Bug size={56} className="text-tinta3" aria-hidden="true" />
                  </div>
                )}
                <span
                  className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white ${
                    opt.danger_level === 'Tinggi' ? 'bg-chip-ditolak-fg' : 'bg-chip-warn-fg'
                  }`}
                >
                  {opt.danger_level}
                </span>
                <span className="absolute right-3 top-3 rounded-full bg-panel/90 px-2.5 py-1 text-[10px] font-bold text-tinta2">
                  {CROP_LABEL[opt.target_crop] ?? opt.target_crop}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-base font-bold leading-snug text-tinta">{opt.name}</h2>
                  <span className="shrink-0 font-mono text-[10px] font-semibold text-tinta3">{opt.code}</span>
                </div>
                {opt.scientific_name && (
                  <p className="text-[11px] italic text-tinta3">{opt.scientific_name}</p>
                )}
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-tinta2">{opt.description}</p>
                {opt.attack_signs && (
                  <p className="line-clamp-2 text-[11px] leading-4 text-tinta2">
                    <span className="font-semibold text-tinta">Gejala: </span>
                    {opt.attack_signs}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(opt)}
                  className="mt-auto inline-flex min-h-10 items-center gap-1.5 self-start rounded-md border border-garis px-3 pt-2 text-xs font-bold text-cta transition-colors hover:border-cta"
                >
                  Lihat Panduan Pengendalian (PHT)
                  <ExternalLink size={13} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-center text-[10px] text-tinta3">
        Ilustrasi skematis oleh JAGAPADI — bukan foto identifikasi lapangan. Gunakan sebagai panduan awal, konfirmasi di lapangan.
      </p>

      {/* Usulan OPT Lapangan */}
      {(hasPermission('opt-proposals.create') || hasPermission('opt-proposals.review')) && (
        <Panel title="Usulan OPT Lapangan" subtitle="Usulan dari petugas untuk ditinjau admin/operator" bodyClassName="p-0">
          {proposals.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Bug} title="Belum ada usulan" description="Usulan OPT dari lapangan akan tampil di sini." />
            </div>
          ) : (
            <ul className="divide-y divide-garis">
              {proposals.map((proposal) => (
                <li key={proposal.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-tinta">{proposal.name}</p>
                    <p className="text-[11px] text-tinta2">
                      {proposal.scientific_name || '—'} · {proposal.category} · {proposal.target_crop}
                    </p>
                    <p className="mt-0.5 text-[11px] text-tinta3">
                      Diajukan oleh {proposal.user?.name ?? `#${proposal.user_id}`} · Status: {proposal.status}
                      {proposal.review_notes ? ` · Catatan: ${proposal.review_notes}` : ''}
                    </p>
                  </div>
                  {hasPermission('opt-proposals.review') && proposal.status === 'Menunggu' && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(proposal.id)}
                        className="inline-flex min-h-10 items-center gap-1 rounded-md bg-cta px-3 py-2 text-xs font-bold text-ctafg disabled:opacity-60"
                      >
                        <Check size={14} aria-hidden="true" /> Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectTarget(proposal); setRejectNotes(''); }}
                        className="inline-flex min-h-10 items-center gap-1 rounded-md border border-chip-ditolak-fg/40 px-3 py-2 text-xs font-bold text-chip-ditolak-fg"
                      >
                        <XCircle size={14} aria-hidden="true" /> Tolak
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {/* Modal Tambah Master OPT */}
      {masterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => setMasterOpen(false)}>
          <form
            onSubmit={(e) => void submitMaster(e)}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-panel p-6 shadow-pop"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-tinta">Tambah Master OPT</h2>
              <button type="button" onClick={() => setMasterOpen(false)} aria-label="Tutup">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {formError && <p role="alert" className="mb-3 rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-3 py-2 text-xs font-semibold text-chip-ditolak-fg">{formError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Kode OPT *</span>
                <input required value={optForm.code} onChange={(e) => setOptForm({ ...optForm, code: e.target.value })} placeholder="OPT-PADI-XXX" className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Nama OPT *</span>
                <input required value={optForm.name} onChange={(e) => setOptForm({ ...optForm, name: e.target.value })} className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Nama ilmiah</span>
                <input value={optForm.scientific_name} onChange={(e) => setOptForm({ ...optForm, scientific_name: e.target.value })} className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Kategori</span>
                <select value={optForm.category} onChange={(e) => setOptForm({ ...optForm, category: e.target.value })} className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta">
                  <option value="hama">Hama</option><option value="penyakit">Penyakit</option><option value="gulma">Gulma</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Komoditas sasaran</span>
                <input value={optForm.target_crop} onChange={(e) => setOptForm({ ...optForm, target_crop: e.target.value })} className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Deskripsi</span>
                <textarea value={optForm.description} onChange={(e) => setOptForm({ ...optForm, description: e.target.value })} className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta" />
              </label>
              <button type="submit" disabled={saving} className="sm:col-span-2 inline-flex min-h-11 items-center justify-center rounded-md bg-cta px-4 text-sm font-bold text-ctafg disabled:opacity-60">
                {saving ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : 'Simpan Master OPT'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Usulan OPT */}
      {proposalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => setProposalOpen(false)}>
          <form
            onSubmit={(e) => void submitProposal(e)}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-panel p-6 shadow-pop"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-tinta">Usulkan OPT Baru</h2>
              <button type="button" onClick={() => setProposalOpen(false)} aria-label="Tutup">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {formError && <p role="alert" className="mb-3 rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-3 py-2 text-xs font-semibold text-chip-ditolak-fg">{formError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Nama OPT yang ditemukan *</span>
                <input required value={proposalForm.name} onChange={(e) => setProposalForm({ ...proposalForm, name: e.target.value })} className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Nama ilmiah / nama lokal</span>
                <input value={proposalForm.scientific_name} onChange={(e) => setProposalForm({ ...proposalForm, scientific_name: e.target.value })} placeholder="Nama ilmiah" className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Kategori</span>
                <select value={proposalForm.category} onChange={(e) => setProposalForm({ ...proposalForm, category: e.target.value })} className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta">
                  <option value="hama">Hama</option><option value="penyakit">Penyakit</option><option value="gulma">Gulma</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Komoditas sasaran</span>
                <input value={proposalForm.target_crop} onChange={(e) => setProposalForm({ ...proposalForm, target_crop: e.target.value })} className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Gejala serangan</span>
                <textarea value={proposalForm.attack_signs} onChange={(e) => setProposalForm({ ...proposalForm, attack_signs: e.target.value })} className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-tinta2">Deskripsi</span>
                <textarea value={proposalForm.description} onChange={(e) => setProposalForm({ ...proposalForm, description: e.target.value })} className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta" />
              </label>
              <button type="submit" disabled={saving} className="sm:col-span-2 inline-flex min-h-11 items-center justify-center rounded-md bg-cta px-4 text-sm font-bold text-ctafg disabled:opacity-60">
                {saving ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : 'Kirim Usulan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Tolak Usulan */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => setRejectTarget(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              rejectMutation.mutate({ id: rejectTarget.id, notes: rejectNotes });
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg bg-panel p-6 shadow-pop"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-tinta">Tolak Usulan OPT</h2>
              <button type="button" onClick={() => setRejectTarget(null)} aria-label="Tutup">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-tinta2">Catatan penolakan *</span>
              <textarea required minLength={5} value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} className="w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta" placeholder="Alasan penolakan (minimal 5 karakter)" />
            </label>
            <button type="submit" disabled={rejectMutation.isPending} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-chip-ditolak-fg px-4 text-sm font-bold text-white disabled:opacity-60">
              Kirim Penolakan
            </button>
          </form>
        </div>
      )}

      {/* Modal detail PHT */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="opt-modal-title"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-lg bg-panel sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-garis bg-panel px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-tinta3">
                  {CROP_LABEL[selected.target_crop] ?? selected.target_crop} · {selected.category}
                </p>
                <h2 id="opt-modal-title" className="mt-0.5 font-display text-xl font-bold text-tinta">
                  {selected.name}
                </h2>
                {selected.scientific_name && (
                  <p className="text-xs italic text-tinta3">{selected.scientific_name}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                autoFocus
                aria-label="Tutup"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-tinta3 transition-colors hover:bg-panel2 hover:text-tinta"
              >
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <div className="px-6 py-5">
              {selected.photo_url && (
                <img
                  src={selected.photo_url}
                  alt={`Ilustrasi skematis ${selected.name}`}
                  className="h-40 w-full rounded-md border border-garis object-contain bg-panel2"
                />
              )}
              <Section title="Deskripsi">{selected.description}</Section>
              {selected.attack_signs && (
                <Section title="Jenis / Gejala Serangan">{selected.attack_signs}</Section>
              )}
              {selected.management && (
                <Section title="Panduan Pengendalian Terpadu (PHT)">
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-6 text-tinta">
                    {selected.management.split(';').map((step, index) => (
                      <li key={index}>{step.trim()}</li>
                    ))}
                  </ol>
                </Section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-tinta3">{title}</h3>
      <div className="mt-1.5 text-sm leading-6 text-tinta2">{children}</div>
    </section>
  );
}
