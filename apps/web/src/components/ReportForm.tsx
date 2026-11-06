import {
  CalendarDays,
  Camera,
  Crosshair,
  Loader2,
  MapPin,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CascadingRegionSelect } from './CascadingRegionSelect';
import { useFieldSync } from './AppShell';
import { compressPhoto } from '../offline/compress-image';
import { saveDraft, uuid } from '../offline/database';
import {
  createReport,
  createReportWithPhotos,
  listOpts,
  updateReport,
  uploadReportPhoto,
  type ReportFormPayload,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import type { DistrictItem, Report, VillageItem } from '../lib/types';

interface PhotoDraft {
  id: string;
  file: File;
  preview: string;
}

const inputClass =
  'w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta placeholder:text-tinta3 focus:outline-none focus:ring-2 focus:ring-cta';
const labelClass = 'mb-1 block text-xs font-semibold text-tinta2';

export function ReportForm({
  mode,
  report,
}: {
  mode: 'create' | 'edit';
  report?: Report;
}) {
  const { user } = useAuth();
  const sync = useFieldSync();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const stableUuid = useRef(uuid()).current;

  const [reportType, setReportType] = useState<'pest' | 'irrigation'>(
    (report?.report_type as 'pest' | 'irrigation') ?? 'pest',
  );
  const [reportDate, setReportDate] = useState(
    report?.report_date ?? new Date().toISOString().slice(0, 10),
  );
  const [district, setDistrict] = useState<DistrictItem | null>(report?.district ?? null);
  const [village, setVillage] = useState<VillageItem | null>(report?.village ?? null);
  const [locationName, setLocationName] = useState(report?.location_name ?? '');
  const [addressDetail, setAddressDetail] = useState(report?.address_detail ?? '');
  const [latitude, setLatitude] = useState(report?.latitude != null ? String(report.latitude) : '');
  const [longitude, setLongitude] = useState(report?.longitude != null ? String(report.longitude) : '');
  const [notes, setNotes] = useState(report?.notes ?? '');

  const [optId, setOptId] = useState(report?.pestDetail?.opt_id ? String(report.pestDetail.opt_id) : '');
  const [cropType, setCropType] = useState(report?.pestDetail?.crop_type ?? 'padi');
  const [cropAge, setCropAge] = useState(
    report?.pestDetail?.crop_age_days != null ? String(report.pestDetail.crop_age_days) : '',
  );
  const [cropPhase, setCropPhase] = useState(report?.pestDetail?.crop_phase ?? '');
  const [intensity, setIntensity] = useState(report?.pestDetail?.intensity_level ?? '');
  const [affected, setAffected] = useState(
    report?.pestDetail?.affected_area_ha != null ? String(report.pestDetail.affected_area_ha) : '',
  );
  const [threatened, setThreatened] = useState(
    report?.pestDetail?.threatened_area_ha != null ? String(report.pestDetail.threatened_area_ha) : '',
  );
  const [controlRec, setControlRec] = useState(report?.pestDetail?.control_recommendation ?? '');

  const [diName, setDiName] = useState(report?.irrigationDetail?.irrigation_area_name ?? '');
  const [channelType, setChannelType] = useState(report?.irrigationDetail?.channel_type ?? '');
  const [physical, setPhysical] = useState(report?.irrigationDetail?.physical_condition ?? '');
  const [discharge, setDischarge] = useState(report?.irrigationDetail?.water_discharge_status ?? '');
  const [serviceArea, setServiceArea] = useState(
    report?.irrigationDetail?.service_area_ha != null ? String(report.irrigationDetail.service_area_ha) : '',
  );
  const [repairStatus, setRepairStatus] = useState(report?.irrigationDetail?.repair_status ?? 'Normal');
  const [actionTaken, setActionTaken] = useState(report?.irrigationDetail?.action_taken ?? '');

  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const optsQuery = useQuery({
    queryKey: ['opts'],
    queryFn: () => listOpts(),
    staleTime: 5 * 60_000,
  });

  const districtId = district?.id ?? report?.district_id ?? 0;
  const villageId = village?.id ?? report?.village_id ?? null;

  const buildPayload = (): ReportFormPayload => ({
    client_uuid: stableUuid,
    report_type: reportType,
    report_date: reportDate,
    district_id: districtId,
    village_id: villageId,
    location_name: locationName || null,
    address_detail: addressDetail || null,
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    notes: notes || null,
    ...(reportType === 'pest'
      ? {
          pest_detail: {
            opt_id: Number(optId),
            crop_type: cropType || 'padi',
            crop_age_days: cropAge ? Number(cropAge) : null,
            crop_phase: cropPhase || null,
            intensity_level: intensity,
            affected_area_ha: affected ? Number(affected) : 0,
            threatened_area_ha: threatened ? Number(threatened) : null,
            control_recommendation: controlRec || null,
          },
        }
      : {
          irrigation_detail: {
            irrigation_area_name: diName || null,
            channel_type: channelType,
            physical_condition: physical,
            water_discharge_status: discharge,
            service_area_ha: serviceArea ? Number(serviceArea) : null,
            repair_status: repairStatus || 'Normal',
            action_taken: actionTaken || null,
          },
        }),
  });

  const compressAll = async () => {
    const result: Array<{ name: string; blob: Blob }> = [];
    for (const [index, photo] of photos.entries()) {
      const compressed = await compressPhoto(photo.file);
      result.push({ name: `foto-${index + 1}.webp`, blob: compressed.blob });
    }
    return result;
  };

  const saveLocal = async (submit: boolean) => {
    if (!user) return;
    const compressed = await compressAll();
    const ownerId = String(user.id);
    const form = {
      ...buildPayload(),
      action: submit ? 'submit' : 'draft',
    } as unknown as Record<string, import('../offline/database').JsonValue>;
    const draftId = await saveDraft(ownerId, {
      form,
      photos: compressed,
    });
    if (submit) {
      await sync.submitDraft(draftId);
      setNotice('Laporan masuk antrian sinkron. Akan terkirim otomatis saat online.');
      setPhotos([]);
    } else {
      setNotice('Draf tersimpan di perangkat ini.');
      setPhotos([]);
    }
  };

  const handlePickGPS = () => {
    if (!navigator.geolocation) {
      setError('Perangkat ini tidak mendukung GPS. Isi koordinat secara manual.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(7));
        setLongitude(pos.coords.longitude.toFixed(7));
        setGpsLoading(false);
      },
      () => {
        setError('Gagal mengambil titik GPS. Periksa izin lokasi browser Anda.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  const handlePickPhotos = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setError(null);
    const room = Math.max(0, 5 - photos.length);
    if (files.length > room) {
      setError(`Maksimal 5 foto per laporan. ${room} slot tersisa.`);
    }
    const next = files.slice(0, room).map((file) => ({
      id: uuid(),
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...next]);
    event.target.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const validateSubmit = (): string | null => {
    if (!districtId) return 'Pilih kecamatan terlebih dahulu.';
    if (reportType === 'pest') {
      if (!optId) return 'Pilih OPT terlebih dahulu.';
      if (!intensity) return 'Pilih tingkat intensitas serangan.';
      if (!affected) return 'Isi luas area terserang.';
    } else {
      if (!channelType) return 'Pilih jenis saluran.';
      if (!physical) return 'Pilih kondisi fisik saluran.';
      if (!discharge) return 'Pilih status debit air.';
    }
    if (photos.length === 0) return 'Minimal 1 foto bukti lapangan wajib diunggah sebelum mengirim.';
    return null;
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'edit' && report) {
        const updated = await updateReport(report.id, buildPayload());
        void queryClient.invalidateQueries({ queryKey: ['report', report.id] });
        setNotice('Perubahan tersimpan.');
        navigate(`/reports/${updated.id}`);
        return;
      }
      if (!navigator.onLine) {
        await saveLocal(false);
        return;
      }
      const created = await createReport({ ...buildPayload(), action: 'draft' });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      navigate(`/reports/${created.id}`, { state: { toast: 'Draf laporan tersimpan.' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan draf.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    const problem = validateSubmit();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!navigator.onLine) {
        await saveLocal(true);
        return;
      }
      if (mode === 'edit' && report) {
        // Unggah foto dulu, lalu submit
        const compressed = await compressAll();
        for (const item of compressed) {
          await uploadReportPhoto(report.id, item.blob, item.name);
        }
        await updateReport(report.id, buildPayload());
        const { submitReport } = await import('../lib/api');
        const submitted = await submitReport(report.id);
        void queryClient.invalidateQueries({ queryKey: ['reports'] });
        void queryClient.invalidateQueries({ queryKey: ['report', report.id] });
        navigate(`/reports/${submitted.id}`, {
          replace: true,
          state: { toast: 'Laporan terkirim untuk verifikasi.' },
        });
        return;
      }
      const compressed = await compressAll();
      const files = compressed.map(
        (item) => new File([item.blob], item.name, { type: 'image/webp' }),
      );
      const created = await createReportWithPhotos({ ...buildPayload(), action: 'submit' }, files);
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      navigate(`/reports/${created.id}`, {
        replace: true,
        state: { toast: 'Laporan terkirim untuk verifikasi.' },
      });
    } catch (err) {
      // Kegagalan jaringan -> simpan offline sebagai cadangan
      if (err instanceof TypeError) {
        try {
          await saveLocal(true);
          return;
        } catch {
          /* jatuh ke error di bawah */
        }
      }
      setError(err instanceof Error ? err.message : 'Gagal mengirim laporan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="grid gap-5 xl:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="space-y-5 xl:col-span-2">
        {/* Lokasi & Wilayah */}
        <section className="rounded-lg border border-garis bg-panel p-5 shadow-card">
          <h2 className="font-display text-base font-bold tracking-tight text-tinta">Lokasi & Wilayah</h2>
          <div className="mt-4 space-y-4">
            <CascadingRegionSelect
              key={report?.id ?? 'new'}
              selectedDistrictId={district?.id ?? report?.district_id}
              selectedVillageId={village?.id ?? report?.village_id ?? undefined}
              onDistrictChange={setDistrict}
              onVillageChange={setVillage}
            />
            <div>
              <label className={labelClass} htmlFor="location_name">Nama lokasi / blok</label>
              <input
                id="location_name"
                className={inputClass}
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Blok Sawah Timur, petak 12"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="address_detail">Alamat / patokan</label>
              <input
                id="address_detail"
                className={inputClass}
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="Jl. Raya Kencong RT 03 RW 02"
              />
            </div>
            <div>
              <span className={labelClass}>Titik GPS</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handlePickGPS}
                  disabled={gpsLoading}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-garis bg-panel2 px-3 py-2 text-sm font-semibold text-tinta transition-colors hover:border-cta hover:text-cta disabled:opacity-60"
                >
                  {gpsLoading ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Crosshair size={17} aria-hidden="true" />}
                  Ambil GPS
                </button>
                <div className="flex flex-1 items-center gap-2">
                  <input
                    aria-label="Garis lintang"
                    inputMode="decimal"
                    className={inputClass}
                    placeholder="-8.2100000"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                  <input
                    aria-label="Garis bujur"
                    inputMode="decimal"
                    className={inputClass}
                    placeholder="113.6420000"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </div>
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-tinta3">
                <MapPin size={12} aria-hidden="true" /> Koordinat divalidasi otomatis terhadap batas desa (PostGIS) saat mengirim.
              </p>
            </div>
          </div>
        </section>

        {/* Detail domain */}
        <section className="rounded-lg border border-garis bg-panel p-5 shadow-card">
          <h2 className="font-display text-base font-bold tracking-tight text-tinta">Detail Laporan</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="report_date">Tanggal laporan</label>
              <input
                id="report_date"
                type="date"
                className={inputClass}
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            {mode === 'create' && (
              <fieldset>
                <legend className={labelClass}>Jenis laporan</legend>
                <div className="flex gap-2">
                  {(['pest', 'irrigation'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setReportType(type)}
                      aria-pressed={reportType === type}
                      className={`min-h-11 flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                        reportType === type
                          ? 'border-cta bg-cta text-ctafg'
                          : 'border-garis bg-panel2 text-tinta2 hover:text-tinta'
                      }`}
                    >
                      {type === 'pest' ? 'Hama & OPT' : 'Irigasi'}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          {reportType === 'pest' ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="opt">Organisme Pengganggu Tumbuhan (OPT) *</label>
                <select id="opt" className={inputClass} value={optId} onChange={(e) => setOptId(e.target.value)}>
                  <option value="">-- Pilih OPT --</option>
                  {optsQuery.data?.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.code} — {opt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="crop_type">Komoditas</label>
                <select id="crop_type" className={inputClass} value={cropType} onChange={(e) => setCropType(e.target.value)}>
                  <option value="padi">Padi</option>
                  <option value="jagung">Jagung</option>
                  <option value="kedelai">Kedelai</option>
                  <option value="cabai">Cabai</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="crop_age">Umur tanaman (hari)</label>
                <input id="crop_age" type="number" min={1} inputMode="numeric" className={inputClass} value={cropAge} onChange={(e) => setCropAge(e.target.value)} placeholder="45" />
              </div>
              <div>
                <label className={labelClass} htmlFor="crop_phase">Fase tanaman</label>
                <select id="crop_phase" className={inputClass} value={cropPhase} onChange={(e) => setCropPhase(e.target.value)}>
                  <option value="">-- Pilih fase --</option>
                  <option value="vegetatif">Vegetatif</option>
                  <option value="generatif">Generatif</option>
                  <option value="panen">Panen</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="intensity">Intensitas serangan *</label>
                <select id="intensity" className={inputClass} value={intensity} onChange={(e) => setIntensity(e.target.value)}>
                  <option value="">-- Pilih intensitas --</option>
                  <option value="Ringan">Ringan</option>
                  <option value="Sedang">Sedang</option>
                  <option value="Berat">Berat</option>
                  <option value="Puso">Puso</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="affected">Luas terserang (ha) *</label>
                <input id="affected" type="number" min={0} step="0.01" inputMode="decimal" className={inputClass} value={affected} onChange={(e) => setAffected(e.target.value)} placeholder="1.5" />
              </div>
              <div>
                <label className={labelClass} htmlFor="threatened">Luas waspada (ha)</label>
                <input id="threatened" type="number" min={0} step="0.01" inputMode="decimal" className={inputClass} value={threatened} onChange={(e) => setThreatened(e.target.value)} placeholder="3.0" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="control_rec">Rekomendasi pengendalian</label>
                <textarea id="control_rec" className={`${inputClass} min-h-20`} value={controlRec} onChange={(e) => setControlRec(e.target.value)} placeholder="Aplikasi pestisida nabati, rotasi tanam, dll." />
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="di_name">Nama daerah irigasi / saluran</label>
                <input id="di_name" className={inputClass} value={diName} onChange={(e) => setDiName(e.target.value)} placeholder="DI Bedadung — Saluran Sekunder" />
              </div>
              <div>
                <label className={labelClass} htmlFor="channel_type">Jenis saluran *</label>
                <select id="channel_type" className={inputClass} value={channelType} onChange={(e) => setChannelType(e.target.value)}>
                  <option value="">-- Pilih --</option>
                  <option value="Primer">Primer</option>
                  <option value="Sekunder">Sekunder</option>
                  <option value="Tersier">Tersier</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="physical">Kondisi fisik *</label>
                <select id="physical" className={inputClass} value={physical} onChange={(e) => setPhysical(e.target.value)}>
                  <option value="">-- Pilih --</option>
                  <option value="Bagus">Bagus</option>
                  <option value="Sedang">Sedang</option>
                  <option value="Tidak Bagus">Tidak Bagus</option>
                  <option value="Rusak">Rusak</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="discharge">Status debit air *</label>
                <select id="discharge" className={inputClass} value={discharge} onChange={(e) => setDischarge(e.target.value)}>
                  <option value="">-- Pilih --</option>
                  <option value="Cukup">Cukup</option>
                  <option value="Kurang">Kurang</option>
                  <option value="Kering">Kering</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="service_area">Luas layanan (ha)</label>
                <input id="service_area" type="number" min={0} step="0.1" inputMode="decimal" className={inputClass} value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="120.5" />
              </div>
              <div>
                <label className={labelClass} htmlFor="repair_status">Status penanganan</label>
                <select id="repair_status" className={inputClass} value={repairStatus} onChange={(e) => setRepairStatus(e.target.value)}>
                  <option value="Normal">Normal</option>
                  <option value="Belum Ditangani">Belum Ditangani</option>
                  <option value="Dalam Perbaikan">Dalam Perbaikan</option>
                  <option value="Selesai Diperbaiki">Selesai Diperbaiki</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="action_taken">Tindakan / keterangan</label>
                <textarea id="action_taken" className={`${inputClass} min-h-20`} value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} placeholder="Pembersihan saluran, pelaporan ke dinas, dll." />
              </div>
            </div>
          )}
        </section>

        {/* Foto */}
        <section className="rounded-lg border border-garis bg-panel p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold tracking-tight text-tinta">Foto Bukti Lapangan *</h2>
              <p className="mt-0.5 text-xs text-tinta2">Minimal 1 foto sebelum mengirim · maks 5 · dikompresi WebP &lt; 300 KB otomatis</p>
            </div>
            <span className="rounded-full bg-chip-draf-bg px-2.5 py-1 text-xs font-bold text-chip-draf-fg tabular-nums">
              {photos.length}/5
            </span>
          </div>
          <label
            htmlFor="photos"
            className="mt-3 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-garis bg-panel2 px-4 py-6 text-center transition-colors hover:border-cta"
          >
            <Camera size={26} strokeWidth={1.75} className="text-tinta2" aria-hidden="true" />
            <span className="text-sm font-semibold text-tinta2">Ketuk untuk mengambil / memilih foto</span>
            <span className="text-[11px] text-tinta3">JPEG atau PNG dari kamera ponsel</span>
            <input
              id="photos"
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              multiple
              className="sr-only"
              onChange={handlePickPhotos}
            />
          </label>
          {photos.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.map((photo) => (
                <li key={photo.id} className="group relative">
                  <img
                    src={photo.preview}
                    alt={`Pratinjau ${photo.file.name}`}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    aria-label="Hapus foto"
                    className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-90 transition-opacity hover:bg-black/75"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Catatan */}
        <section className="rounded-lg border border-garis bg-panel p-5 shadow-card">
          <label className={labelClass} htmlFor="notes">Catatan tambahan</label>
          <textarea
            id="notes"
            className={`${inputClass} min-h-24`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Kondisi lahan, tindakan yang sudah dilakukan, dll."
          />
        </section>
      </div>

      {/* Panel aksi (sticky) */}
      <div className="xl:col-span-1">
        <div className="sticky top-4 space-y-3 rounded-lg border border-garis bg-panel p-5 shadow-card">
          <h2 className="font-display text-base font-bold tracking-tight text-tinta">Kirim Laporan</h2>
          <p className="text-xs text-tinta2">
            Laporan akan divalidasi otomatis (batas desa, kelengkapan, foto) lalu masuk antrian verifikasi petugas/statistisi.
          </p>

          {error && (
            <p role="alert" className="rounded-md border border-chip-ditolak-bg bg-chip-ditolak-bg/40 px-3 py-2 text-xs font-semibold text-chip-ditolak-fg">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-md border border-chip-verifikasi-bg bg-chip-verifikasi-bg/40 px-3 py-2 text-xs font-semibold text-chip-verifikasi-fg">
              {notice}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-garis bg-panel2 px-4 text-sm font-bold text-tinta transition-colors hover:border-cta hover:text-cta disabled:opacity-60"
          >
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
            Simpan Draf
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-cta px-4 text-sm font-bold text-ctafg shadow-pop transition-colors hover:bg-sawah800 disabled:opacity-60"
          >
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
            {mode === 'edit' ? 'Kirim Ulang untuk Verifikasi' : 'Kirim Laporan'}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-tinta3">
            <CalendarDays size={12} aria-hidden="true" /> Nomor laporan terbit otomatis saat terkirim (mis. LH-20261105-0001)
          </p>
        </div>
      </div>
    </form>
  );
}
