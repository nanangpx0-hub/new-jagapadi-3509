import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  Camera,
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
  deleteReport,
  getReport,
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

  const query = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => getReport(reportId),
    enabled: Number.isFinite(reportId),
  });
  const report = query.data;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['report', reportId] });
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
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
  const isEditable = report.status === 'Draf' || report.status === 'Ditolak';
  const canVerify = hasPermission('reports.verify') && report.status === 'Submitted';
  const canArchive = hasPermission('reports.archive') && report.status === 'Diverifikasi';
  const canDelete =
    (user && hasPermission('reports.delete') && user.roles.includes('admin')) ||
    (isOwner && report.status === 'Draf');
  const canEdit = isEditable && (isOwner || user?.roles.includes('admin'));
  const canSubmit = isEditable && (isOwner || user?.roles.includes('admin'));
  const canAddPhoto = isOwner || user?.roles.includes('admin');

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

          {/* Detail domain */}
          <Panel title={report.report_type === 'pest' ? 'Detail Hama & OPT' : 'Detail Irigasi'} bodyClassName="p-5">
            {report.report_type === 'pest' && report.pestDetail ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Detail label="OPT" value={report.pestDetail.opt?.name ?? `#${report.pestDetail.opt_id}`} />
                <Detail label="Komoditas" value={report.pestDetail.crop_type ?? '—'} />
                <Detail label="Umur tanaman" value={report.pestDetail.crop_age_days != null ? `${report.pestDetail.crop_age_days} hari` : '—'} />
                <Detail label="Fase" value={report.pestDetail.crop_phase ?? '—'} />
                <Detail label="Intensitas" value={report.pestDetail.intensity_level} />
                <Detail label="Luas terserang" value={`${Number(report.pestDetail.affected_area_ha).toLocaleString('id-ID')} ha`} />
                <Detail label="Luas waspada" value={report.pestDetail.threatened_area_ha != null ? `${Number(report.pestDetail.threatened_area_ha).toLocaleString('id-ID')} ha` : '—'} />
                {report.pestDetail.control_recommendation && (
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta3">Rekomendasi</dt>
                    <dd className="mt-0.5 text-sm text-tinta">{report.pestDetail.control_recommendation}</dd>
                  </div>
                )}
              </dl>
            ) : report.irrigationDetail ? (
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
