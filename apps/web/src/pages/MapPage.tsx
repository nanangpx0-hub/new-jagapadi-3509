import { Loader2, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '../components/EmptyState';
import { MapLegend, MapView } from '../components/MapView';
import { Panel } from '../components/Panel';
import { listDistricts, listPestClusters, listReports } from '../lib/api';
import { REPORT_TYPE_LABEL, type ReportType } from '../lib/types';

const COMMODITY_OPTIONS = [
  'padi', 'jagung', 'kedelai', 'tembakau', 'tebu', 'edamame', 'cabai', 'hortikultura', 'lainnya',
] as const;
type CommodityFilter = 'all' | (typeof COMMODITY_OPTIONS)[number];

export function MapPage() {
  const [reportType, setReportType] = useState<ReportType | 'all'>('all');
  const [subround, setSubround] = useState('');
  const [quarter, setQuarter] = useState('');
  const [commodity, setCommodity] = useState<CommodityFilter>('all');
  const [severity, setSeverity] = useState<'all' | 'Ringan' | 'Sedang' | 'Berat' | 'Puso'>('all');
  const [districtId, setDistrictId] = useState<number | 'all'>('all');
  const [showClusters, setShowClusters] = useState(false);
  const [clusterDays, setClusterDays] = useState(7);

  const districtsQuery = useQuery({ queryKey: ['districts'], queryFn: listDistricts });
  const reportsQuery = useQuery({
    queryKey: ['reports-map', reportType, subround, quarter],
    queryFn: async () => {
      const pages = await Promise.all([1, 2, 3].map((p) => listReports({
        page: p,
        report_type: reportType === 'all' ? undefined : reportType,
        subround: subround ? Number(subround) : undefined,
        quarter: quarter ? Number(quarter) : undefined,
      })));
      return pages.flatMap((p) => p.data);
    },
    staleTime: 60_000,
  });

  const clustersQuery = useQuery({
    queryKey: ['pest-clusters', clusterDays],
    queryFn: () => listPestClusters({ days: clusterDays }),
    enabled: showClusters,
    staleTime: 60_000,
  });

  const reports = reportsQuery.data ?? [];

  const filtered = useMemo(() => {
    return reports.filter((report) => {
      if (districtId !== 'all' && report.district_id !== districtId) return false;
      if (reportType !== 'all' && report.report_type !== reportType) return false;
      if (subround && report.subround !== Number(subround)) return false;
      if (quarter && report.quarter !== Number(quarter)) return false;
      if (commodity !== 'all') {
        const reportComm = (
          report.commodity ?? report.harvestDetail?.commodity ?? report.pestDetail?.crop_type ?? ''
        ).toLowerCase();
        if (reportComm !== commodity) return false;
      }
      if (severity !== 'all' && report.pestDetail?.intensity_level !== severity) return false;
      return true;
    });
  }, [reports, commodity, severity, districtId, reportType, subround, quarter]);

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
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Jenis laporan</span>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType | 'all')}
              className="min-h-11 w-full rounded-md border border-garis bg-panel2 px-3 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            >
              <option value="all">Semua jenis</option>
              {(Object.keys(REPORT_TYPE_LABEL) as ReportType[]).map((type) => (
                <option key={type} value={type}>{REPORT_TYPE_LABEL[type]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Subround</span>
            <select
              value={subround}
              onChange={(e) => { setSubround(e.target.value); if (e.target.value) setQuarter(''); }}
              className="min-h-11 w-full rounded-md border border-garis bg-panel2 px-3 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            >
              <option value="">Semua SR</option>
              <option value="1">SR I</option>
              <option value="2">SR II</option>
              <option value="3">SR III</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Triwulan</span>
            <select
              value={quarter}
              onChange={(e) => { setQuarter(e.target.value); if (e.target.value) setSubround(''); }}
              className="min-h-11 w-full rounded-md border border-garis bg-panel2 px-3 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            >
              <option value="">Semua Tw</option>
              <option value="1">Tw I</option>
              <option value="2">Tw II</option>
              <option value="3">Tw III</option>
              <option value="4">Tw IV</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Komoditas</span>
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value as typeof commodity)}
              className="min-h-11 w-full rounded-md border border-garis bg-panel2 px-3 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            >
              <option value="all">Semua komoditas</option>
              {COMMODITY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </option>
              ))}
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
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">
              Rentang kluster
            </span>
            <select
              value={clusterDays}
              onChange={(e) => setClusterDays(Number(e.target.value))}
              className="min-h-11 w-full rounded-md border border-garis bg-panel2 px-3 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
            >
              <option value={7}>7 hari terakhir</option>
              <option value={14}>14 hari terakhir</option>
              <option value={30}>30 hari terakhir</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-tinta">
            <input
              type="checkbox"
              checked={showClusters}
              onChange={(e) => setShowClusters(e.target.checked)}
              className="h-5 w-5 accent-orange-600"
            />
            Tampilkan Zona Waspada / Kluster Outbreak
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
          <MapView
            reports={filtered}
            clusters={showClusters ? clustersQuery.data ?? null : null}
            showClusters={showClusters}
            heightClass="h-[520px] sm:h-[640px]"
          />
          {clustersQuery.data && showClusters && (
            <p className="mt-2 text-[11px] font-semibold text-tinta2">
              {clustersQuery.data.meta.cluster_count} kluster · {clustersQuery.data.meta.total_points} titik · buffer 2.000 m
            </p>
          )}
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
