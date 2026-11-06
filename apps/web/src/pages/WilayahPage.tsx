import { Loader2, MapPin, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CascadingRegionSelect, type DistrictItem, type VillageItem } from '../components/CascadingRegionSelect';
import { Panel } from '../components/Panel';
import { districtSlsStats, listVillageSls } from '../lib/api';

export function WilayahPage() {
  const [district, setDistrict] = useState<DistrictItem | null>(null);
  const [village, setVillage] = useState<VillageItem | null>(null);
  const [slsSearch, setSlsSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(slsSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [slsSearch]);

  const statsQuery = useQuery({
    queryKey: ['district-sls-stats', district?.id],
    queryFn: () => districtSlsStats(district!.id),
    enabled: !!district,
  });

  const slsQuery = useQuery({
    queryKey: ['village-sls', village?.id, debounced],
    queryFn: () => listVillageSls(village!.id, debounced || undefined),
    enabled: !!village,
  });

  const rows = slsQuery.data?.data ?? [];
  const summary = slsQuery.data?.summary;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Master Wilayah &amp; SLS</h1>
        <p className="mt-0.5 text-xs text-tinta2">
          31 kecamatan, 248 desa/kelurahan, dan 16.543 SLS (RT/RW/Dusun) Kabupaten Jember (BPS 3509) — terhubung PostGIS.
        </p>
      </div>

      <Panel title="Pemilihan Wilayah Bertingkat" subtitle="Kecamatan → Desa/Kelurahan → SLS (RT/RW/Dusun)">
        <CascadingRegionSelect
          onDistrictChange={setDistrict}
          onVillageChange={setVillage}
        />
      </Panel>

      {district && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="SLS di Kecamatan" value={statsQuery.data ? String(statsQuery.data.total_sls) : '—'} />
          <StatCard label="Desa/Kelurahan" value={statsQuery.data ? String(statsQuery.data.total_villages) : '—'} />
          <StatCard label="Jiwa (Muatan KK)" value={statsQuery.data ? statsQuery.data.total_muatan.toLocaleString('id-ID') : '—'} />
          <StatCard label="Luas Wilayah (ha)" value={statsQuery.data ? statsQuery.data.total_luas_ha.toLocaleString('id-ID', { maximumFractionDigits: 1 }) : '—'} />
        </div>
      )}

      {village && (
        <Panel
          title={`SLS di Desa/Kelurahan ${village.name}`}
          subtitle={village ? `${village.code} · ${village.name}` : undefined}
          actions={
            summary && (
              <span className="text-[11px] font-semibold text-tinta2">
                {summary.total_sls} SLS · {summary.total_kk.toLocaleString('id-ID')} KK · {summary.total_muatan.toLocaleString('id-ID')} jiwa · {summary.total_luas_ha.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ha
              </span>
            )
          }
          bodyClassName="p-0"
        >
          <div className="border-b border-garis p-4">
            <label className="relative block max-w-md">
              <span className="sr-only">Cari SLS</span>
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta3" aria-hidden="true" />
              <input
                type="search"
                value={slsSearch}
                onChange={(e) => setSlsSearch(e.target.value)}
                placeholder="Cari nama RT/RW/Dusun atau kode…"
                className="min-h-11 w-full rounded-md border border-garis bg-panel2 py-2 pl-9 pr-3 text-sm text-tinta placeholder:text-tinta3 focus:outline-none focus:ring-2 focus:ring-cta"
              />
            </label>
          </div>

          {slsQuery.isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 size={24} className="animate-spin text-tinta3" aria-hidden="true" />
            </div>
          ) : slsQuery.isError ? (
            <p role="alert" className="px-5 py-4 text-sm font-semibold text-err">
              Gagal memuat data SLS.
            </p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-tinta2">Tidak ada SLS cocok dengan pencarian.</p>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-panel">
                  <tr className="border-b border-garis text-left text-[11px] uppercase tracking-wider text-tinta3">
                    <th className="px-4 py-2.5 font-semibold">SLS</th>
                    <th className="px-4 py-2.5 font-semibold">Kode</th>
                    <th className="px-4 py-2.5 text-right font-semibold">KK</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Muatan</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Luas (ha)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-garis">
                  {rows.map((sls) => (
                    <tr key={sls.id} className="transition-colors hover:bg-panel2">
                      <td className="px-4 py-2 text-tinta">{sls.name}</td>
                      <td className="px-4 py-2 font-mono text-xs text-tinta2">{sls.code}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-tinta2">{sls.kk?.toLocaleString('id-ID') ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-tinta2">{sls.muatan?.toLocaleString('id-ID') ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-tinta2">
                        {sls.luas != null ? Number(sls.luas).toLocaleString('id-ID', { maximumFractionDigits: 3 }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {!village && district && (
        <div className="flex items-start gap-2 rounded-md border border-garis bg-panel2 px-4 py-3 text-xs text-tinta2">
          <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Pilih desa/kelurahan di atas untuk melihat daftar SLS (RT/RW/Dusun) beserta jumlah KK, muatan (jiwa), dan luas wilayahnya.
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-garis bg-panel p-3 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums text-tinta">{value}</p>
    </div>
  );
}
