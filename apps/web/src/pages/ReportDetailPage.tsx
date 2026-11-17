import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  Camera,
  ClipboardPlus,
  ImageIcon,
  Loader2,
  MapPin,
  Pencil,
  Send,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import {
  archiveReport,
  createFollowup,
  deleteReport,
  getReport,
  listFollowups,
  publicPhotoUrl,
  rejectReport,
  submitReport,
  uploadReportPhoto,
  verifyReport,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { compressPhoto } from '../offline/compress-image';
import {
  REPORT_STATUS_LABEL,
  REPORT_TYPE_LABEL,
} from '../lib/types';

function formatDateTimeId(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(
    (location.state as { toast?: string } | null)?.toast ?? null,
  );
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupBusy, setFollowupBusy] = useState(false);
  const [fogDate, setFogDate] = useState(new Date().toISOString().slice(0, 10));
  const [fogMethod, setFogMethod] = useState('Mekanis');
  const [fogArea, setFogArea] = useState('');
  const [fogChemicals, setFogChemicals] = useState('');
  const [fogOutcome, setFogOutcome] = useState('Menurun');
  const [fogNotes, setFogNotes] = useState('');

  const query = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => getReport(reportId),
    enabled: Number.isFinite(reportId),
  });
  const report = query.data;

  const showFollowups = report?.status === 'Diverifikasi' && report?.report_type === 'pest';
  const followupsQuery = useQuery({
    queryKey: ['report-followups', reportId],
    queryFn: () => listFollowups(reportId),
    enabled: showFollowups === true,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['report', reportId] });
    void queryClient.invalidateQueries({ queryKey: ['report-followups', reportId] });
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
  };

  const handleSaveFollowup = async () => {
    if (!report) return;
    setFollowupBusy(true);
    setActionError(null);
    try {
      await createFollowup(report.id, {
        action_date: fogDate,
        control_method: fogMethod,
        controlled_area_ha: fogArea ? Number(fogArea) : null,
        chemicals_or_agents_used: fogChemicals || null,
        outcome_status: fogOutcome,
        notes: fogNotes || null,
      });
      setActionNotice('Tindak lanjut Gerdal berhasil dicatat.');
      setFollowupOpen(false);
      setFogArea('');
      setFogChemicals('');
      setFogNotes('');
      invalidate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mencatat tindak lanjut.');
    } finally {
      setFollowupBusy(false);
    }
  };

  const run = async (operation: () => Promise<unknown>, successMessage: string) => {
    setActionError(null);
    try {
      await operation();
      setActionNotice(successMessage);
      invalidate();
      setRejectOpen(false);
      setRejectReason('');
      setVerifyNotes('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Aksi gagal.');
    }
  };

  const handleAddPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !report) return;
    setUploadingPhoto(true);
    setActionError(null);
    try {
      const compressed = await compressPhoto(file);
      await uploadReportPhoto(report.id, compressed.blob, 'foto.webp');
      setActionNotice('Foto berhasil diunggah.');
      invalidate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mengunggah foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (query.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={28} className="animate-spin text-tinta3" aria-hidden="true" />
      </div>
    );
  }

  if (query.isError || !report) {
    return (
      <div className="space-y-4">
        <Link to="/reports" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-tinta2 hover:text-tinta">
          <ArrowLeft size={17} aria-hidden="true" /> Kembali
        </Link>
        <p role="alert" className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-4 py-3 text-sm font-semibold text-chip-ditolak-fg">
          Laporan tidak ditemukan atau Anda tidak memiliki akses.
        </p>
      </div>
    );
  }

  const isOwner = user?.id === report.user?.id;
  const isAdmin = Boolean(user?.roles.includes('superadmin') || user?.roles.includes('admin'));
  const isEditable = report.status === 'Draf' || report.status === 'Ditolak';
  const canVerify = hasPermission('reports.verify') && report.status === 'Submitted';
  const canArchive = hasPermission('reports.archive') && report.status === 'Diverifikasi';
  const canDelete =
    (user && hasPermission('reports.delete') && isAdmin) ||
    (isOwner && report.status === 'Draf');
  const canEdit = isEditable && (isOwner || isAdmin);
  const canSubmit = isEditable && (isOwner || isAdmin);
  const canAddPhoto = isOwner || isAdmin;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/reports"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-tinta2 hover:text-tinta"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Kembali
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-tinta">
            {report.report_number ?? 'DRAF'}
          </span>
          <StatusBadge status={report.status} />
          {canEdit && (
            <Link
              to={`/reports/${report.id}/edit`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-garis bg-panel px-3 text-xs font-bold text-tinta2 hover:text-tinta"
            >
              <Pencil size={14} aria-hidden="true" /> Edit
            </Link>
          )}
        </div>
      </div>

      {actionNotice && (
        <p role="status" className="rounded-md border border-chip-verifikasi-bg bg-chip-verifikasi-bg/40 px-4 py-2.5 text-xs font-semibold text-chip-verifikasi-fg">
          {actionNotice}
        </p>
      )}
      {actionError && (
        <p role="alert" className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-4 py-2.5 text-xs font-semibold text-chip-ditolak-fg">
          {actionError}
        </p>
      )}
      {report.is_coordinate_mismatch && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-chip-warn-bg bg-chip-warn-bg/40 px-4 py-3 text-xs font-semibold text-chip-warn-fg"
        >
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Titik GPS laporan ini berada <strong>di luar batas desa/kecamatan</strong> yang dipilih.
            Verifikator akan memeriksa kesesuaian lokasi sebelum memvalidasi.
          </span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Kolom utama */}
        <div className="space-y-5 xl:col-span-2">
          <Panel title="Informasi Laporan" bodyClassName="p-5">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Jenis</dt>
                <dd className="mt-0.5 text-sm font-semibold text-tinta">{REPORT_TYPE_LABEL[report.report_type]}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Tanggal</dt>
                <dd className="mt-0.5 text-sm text-tinta">{formatDateTimeId(report.report_date)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Kecamatan</dt>
                <dd className="mt-0.5 text-sm text-tinta">{report.district?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Desa/Kelurahan</dt>
                <dd className="mt-0.5 text-sm text-tinta">{report.village?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">SLS / Dusun / RW</dt>
                <dd className="mt-0.5 text-sm text-tinta">
                  {report.sls
                    ? `${report.sls.name} (${report.sls.code || report.sls.idsls})`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Lokasi</dt>
                <dd className="mt-0.5 text-sm text-tinta">{report.location_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Alamat</dt>
                <dd className="mt-0.5 text-sm text-tinta">{report.address_detail ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Koordinat</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-tinta">
                  <span className="font-mono text-xs">
                    {report.latitude != null && report.longitude != null
                      ? `${Number(report.latitude).toFixed(6)}, ${Number(report.longitude).toFixed(6)}`
                      : '—'}
                  </span>
                  {report.latitude != null && report.longitude != null && (
                    <a
                      className="inline-flex items-center gap-1 text-xs font-semibold text-cta underline underline-offset-2"
                      href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=16/${report.latitude}/${report.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={12} aria-hidden="true" /> Buka peta
                    </a>
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Pelapor</dt>
                <dd className="mt-0.5 text-sm text-tinta">{report.user?.name ?? '—'}</dd>
              </div>
              {report.verification_notes && (
                <div className="sm:col-span-2 rounded-md border border-garis bg-panel2 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Catatan Verifikasi</dt>
                  <dd className="mt-1 text-sm text-tinta">{report.verification_notes}</dd>
                </div>
              )}
            </dl>
          </Panel>

          {/* Konteks Statistik BPS */}
          {(report.commodity || report.ksa_segment_code || report.ksa_phase || (report.statistical_impacts?.length ?? 0) > 0) && (
            <Panel title="Konteks Statistik BPS" bodyClassName="p-5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Detail label="Komoditas" value={report.commodity ?? '—'} />
                <Detail label="Segmen KSA" value={report.ksa_segment_code ?? '—'} />
                <Detail label="Fase KSA" value={report.ksa_phase ?? '—'} />
                <Detail
                  label="Dampak Indikator"
                  value={report.statistical_impacts?.length ? report.statistical_impacts.join(', ') : '—'}
                />
                <Detail label="Subround" value={report.subround ? `SR ${report.subround}` : '—'} />
                <Detail label="Triwulan" value={report.quarter ? `Tw ${report.quarter}` : '—'} />
              </dl>
            </Panel>
          )}

          {/* Detail domain */}
          <Panel
            title={
              report.report_type === 'pest'
                ? 'Detail Hama & OPT'
                : report.report_type === 'irrigation'
                  ? 'Detail Irigasi'
                  : `Detail ${REPORT_TYPE_LABEL[report.report_type]}`
            }
            bodyClassName="p-5"
          >
            {report.report_type === 'pest' && report.pestDetail ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Detail label="OPT" value={report.pestDetail.opt?.name ?? `#${report.pestDetail.opt_id}`} />
                <Detail label="Komoditas" value={report.pestDetail.crop_type ?? '—'} />
                <Detail label="Umur tanaman" value={report.pestDetail.crop_age_days != null ? `${report.pestDetail.crop_age_days} hari` : '—'} />
                <Detail label="Fase" value={report.pestDetail.crop_phase ?? '—'} />
                <Detail label="Intensitas" value={report.pestDetail.intensity_level} />
                <Detail
                  label="Populasi terukur"
                  value={
                    report.pestDetail.population_intensity != null
                      ? `${Number(report.pestDetail.population_intensity).toLocaleString('id-ID')} ${report.pestDetail.etl_unit ?? report.pestDetail.opt?.etl_unit ?? ''}`.trim()
                      : '—'
                  }
                />
                <Detail
                  label="Ambang Ekonomi (ETL)"
                  value={
                    report.pestDetail.opt?.etl_reference != null
                      ? `${Number(report.pestDetail.opt.etl_reference).toLocaleString('id-ID')} ${report.pestDetail.opt.etl_unit ?? report.pestDetail.etl_unit ?? ''}`.trim()
                      : '—'
                  }
                />
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Status ETL</dt>
                  <dd className="mt-1">
                    {report.pestDetail.is_above_etl ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-chip-warn-bg bg-chip-warn-bg/40 px-3 py-1.5 text-xs font-bold text-chip-warn-fg">
                        ⚠️ Di Atas Ambang Ekonomi (ETL) — Perlu Tindakan Segera
                      </span>
                    ) : report.pestDetail.population_intensity != null ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-chip-verifikasi-bg bg-chip-verifikasi-bg/40 px-3 py-1.5 text-xs font-bold text-chip-verifikasi-fg">
                        Di Bawah Ambang Ekonomi (ETL)
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-garis bg-panel2 px-3 py-1.5 text-xs font-semibold text-tinta2">
                        Belum Dinilai (populasi tidak diisi)
                      </span>
                    )}
                  </dd>
                </div>
                <Detail label="Luas terserang" value={`${Number(report.pestDetail.affected_area_ha).toLocaleString('id-ID')} ha`} />
                <Detail label="Luas Populasi" value={report.pestDetail.threatened_area_ha != null ? `${Number(report.pestDetail.threatened_area_ha).toLocaleString('id-ID')} ha` : '—'} />
              </dl>
            ) : report.report_type === 'irrigation' && report.irrigationDetail ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Detail label="Daerah irigasi" value={report.irrigationDetail.irrigation_area_name ?? '—'} />
                <Detail label="Jenis saluran" value={report.irrigationDetail.channel_type} />
                <Detail label="Kondisi fisik" value={report.irrigationDetail.physical_condition} />
                <Detail label="Debit air" value={report.irrigationDetail.water_discharge_status} />
                <Detail label="Luas layanan" value={report.irrigationDetail.service_area_ha != null ? `${Number(report.irrigationDetail.service_area_ha).toLocaleString('id-ID')} ha` : '—'} />
                <Detail label="Penanganan" value={report.irrigationDetail.repair_status} />
                {report.irrigationDetail.action_taken && (
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Tindakan</dt>
                    <dd className="mt-0.5 text-sm text-tinta">{report.irrigationDetail.action_taken}</dd>
                  </div>
                )}
              </dl>
            ) : report.report_type === 'fertilizer' && report.fertilizerDetail ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Detail label="Jenis pupuk" value={report.fertilizerDetail.fertilizer_type} />
                <Detail label="Takaran" value={`${report.fertilizerDetail.dosage_amount} ${report.fertilizerDetail.dosage_unit}`} />
                <Detail label="Cara aplikasi" value={report.fertilizerDetail.application_method ?? '—'} />
                <Detail label="Ketersediaan" value={report.fertilizerDetail.availability_status ?? '—'} />
              </dl>
            ) : report.report_type === 'harvest' && report.harvestDetail ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Detail label="Komoditas" value={report.harvestDetail.commodity} />
                <Detail label="Varietas" value={report.harvestDetail.variety ?? '—'} />
                <Detail label="Luas panen" value={`${Number(report.harvestDetail.harvest_area_ha).toLocaleString('id-ID')} ha`} />
                <Detail label="Volume" value={`${report.harvestDetail.harvest_volume} ${report.harvestDetail.volume_unit}`} />
                <Detail label="Produktivitas" value={report.harvestDetail.productivity_ton_ha != null ? `${Number(report.harvestDetail.productivity_ton_ha).toLocaleString('id-ID')} ton/ha` : '—'} />
                <Detail label="Harga petani" value={report.harvestDetail.farmer_price_per_kg != null ? `Rp ${Number(report.harvestDetail.farmer_price_per_kg).toLocaleString('id-ID')}/kg` : '—'} />
              </dl>
            ) : report.report_type === 'weather' && report.weatherDetail ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Detail label="Kondisi" value={report.weatherDetail.weather_condition} />
                <Detail label="Suhu" value={report.weatherDetail.temperature_c != null ? `${report.weatherDetail.temperature_c} °C` : '—'} />
                <Detail label="Kelembapan" value={report.weatherDetail.humidity_pct != null ? `${report.weatherDetail.humidity_pct} %` : '—'} />
                <Detail label="Curah hujan" value={report.weatherDetail.rainfall_mm != null ? `${report.weatherDetail.rainfall_mm} mm` : '—'} />
                <Detail label="Kecepatan angin" value={report.weatherDetail.wind_speed_kmh != null ? `${report.weatherDetail.wind_speed_kmh} km/jam` : '—'} />
                <Detail label="Arah angin" value={report.weatherDetail.wind_direction ?? '—'} />
                <Detail label="Luas terdampak" value={report.weatherDetail.impacted_area_ha != null ? `${report.weatherDetail.impacted_area_ha} ha` : '—'} />
              </dl>
            ) : report.report_type === 'equipment' && report.equipmentDetail ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Detail label="Kategori" value={report.equipmentDetail.equipment_category} />
                <Detail label="Nama alat" value={report.equipmentDetail.equipment_name} />
                <Detail label="Jumlah unit" value={String(report.equipmentDetail.unit_count)} />
                <Detail label="Kondisi" value={report.equipmentDetail.condition_status} />
                <Detail label="Kelompok pemilik" value={report.equipmentDetail.ownership_group ?? '—'} />
              </dl>
            ) : (
              <p className="text-sm text-tinta2">Detail domain belum diisi.</p>
            )}
            {report.notes && (
              <p className="mt-4 border-t border-garis pt-3 text-sm text-tinta2">
                <span className="font-semibold text-tinta">Catatan: </span>
                {report.notes}
              </p>
            )}
          </Panel>

          {showFollowups && (
            <Panel
              title="Riwayat Pengendalian / Gerdal"
              actions={
                (isOwner || isAdmin) ? (
                  <button
                    type="button"
                    onClick={() => setFollowupOpen((v) => !v)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-cta px-3 text-xs font-bold text-ctafg hover:bg-sawah800"
                  >
                    <ClipboardPlus size={14} aria-hidden="true" />
                    Catat Tindak Lanjut Gerdal
                  </button>
                ) : undefined
              }
              bodyClassName="p-5"
            >
              {followupOpen && (isOwner || isAdmin) ? (
                <div className="mb-4 grid gap-3 rounded-md border border-garis bg-panel2 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Tanggal aksi</span>
                      <input type="date" value={fogDate} onChange={(e) => setFogDate(e.target.value)} className="min-h-11 w-full rounded-md border border-garis bg-panel px-3 text-sm text-tinta" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Metode pengendalian</span>
                      <select value={fogMethod} onChange={(e) => setFogMethod(e.target.value)} className="min-h-11 w-full rounded-md border border-garis bg-panel px-3 text-sm text-tinta">
                        <option>Mekanis</option>
                        <option>Hayati</option>
                        <option>Kimiawi</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Luas terkendali (ha)</span>
                      <input type="number" min={0} step="0.01" inputMode="decimal" value={fogArea} onChange={(e) => setFogArea(e.target.value)} placeholder="1.5" className="min-h-11 w-full rounded-md border border-garis bg-panel px-3 text-sm text-tinta" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Status hasil</span>
                      <select value={fogOutcome} onChange={(e) => setFogOutcome(e.target.value)} className="min-h-11 w-full rounded-md border border-garis bg-panel px-3 text-sm text-tinta">
                        <option>Terkendali</option>
                        <option>Menurun</option>
                        <option>Tetap</option>
                        <option>Meluas</option>
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Bahan aktif (agens hayati / pestisida)</span>
                      <input value={fogChemicals} onChange={(e) => setFogChemicals(e.target.value)} placeholder="Beauveria bassiana / Pimetrozen…" className="min-h-11 w-full rounded-md border border-garis bg-panel px-3 text-sm text-tinta" />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tinta3">Catatan</span>
                      <textarea value={fogNotes} onChange={(e) => setFogNotes(e.target.value)} className="min-h-20 w-full rounded-md border border-garis bg-panel px-3 py-2 text-sm text-tinta" placeholder="Ket. pelaksanaan Gerdal…" />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setFollowupOpen(false)} className="min-h-11 rounded-md border border-garis px-4 text-sm font-semibold text-tinta2">Batal</button>
                    <button type="button" disabled={followupBusy} onClick={() => void handleSaveFollowup()} className="min-h-11 rounded-md bg-cta px-4 text-sm font-bold text-ctafg disabled:opacity-60">
                      {followupBusy ? 'Menyimpan…' : 'Simpan'}
                    </button>
                  </div>
                </div>
              ) : null}

              {followupsQuery.isLoading ? (
                <div className="flex h-24 items-center justify-center"><Loader2 size={22} className="animate-spin text-tinta3" aria-hidden="true" /></div>
              ) : (followupsQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-tinta2">Belum ada tindak lanjut Gerdal dicatat. Gunakan tombol di atas untuk mencatat gerakan pengendalian kelompok tani.</p>
              ) : (
                <ol className="relative space-y-0 border-l-2 border-garis pl-5">
                  {(report.pestDetail ? (
                    <li className="relative pb-4">
                      <span aria-hidden="true" className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-panel" />
                      <p className="text-sm font-bold text-tinta">Awal serangan — {report.pestDetail.opt?.name ?? 'OPT'}</p>
                      <p className="text-xs text-tinta2">
                        {report.report_date} · Intensitas {report.pestDetail.intensity_level} · {Number(report.pestDetail.affected_area_ha).toLocaleString('id-ID')} ha terserang
                      </p>
                    </li>
                  ) : null)}
                  {followupsQuery.data?.map((item) => (
                    <li key={item.id} className="relative pb-4">
                      <span aria-hidden="true" className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-cta ring-2 ring-panel" />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-tinta">
                          Sesudah Gerdal — {item.outcome_status} · {item.control_method}
                        </p>
                        <span className="rounded-full bg-chip-verifikasi-bg px-2 py-0.5 text-[11px] font-bold text-chip-verifikasi-fg">{item.control_method}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-tinta2">
                        {item.action_date}
                        {item.controlled_area_ha != null ? ` · ${Number(item.controlled_area_ha).toLocaleString('id-ID')} ha terkendali` : ''}
                        {item.chemicals_or_agents_used ? ` · ${item.chemicals_or_agents_used}` : ''}
                        {item.user?.name ? ` · oleh ${item.user.name}` : ''}
                      </p>
                      {item.notes && <p className="mt-1 text-xs text-tinta2">{item.notes}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          )}

          {/* Foto */}
          <Panel
            title={`Foto Bukti (${report.photos?.length ?? 0}/5)`}
            actions={
              canAddPhoto && (report.photos?.length ?? 0) < 5 ? (
                <>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="sr-only"
                    onChange={(e) => void handleAddPhoto(e)}
                    aria-label="Unggah foto"
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-garis px-3 text-xs font-bold text-cta hover:border-cta disabled:opacity-60"
                  >
                    {uploadingPhoto ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}
                    Unggah
                  </button>
                </>
              ) : undefined
            }
            bodyClassName="p-5"
          >
            {report.photos && report.photos.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {report.photos.map((photo) => (
                  <li key={photo.id}>
                    <a href={publicPhotoUrl(photo.file_path)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-garis">
                      <img
                        src={publicPhotoUrl(photo.file_path)}
                        alt={photo.caption ?? 'Foto bukti lapangan'}
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover transition-transform hover:scale-[1.02]"
                      />
                    </a>
                    {photo.caption && <p className="mt-1.5 truncate text-[11px] text-tinta2">{photo.caption}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <ImageIcon size={28} className="text-tinta3" aria-hidden="true" />
                <p className="text-sm text-tinta2">Belum ada foto. Minimal 1 foto wajib sebelum mengirim laporan.</p>
              </div>
            )}
          </Panel>
        </div>

        {/* Kolom aksi + riwayat */}
        <div className="space-y-5">
          <Panel title="Aksi" bodyClassName="p-5">
            <div className="space-y-2">
              {canSubmit && (
                <button
                  type="button"
                  onClick={() => void run(() => submitReport(report.id), 'Laporan terkirim untuk verifikasi.')}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-cta px-4 text-sm font-bold text-ctafg transition-colors hover:bg-sawah800"
                >
                  <Send size={18} aria-hidden="true" />
                  {report.status === 'Ditolak' ? 'Kirim Ulang' : 'Kirim untuk Verifikasi'}
                </button>
              )}
              {canVerify && (
                <>
                  <div className="rounded-md border border-garis bg-panel2 p-3">
                    <label className="mb-1 block text-[11px] font-semibold text-tinta2" htmlFor="verify_notes">
                      Catatan verifikasi (opsional)
                    </label>
                    <textarea
                      id="verify_notes"
                      className="min-h-16 w-full rounded-md border border-garis bg-panel px-3 py-2 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                      placeholder="Sesuai sampel lapangan…"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void run(() => verifyReport(report.id, verifyNotes || undefined), 'Laporan terverifikasi.')}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-cta px-4 text-sm font-bold text-ctafg transition-colors hover:bg-sawah800"
                  >
                    <BadgeCheck size={18} aria-hidden="true" />
                    Verifikasi Laporan
                  </button>
                  {!rejectOpen ? (
                    <button
                      type="button"
                      onClick={() => setRejectOpen(true)}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-chip-ditolak-fg/40 bg-transparent px-4 text-sm font-bold text-chip-ditolak-fg transition-colors hover:bg-chip-ditolak-bg/30"
                    >
                      <X size={18} aria-hidden="true" />
                      Tolak…
                    </button>
                  ) : (
                    <div className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/20 p-3">
                      <label className="mb-1 block text-[11px] font-semibold text-chip-ditolak-fg" htmlFor="reject_reason">
                        Alasan penolakan (min. 5 karakter) *
                      </label>
                      <textarea
                        id="reject_reason"
                        className="min-h-20 w-full rounded-md border border-garis bg-panel px-3 py-2 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-cta"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Foto tidak jelas, koordinat di luar lokasi…"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRejectOpen(false)}
                          className="min-h-11 flex-1 rounded-md border border-garis px-3 text-xs font-bold text-tinta2"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => void run(() => rejectReport(report.id, rejectReason), 'Laporan ditolak.')}
                          disabled={rejectReason.trim().length < 5}
                          className="min-h-11 flex-1 rounded-md bg-chip-ditolak-fg px-3 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Tolak Laporan
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {canArchive && (
                <button
                  type="button"
                  onClick={() => void run(() => archiveReport(report.id), 'Laporan diarsipkan.')}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-garis bg-panel2 px-4 text-sm font-bold text-tinta transition-colors hover:border-cta hover:text-cta"
                >
                  <Archive size={18} aria-hidden="true" />
                  Arsipkan Laporan
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Hapus laporan ini (soft delete)?')) {
                      void run(() => deleteReport(report.id), 'Laporan dihapus.').then(() => {
                        navigate('/reports', { replace: true });
                      });
                    }
                  }}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-tinta3 transition-colors hover:text-err"
                >
                  <Trash2 size={17} aria-hidden="true" />
                  Hapus Laporan
                </button>
              )}
              {!canSubmit && !canVerify && !canArchive && !canDelete && !canEdit && (
                <p className="text-xs text-tinta2">Tidak ada aksi tersedia untuk Anda pada status {REPORT_STATUS_LABEL[report.status]}.</p>
              )}
            </div>
          </Panel>

          <Panel title="Riwayat Status" bodyClassName="p-5">
            {report.statusHistories && report.statusHistories.length > 0 ? (
              <ol className="relative space-y-4 border-l-2 border-garis pl-5">
                {report.statusHistories.map((history) => (
                  <li key={history.id} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-panel bg-cta"
                    />
                    <p className="text-xs font-bold text-tinta">
                      {history.from_status
                        ? `${(REPORT_STATUS_LABEL as Record<string, string>)[history.from_status] ?? history.from_status} → `
                        : ''}
                      {(REPORT_STATUS_LABEL as Record<string, string>)[history.to_status] ?? history.to_status}
                    </p>
                    <p className="text-[11px] text-tinta2">
                      {history.actor?.name ?? 'Sistem'} · {formatDateTimeId(history.created_at)}
                    </p>
                    {history.notes && <p className="mt-0.5 text-[11px] text-tinta3">{history.notes}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-tinta2">Belum ada riwayat.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-tinta">{value}</dd>
    </div>
  );
}
