import { Check, ClipboardCopy, Download, Loader2, MapPinned, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Panel } from '../components/Panel';
import {
  downloadPhenomenaCsvUrl,
  getPhenomenaSummary,
  listDistricts,
  type PhenomenaParams,
} from '../lib/api';

const MONTHS = [
  [1, 'Januari'], [2, 'Februari'], [3, 'Maret'], [4, 'April'], [5, 'Mei'], [6, 'Juni'],
  [7, 'Juli'], [8, 'Agustus'], [9, 'September'], [10, 'Oktober'], [11, 'November'], [12, 'Desember'],
] as const;

const COMMODITIES = ['Padi', 'Jagung', 'Kedelai', 'Tembakau', 'Tebu', 'Edamame', 'Cabai', 'Hortikultura', 'Lainnya'];

const selectClass =
  'min-h-11 w-full rounded-md border border-garis bg-panel2 px-3 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta';
const labelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3';

function num(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function PhenomenaPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState('');
  const [subround, setSubround] = useState('');
  const [quarter, setQuarter] = useState('');
  const [commodity, setCommodity] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [copied, setCopied] = useState(false);

  const params: PhenomenaParams = {
    year: Number(year) || undefined,
    month: month ? Number(month) : undefined,
    subround: subround ? Number(subround) : undefined,
    quarter: quarter ? Number(quarter) : undefined,
    commodity: commodity ? commodity.toLowerCase() : undefined,
    district_id: districtId ? Number(districtId) : undefined,
  };

  const summaryQuery = useQuery({
    queryKey: ['phenomena-summary', params],
    queryFn: () => getPhenomenaSummary(params),
  });
  const districtsQuery = useQuery({ queryKey: ['districts'], queryFn: listDistricts });

  const summary = summaryQuery.data;
  const narratives = summary?.narratives ?? [];
  const csvUrl = downloadPhenomenaCsvUrl(params);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(narratives.map((item) => item.narrative).join('\n\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Rekap Fenomena BPS</h1>
        <p className="mt-0.5 text-xs text-tinta2">
          Rekapitulasi 6 domain fenomena, cakupan wilayah, dan generator narasi KSA / Ubinan / PDRB.
        </p>
      </div>

      <Panel title="Filter Periode & Wilayah" bodyClassName="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label>
            <span className={labelClass}>Tahun</span>
            <select className={selectClass} value={year} onChange={(e) => { setYear(e.target.value); setMonth(''); setSubround(''); setQuarter(''); }}>
              {[currentYear, currentYear - 1, currentYear - 2].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Bulan</span>
            <select className={selectClass} value={month} onChange={(e) => { setMonth(e.target.value); setSubround(''); setQuarter(''); }}>
              <option value="">Semua bulan</option>
              {MONTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Subround Ubinan</span>
            <select className={selectClass} value={subround} onChange={(e) => { setSubround(e.target.value); setMonth(''); setQuarter(''); }}>
              <option value="">Semua SR</option>
              <option value="1">SR I (Jan–Apr)</option>
              <option value="2">SR II (Mei–Agu)</option>
              <option value="3">SR III (Sep–Des)</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>Triwulan PDRB</span>
            <select className={selectClass} value={quarter} onChange={(e) => { setQuarter(e.target.value); setMonth(''); setSubround(''); }}>
              <option value="">Semua Tw</option>
              <option value="1">Tw I</option>
              <option value="2">Tw II</option>
              <option value="3">Tw III</option>
              <option value="4">Tw IV</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>Komoditas</span>
            <select className={selectClass} value={commodity} onChange={(e) => setCommodity(e.target.value)}>
              <option value="">Semua komoditas</option>
              {COMMODITIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Kecamatan</span>
            <select className={selectClass} value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
              <option value="">Semua kecamatan</option>
              {(districtsQuery.data ?? []).map((district) => (
                <option key={district.id} value={district.id}>{district.code} — {district.name}</option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      {summaryQuery.isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={28} className="animate-spin text-tinta3" aria-hidden="true" />
        </div>
      ) : summaryQuery.isError ? (
        <p role="alert" className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-4 py-3 text-sm font-semibold text-chip-ditolak-fg">
          Gagal memuat rekap. {(summaryQuery.error as Error)?.message}
        </p>
      ) : summary ? (
        <>
          <Panel title={`Cakupan Wilayah — ${summary.period_label}`} bodyClassName="p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-garis bg-panel2 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Total Kecamatan</p>
                <p className="mt-1 text-2xl font-bold text-tinta">{summary.coverage.total_districts}</p>
              </div>
              <div className="rounded-lg border border-garis bg-panel2 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Kecamatan Melapor</p>
                <p className="mt-1 text-2xl font-bold text-chip-verifikasi-fg">{summary.coverage.reporting_districts}</p>
              </div>
              <div className="rounded-lg border border-chip-warn-bg bg-chip-warn-bg/30 p-4">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-chip-warn-fg">
                  <TriangleAlert size={13} aria-hidden="true" /> Blank-Spot (0 Laporan)
                </p>
                <p className="mt-1 text-2xl font-bold text-chip-warn-fg">
                  {summary.coverage.blank_spot_districts.length}
                </p>
              </div>
            </div>
            {summary.coverage.blank_spot_districts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {summary.coverage.blank_spot_districts.map((district) => (
                  <span key={district.id} className="inline-flex items-center gap-1 rounded-full border border-chip-warn-bg bg-chip-warn-bg/30 px-2.5 py-1 text-[11px] font-semibold text-chip-warn-fg">
                    <MapPinned size={12} aria-hidden="true" /> {district.code} — {district.name}
                  </span>
                ))}
              </div>
            )}
          </Panel>

          {(summary.ksa_anomalies?.length ?? 0) > 0 && (
            <Panel title="Deteksi Anomali KSA Tanpa Fenomena" bodyClassName="p-5">
              <div className="rounded-md border border-chip-warn-bg bg-chip-warn-bg/30 p-3">
                <p className="text-sm font-semibold text-chip-warn-fg">
                  {summary.ksa_anomalies.length} kecamatan memiliki angka Puso pada KSA namun belum memiliki laporan fenomena pendukung.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.ksa_anomalies.map((item) => (
                    <span key={item.district_id} className="inline-flex items-center gap-1 rounded-full border border-chip-warn-bg bg-panel px-2.5 py-1 text-[11px] font-semibold text-chip-warn-fg">
                      <TriangleAlert size={12} aria-hidden="true" />
                      {item.district_code} — {item.district_name} (Puso {num(item.ksa_puso_ha, 2)} Ha)
                    </span>
                  ))}
                </div>
              </div>
            </Panel>
          )}

          <Panel
            title="Generator Narasi Fenomena BPS"
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyAll()}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-garis bg-panel2 px-3 py-2 text-xs font-bold text-tinta transition-colors hover:border-cta hover:text-cta"
                >
                  {copied ? <Check size={15} aria-hidden="true" /> : <ClipboardCopy size={15} aria-hidden="true" />}
                  {copied ? 'Tersalin' : 'Salin Semua Narasi'}
                </button>
                <a
                  href={csvUrl}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-cta px-3 py-2 text-xs font-bold text-ctafg transition-colors hover:bg-sawah800"
                >
                  <Download size={15} aria-hidden="true" /> Unduh CSV/Excel Rekonsiliasi
                </a>
              </div>
            }
            bodyClassName="p-5"
          >
            <ol className="space-y-3">
              {narratives.map((item) => (
                <li key={item.district_id + '-' + item.district_code} className="rounded-md border border-garis bg-panel2/60 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-tinta3">
                    {item.district_name} ({item.district_code})
                  </p>
                  <p className="mt-1 text-sm leading-6 text-tinta2">{item.narrative}</p>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Matriks Rekapitulasi per Kecamatan" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="bg-panel2 text-[10px] font-bold uppercase tracking-wider text-tinta3">
                  <tr>
                    <th className="px-3 py-2.5">Kecamatan</th>
                    <th className="px-2 py-2.5 text-right">Total</th>
                    <th className="px-2 py-2.5 text-right">Terverifikasi</th>
                    <th className="px-2 py-2.5 text-right">OPT</th>
                    <th className="px-2 py-2.5 text-right">Irigasi</th>
                    <th className="px-2 py-2.5 text-right">Pupuk</th>
                    <th className="px-2 py-2.5 text-right">Panen</th>
                    <th className="px-2 py-2.5 text-right">Cuaca</th>
                    <th className="px-2 py-2.5 text-right">Alsintan</th>
                    <th className="px-2 py-2.5 text-right">Luas OPT (Ha)</th>
                    <th className="px-2 py-2.5 text-right">Luas Cuaca (Ha)</th>
                    <th className="px-2 py-2.5 text-right">Panen KSA (Ha)</th>
                    <th className="px-2 py-2.5 text-right">Puso KSA (Ha)</th>
                    <th className="px-2 py-2.5 text-right">Produktivitas (ton/ha)</th>
                    <th className="px-2 py-2.5 text-right">Harga Petani (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-garis">
                  {summary.matrix.map((row) => (
                    <tr key={row.district_id} className="hover:bg-panel2/60">
                      <td className="px-3 py-2 font-semibold text-tinta">
                        <span className="font-mono text-[10px] text-tinta3">{row.district_code}</span> {row.district_name}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.total_reports}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.verified_reports}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.pest_count}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.irrigation_count}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.fertilizer_count}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.harvest_count}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.weather_count}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.equipment_count}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{num(row.affected_pest_ha, 2)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{num(row.impacted_weather_ha, 2)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{num(row.ksa_harvest_ha, 2)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${(row.ksa_puso_ha ?? 0) > 0 ? 'font-bold text-chip-warn-fg' : ''}`}>
                        {num(row.ksa_puso_ha, 2)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{num(row.avg_productivity_ton_ha, 2)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{num(row.avg_farmer_price_rp, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
