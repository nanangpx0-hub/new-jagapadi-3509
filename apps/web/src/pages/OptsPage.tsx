import { Bug, Loader2, Search, X, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '../components/EmptyState';
import { listOpts } from '../lib/api';
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
  const [tab, setTab] = useState<CommodityTab>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'hama' | 'penyakit'>('all');
  const [selected, setSelected] = useState<OptItem | null>(null);

  const query = useQuery({ queryKey: ['opts'], queryFn: () => listOpts() });
  const allOpts = query.data ?? [];

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
