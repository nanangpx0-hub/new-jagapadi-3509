import { Loader2, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '../components/EmptyState';
import { MapLegend, MapView } from '../components/MapView';
import { Panel } from '../components/Panel';
import { listDistricts, listReports } from '../lib/api';
import { REPORT_TYPE_LABEL } from '../lib/types';

export function MapPage() {
  const [commodity, setCommodity] = useState<'all' | 'padi' | 'jagung' | 'kedelai'>('all');
  const [severity, setSeverity] = useState<'all' | 'Ringan' | 'Sedang' | 'Berat' | 'Puso'>('all');
  const [districtId, setDistrictId] = useState<number | 'all'>('all');

  const districtsQuery = useQuery({ queryKey: ['districts'], queryFn: listDistricts });
  const reportsQuery = useQuery({
    queryKey: ['reports-map'],
    queryFn: async () => {
      const pages = await Promise.all([1, 2, 3].map((p) => listReports({ page: p })));
      return pages.flatMap((p) => p.data);
    },
    staleTime: 60_000,
  });

  const reports = reportsQuery.data ?? [];

  const filtered = useMemo(() => {
    return reports.filter((report) => {
      if (districtId !== 'all' && report.district_id !== districtId) return false;
      if (commodity !== 'all' && report.report_type !== 'pest') return false;
      if (commodity !== 'all' && report.pestDetail?.crop_type !== commodity) return false;
      if (severity !== 'all' && report.pestDetail?.intensity_level !== severity) return false;
      return true;
    });
  }, [reports, commodity, severity, districtId]);

  const legendTypes = Array.from(new Set(filtered.map((r) => r.report_type))) as Array<keyof typeof REPORT_TYPE_LABEL>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Peta Sebaran GIS</h1>
          <p className="mt-0.5 text-xs text-tinta2">
            {filtered.length} laporan dengan koordinat GPS · Kabupaten Jember
          </p>
        </div>
      </div>

      <Panel title="Filter Peta" bodyClassName="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Komoditas</span>
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value as typeof commodity)}
              className="min-h-11 w-full rounded-md border border-garis bg-panel2 px-3 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            >
              <option value="all">Semua komoditas</option>
              <option value="padi">Padi</option>
              <option value="jagung">Jagung</option>
              <option value="kedelai">Kedelai</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">
              Tingkat keparahan
            </span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as typeof severity)}
              className="min-h-11 w-full rounded-md border border-garis bg-panel2 px-3 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            >
              <option value="all">Semua tingkat</option>
              <option value="Ringan">Ringan</option>
              <option value="Sedang">Sedang</option>
              <option value="Berat">Berat</option>
              <option value="Puso">Puso</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Kecamatan</span>
            <select
              value={districtId === 'all' ? '' : districtId}
              onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : 'all')}
              className="min-h-11 w-full rounded-md border border-garis bg-panel2 px-3 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            >
              <option value="">Semua kecamatan</option>
              {(districtsQuery.data ?? []).map((district) => (
                <option key={district.id} value={district.id}>
                  {district.code} — {district.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      {reportsQuery.isLoading ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 size={28} className="animate-spin text-tinta3" aria-hidden="true" />
        </div>
      ) : reportsQuery.isError ? (
        <p role="alert" className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-4 py-3 text-sm font-semibold text-chip-ditolak-fg">
          Gagal memuat peta laporan.
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Tidak ada laporan dengan koordinat"
          description="Ubah filter atau buat laporan baru dengan titik GPS."
        />
      ) : (
        <>
          <MapView reports={filtered} heightClass="h-[520px] sm:h-[640px]" />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-garis bg-panel px-4 py-3">
            <MapLegend types={legendTypes.length ? legendTypes : ['pest', 'irrigation']} />
            <p className="text-[11px] text-tinta3">
              Klik marker untuk detail laporan. Menampilkan hingga 45 laporan terbaru.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
