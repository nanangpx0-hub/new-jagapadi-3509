import {
  CalendarDays,
  Camera,
  Crosshair,
  Loader2,
  MapPin,
  PencilLine,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CascadingRegionSelect } from './CascadingRegionSelect';
import { GpsMapPicker } from './GpsMapPicker';
import { useFieldSync } from './AppShell';
import { readExifMetadata, toReportDateInput } from '../offline/exif';
import { compressPhoto } from '../offline/compress-image';
import { saveDraft, uuid } from '../offline/database';
import {
  createReportWithPhotos,
  listOpts,
  locateRegionByGps,
  updateReport,
  uploadReportPhoto,
  type ReportFormPayload,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import type {
  DistrictItem,
  OptItem,
  Report,
  ReportType,
  SlsItem,
  VillageItem,
} from '../lib/types';
import { REPORT_TYPE_LABEL } from '../lib/types';

interface PhotoDraft {
  id: string;
  file: File;
  preview: string;
}

const inputClass =
  'w-full rounded-md border border-garis bg-panel2 px-3 py-2.5 text-sm text-tinta placeholder:text-tinta3 focus:outline-none focus:ring-2 focus:ring-cta';
const labelClass = 'mb-1 block text-xs font-semibold text-tinta2';

// Menyimpan data OPT terpilih agar tetap tampil saat daftar hasil pencarian berubah.
const OptItemCache = new Map<number, OptItem>();

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

  const [reportType, setReportType] = useState<ReportType>(
    (report?.report_type as ReportType) ?? 'pest',
  );
  const [reportDate, setReportDate] = useState(
    report?.report_date ?? new Date().toISOString().slice(0, 10),
  );
  const [district, setDistrict] = useState<DistrictItem | null>(() => {
    if (report?.district) return report.district;
    const assigned = user?.assigned_district;
    if (mode === 'create' && user?.assigned_district_id && assigned) {
      return {
        id: assigned.id,
        code: assigned.code,
        name: assigned.name,
        latitude: null,
        longitude: null,
      };
    }
    return null;
  });
  const [village, setVillage] = useState<VillageItem | null>(report?.village ?? null);
  const [sls, setSls] = useState<SlsItem | null>(report?.sls ?? null);
  const [locationName, setLocationName] = useState(report?.location_name ?? '');
  const [addressDetail, setAddressDetail] = useState(report?.address_detail ?? '');
  const [latitude, setLatitude] = useState(report?.latitude != null ? String(report.latitude) : '');
  const [longitude, setLongitude] = useState(report?.longitude != null ? String(report.longitude) : '');
  const [notes, setNotes] = useState(report?.notes ?? '');

  const [optId, setOptId] = useState(report?.pestDetail?.opt_id ? String(report.pestDetail.opt_id) : '');
  const [optSearch, setOptSearch] = useState('');
  const [debouncedOptSearch, setDebouncedOptSearch] = useState('');
  const [optOpen, setOptOpen] = useState(false);
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
  const [populationIntensity, setPopulationIntensity] = useState(
    report?.pestDetail?.population_intensity != null ? String(report.pestDetail.population_intensity) : '',
  );

  const [diName, setDiName] = useState(report?.irrigationDetail?.irrigation_area_name ?? '');
  const [channelType, setChannelType] = useState(report?.irrigationDetail?.channel_type ?? '');
  const [physical, setPhysical] = useState(report?.irrigationDetail?.physical_condition ?? '');
  const [discharge, setDischarge] = useState(report?.irrigationDetail?.water_discharge_status ?? '');
  const [serviceArea, setServiceArea] = useState(
    report?.irrigationDetail?.service_area_ha != null ? String(report.irrigationDetail.service_area_ha) : '',
  );
  const [repairStatus, setRepairStatus] = useState(report?.irrigationDetail?.repair_status ?? 'Normal');
  const [actionTaken, setActionTaken] = useState(report?.irrigationDetail?.action_taken ?? '');

  // Konteks Statistik BPS (KSA / Ubinan / PDRB)
  const [commodity, setCommodity] = useState(report?.commodity ?? '');
  const [ksaSegment, setKsaSegment] = useState(report?.ksa_segment_code ?? '');
  const [ksaPhase, setKsaPhase] = useState(report?.ksa_phase ?? '');
  const [impacts, setImpacts] = useState<string[]>(report?.statistical_impacts ?? []);

  // Domain tambahan: Pupuk, Panen, Cuaca, Alsintan
  const [fertType, setFertType] = useState(report?.fertilizerDetail?.fertilizer_type ?? '');
  const [fertDosage, setFertDosage] = useState(
    report?.fertilizerDetail?.dosage_amount != null ? String(report.fertilizerDetail.dosage_amount) : '',
  );
  const [fertUnit, setFertUnit] = useState(report?.fertilizerDetail?.dosage_unit ?? 'kg/ha');
  const [fertMethod, setFertMethod] = useState(report?.fertilizerDetail?.application_method ?? '');
  const [fertAvailability, setFertAvailability] = useState(report?.fertilizerDetail?.availability_status ?? 'Tersedia');
  const [harvestCommodity, setHarvestCommodity] = useState(report?.harvestDetail?.commodity ?? 'Padi');
  const [harvestVariety, setHarvestVariety] = useState(report?.harvestDetail?.variety ?? '');
  const [harvestArea, setHarvestArea] = useState(
    report?.harvestDetail?.harvest_area_ha != null ? String(report.harvestDetail.harvest_area_ha) : '',
  );
  const [harvestVolume, setHarvestVolume] = useState(
    report?.harvestDetail?.harvest_volume != null ? String(report.harvestDetail.harvest_volume) : '',
  );
  const [volumeUnit, setVolumeUnit] = useState(report?.harvestDetail?.volume_unit ?? 'ton');
  const [farmerPrice, setFarmerPrice] = useState(
    report?.harvestDetail?.farmer_price_per_kg != null ? String(report.harvestDetail.farmer_price_per_kg) : '',
  );
  const [weatherCondition, setWeatherCondition] = useState(report?.weatherDetail?.weather_condition ?? '');
  const [temperature, setTemperature] = useState(
    report?.weatherDetail?.temperature_c != null ? String(report.weatherDetail.temperature_c) : '',
  );
  const [humidity, setHumidity] = useState(
    report?.weatherDetail?.humidity_pct != null ? String(report.weatherDetail.humidity_pct) : '',
  );
  const [rainfall, setRainfall] = useState(
    report?.weatherDetail?.rainfall_mm != null ? String(report.weatherDetail.rainfall_mm) : '',
  );
  const [windSpeed, setWindSpeed] = useState(
    report?.weatherDetail?.wind_speed_kmh != null ? String(report.weatherDetail.wind_speed_kmh) : '',
  );
  const [windDirection, setWindDirection] = useState(report?.weatherDetail?.wind_direction ?? '');
  const [impactedArea, setImpactedArea] = useState(
    report?.weatherDetail?.impacted_area_ha != null ? String(report.weatherDetail.impacted_area_ha) : '',
  );
  const [equipmentCategory, setEquipmentCategory] = useState(report?.equipmentDetail?.equipment_category ?? '');
  const [equipmentName, setEquipmentName] = useState(report?.equipmentDetail?.equipment_name ?? '');
  const [unitCount, setUnitCount] = useState(
    report?.equipmentDetail?.unit_count != null ? String(report.equipmentDetail.unit_count) : '1',
  );
  const [conditionStatus, setConditionStatus] = useState(report?.equipmentDetail?.condition_status ?? 'Baik');
  const [ownershipGroup, setOwnershipGroup] = useState(report?.equipmentDetail?.ownership_group ?? '');

  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [localDraftId, setLocalDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMode, setGpsMode] = useState<'auto' | 'map' | 'manual'>('auto');
  const [exifGpsDetected, setExifGpsDetected] = useState(false);
  const [exifDate, setExifDate] = useState<string | null>(null);

  const optsQuery = useQuery({
    queryKey: ['opts'],
    queryFn: () => listOpts(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedOptSearch(optSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [optSearch]);

  // Pencarian hama/OPT sisi server: GET /api/opts?search=<nama hama>
  const optSearchQuery = useQuery({
    queryKey: ['opts', 'search', debouncedOptSearch],
    queryFn: () => listOpts({ search: debouncedOptSearch }),
    enabled: debouncedOptSearch.length > 0,
    staleTime: 5 * 60_000,
  });

  const optItems = debouncedOptSearch ? (optSearchQuery.data ?? []) : (optsQuery.data ?? []);
  const selectedOpt = optId
    ? (optsQuery.data?.find((item) => String(item.id) === optId) ??
        OptItemCache.get(Number(optId)) ??
        report?.pestDetail?.opt ??
        null)
    : null;
  const etlReference = selectedOpt?.etl_reference != null ? Number(selectedOpt.etl_reference) : null;
  const etlUnit = selectedOpt?.etl_unit ?? null;
  const populationValue = populationIntensity !== '' ? Number(populationIntensity) : null;
  const isAboveEtl =
    etlReference !== null && populationValue !== null && Number.isFinite(populationValue) && populationValue >= etlReference;

  const districtId = district?.id ?? report?.district_id ?? 0;
  const villageId = village?.id ?? report?.village_id ?? null;
  const slsId = sls?.id ?? report?.sls_id ?? null;

  // Draf boleh parsial: field yang belum diisi tidak dikirim supaya tidak ditolak
  // aturan `in:` / `exists:` / `required_with` di server.
  const domainPayload = (): Partial<ReportFormPayload> => {
    switch (reportType) {
      case 'pest':
        return {
          pest_detail: {
            ...(optId ? { opt_id: Number(optId) } : {}),
            crop_type: cropType || 'padi',
            ...(cropAge ? { crop_age_days: Number(cropAge) } : {}),
            ...(cropPhase ? { crop_phase: cropPhase } : {}),
            ...(intensity ? { intensity_level: intensity } : {}),
            ...(affected ? { affected_area_ha: Number(affected) } : {}),
            ...(threatened ? { threatened_area_ha: Number(threatened) } : {}),
            ...(populationValue !== null ? { population_intensity: populationValue } : {}),
            ...(etlUnit ? { etl_unit: etlUnit } : {}),
          },
        };
      case 'irrigation':
        return {
          irrigation_detail: {
            ...(diName ? { irrigation_area_name: diName } : {}),
            ...(channelType ? { channel_type: channelType } : {}),
            ...(physical ? { physical_condition: physical } : {}),
            ...(discharge ? { water_discharge_status: discharge } : {}),
            ...(serviceArea ? { service_area_ha: Number(serviceArea) } : {}),
            ...(repairStatus ? { repair_status: repairStatus } : {}),
            ...(actionTaken ? { action_taken: actionTaken } : {}),
          },
        };
      case 'fertilizer':
        return {
          fertilizer_detail: {
            ...(fertType ? { fertilizer_type: fertType } : {}),
            ...(fertDosage ? { dosage_amount: Number(fertDosage) } : {}),
            ...(fertUnit ? { dosage_unit: fertUnit } : {}),
            ...(fertMethod ? { application_method: fertMethod } : {}),
            ...(fertAvailability ? { availability_status: fertAvailability } : {}),
          },
        };
      case 'harvest':
        return {
          harvest_detail: {
            ...(harvestCommodity ? { commodity: harvestCommodity } : {}),
            ...(harvestVariety ? { variety: harvestVariety } : {}),
            ...(harvestArea ? { harvest_area_ha: Number(harvestArea) } : {}),
            ...(harvestVolume ? { harvest_volume: Number(harvestVolume) } : {}),
            ...(volumeUnit ? { volume_unit: volumeUnit } : {}),
            ...(farmerPrice ? { farmer_price_per_kg: Number(farmerPrice) } : {}),
          },
        };
      case 'weather':
        return {
          weather_detail: {
            ...(weatherCondition ? { weather_condition: weatherCondition } : {}),
            ...(temperature ? { temperature_c: Number(temperature) } : {}),
            ...(humidity ? { humidity_pct: Number(humidity) } : {}),
            ...(rainfall ? { rainfall_mm: Number(rainfall) } : {}),
            ...(windSpeed ? { wind_speed_kmh: Number(windSpeed) } : {}),
            ...(windDirection ? { wind_direction: windDirection } : {}),
            ...(impactedArea ? { impacted_area_ha: Number(impactedArea) } : {}),
          },
        };
      case 'equipment':
        return {
          equipment_detail: {
            ...(equipmentCategory ? { equipment_category: equipmentCategory } : {}),
            ...(equipmentName ? { equipment_name: equipmentName } : {}),
            ...(unitCount ? { unit_count: Number(unitCount) } : {}),
            ...(conditionStatus ? { condition_status: conditionStatus } : {}),
            ...(ownershipGroup ? { ownership_group: ownershipGroup } : {}),
          },
        };
    }
  };

  const buildPayload = (): ReportFormPayload => ({
    client_uuid: stableUuid,
    report_type: reportType,
    report_date: reportDate,
    district_id: districtId,
    village_id: villageId,
    sls_id: slsId,
    location_name: locationName || null,
    address_detail: addressDetail || null,
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    notes: notes || null,
    commodity: commodity || null,
    ksa_segment_code: ksaSegment || null,
    ksa_phase: ksaPhase || null,
    statistical_impacts: impacts.length ? impacts : null,
    ...domainPayload(),
  });

  const handleOptSelect = (item: OptItem) => {
    OptItemCache.set(item.id, item);
    setOptId(String(item.id));
    setOptSearch('');
    setDebouncedOptSearch('');
    setOptOpen(false);
  };

  const clearOpt = () => {
    setOptId('');
    setOptSearch('');
    setDebouncedOptSearch('');
    setOptOpen(false);
  };

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
    const payload = { form, photos: compressed };
    let draftId: string;
    try {
      draftId = await saveDraft(ownerId, payload, localDraftId ?? undefined);
    } catch {
      // Draf lama mungkin sudah tersinkron/berubah status; buat draf baru.
      draftId = await saveDraft(ownerId, payload);
    }
    setLocalDraftId(draftId);
    if (submit) {
      await sync.submitDraft(draftId);
      setLocalDraftId(null);
      setNotice('Laporan masuk antrian sinkron. Akan terkirim otomatis saat online.');
    } else {
      setNotice('Draf tersimpan di perangkat ini.');
    }
    // Foto sengaja tidak dihapus dari form agar tetap terlihat tersimpan.
  };

  // Isi wilayah otomatis dari koordinat bila petugas belum memilih kecamatan.
  const autoLocate = async (lat: number, lng: number) => {
    if (district) return;
    try {
      const located = await locateRegionByGps(lat, lng);
      if (located.district) {
        setDistrict(located.district);
        setVillage(located.village);
        setSls(located.sls);
      }
    } catch {
      // Auto-locate bersifat best-effort; petugas tetap dapat memilih manual.
    }
  };

  const handlePickGPS = () => {
    // Geolocation hanya tersedia di Secure Context (HTTPS / localhost). Di HTTP (jagapadi.test)
    // navigator.geolocation bisa undefined atau selalu permission-denied.
    if (!window.isSecureContext) {
      setError('GPS otomatis butuh HTTPS atau localhost. Gunakan mode “Pilih di Peta” atau “Input Manual” di atas, atau buka situs lewat HTTPS.');
      return;
    }
    if (!navigator.geolocation) {
      setError('Perangkat/browser ini tidak mendukung GPS. Gunakan “Pilih di Peta” atau “Input Manual”.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(7));
        setLongitude(pos.coords.longitude.toFixed(7));
        void autoLocate(pos.coords.latitude, pos.coords.longitude);
        setGpsLoading(false);
      },
      (err) => {
        const label =
          err.code === 1
            ? 'Izin lokasi ditolak. Buka pengaturan situs → Lokasi → Izinkan, lalu coba lagi. Alternatif: gunakan “Pilih di Peta” atau isi manual.'
            : err.code === 2
              ? 'Posisi tidak tersedia (sinyal GPS lemah / di dalam gedung). Pindah ke area terbuka, atau gunakan “Pilih di Peta”.'
              : 'Waktu pengambilan GPS habis (timeout). Coba lagi di area terbuka, atau gunakan “Pilih di Peta”.';
        setError(label);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  const handlePickPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    // Ekstrak EXIF dari foto pertama SEBELUM kompresi WebP (dibaca dari file asli).
    const first = next[0]?.file ?? files[0];
    if (!first) return;
    const exif = await readExifMetadata(first);
    if (exif.latitude !== null && exif.longitude !== null) {
      if (!latitude && !longitude) {
        setLatitude(exif.latitude.toFixed(7));
        setLongitude(exif.longitude.toFixed(7));
        void autoLocate(exif.latitude, exif.longitude);
      }
      setExifGpsDetected(true);
    }
    if (exif.takenAt) {
      setExifDate(toReportDateInput(exif.takenAt));
    }
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
    } else if (reportType === 'irrigation') {
      if (!channelType) return 'Pilih jenis saluran.';
      if (!physical) return 'Pilih kondisi fisik saluran.';
      if (!discharge) return 'Pilih status debit air.';
    } else if (reportType === 'fertilizer') {
      if (!fertType) return 'Pilih jenis pupuk.';
      if (!fertDosage) return 'Isi takaran pupuk.';
      if (!fertUnit) return 'Pilih satuan takaran.';
    } else if (reportType === 'harvest') {
      if (!harvestCommodity) return 'Isi komoditas panen.';
      if (!harvestArea) return 'Isi luas panen.';
      if (!harvestVolume) return 'Isi volume panen.';
      if (!volumeUnit) return 'Pilih satuan volume.';
    } else if (reportType === 'weather') {
      if (!weatherCondition) return 'Pilih kondisi cuaca.';
    } else if (reportType === 'equipment') {
      if (!equipmentCategory) return 'Pilih kategori alsintan.';
      if (!equipmentName) return 'Isi nama alat/sarana.';
      if (!unitCount) return 'Isi jumlah unit.';
      if (!conditionStatus) return 'Pilih kondisi alat.';
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
        // Foto baru yang dipilih tetap diunggah agar tidak hilang saat simpan draf.
        const compressed = await compressAll();
        for (const item of compressed) {
          await uploadReportPhoto(report.id, item.blob, item.name);
        }
        const updated = await updateReport(report.id, buildPayload());
        void queryClient.invalidateQueries({ queryKey: ['report', report.id] });
        navigate(`/reports/${updated.id}`, { state: { toast: 'Perubahan draf tersimpan.' } });
        return;
      }
      if (!navigator.onLine) {
        await saveLocal(false);
        return;
      }
      // Kirim data DAN foto sekaligus lewat multipart (sama seperti saat submit),
      // supaya foto yang sudah dipilih tidak hilang saat draf disimpan.
      const compressed = await compressAll();
      const files = compressed.map(
        (item) => new File([item.blob], item.name, { type: 'image/webp' }),
      );
      const created = await createReportWithPhotos({ ...buildPayload(), action: 'draft' }, files);
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

  const extraDomainForm = () => {
    if (reportType === 'fertilizer') {
      return (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="fert_type">Jenis pupuk *</label>
            <select id="fert_type" className={inputClass} value={fertType} onChange={(e) => setFertType(e.target.value)}>
              <option value="">-- Pilih --</option>
              {['Urea', 'NPK Phonska', 'ZA', 'SP-36', 'Organik', 'Lainnya'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="fert_availability">Ketersediaan</label>
            <select id="fert_availability" className={inputClass} value={fertAvailability} onChange={(e) => setFertAvailability(e.target.value)}>
              {['Tersedia', 'Langka', 'Terlambat', 'Harga Tinggi'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="fert_dosage">Takaran *</label>
            <input id="fert_dosage" type="number" min={0} step="0.01" className={inputClass} value={fertDosage} onChange={(e) => setFertDosage(e.target.value)} placeholder="250" />
          </div>
          <div>
            <label className={labelClass} htmlFor="fert_unit">Satuan takaran *</label>
            <select id="fert_unit" className={inputClass} value={fertUnit} onChange={(e) => setFertUnit(e.target.value)}>
              {['kg/ha', 'liter/ha', 'kuintal/ha', 'kg'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="fert_method">Cara aplikasi</label>
            <select id="fert_method" className={inputClass} value={fertMethod} onChange={(e) => setFertMethod(e.target.value)}>
              <option value="">-- Pilih --</option>
              {['Tebar', 'Kocor', 'Semprot', 'Benam'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }
    if (reportType === 'harvest') {
      return (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="harvest_commodity">Komoditas panen *</label>
            <input id="harvest_commodity" className={inputClass} value={harvestCommodity} onChange={(e) => setHarvestCommodity(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="harvest_variety">Varietas</label>
            <input id="harvest_variety" className={inputClass} value={harvestVariety} onChange={(e) => setHarvestVariety(e.target.value)} placeholder="Inpari 32" />
          </div>
          <div>
            <label className={labelClass} htmlFor="harvest_area">Luas panen (ha) *</label>
            <input id="harvest_area" type="number" min={0} step="0.01" className={inputClass} value={harvestArea} onChange={(e) => setHarvestArea(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="harvest_volume">Volume panen *</label>
            <input id="harvest_volume" type="number" min={0} step="0.01" className={inputClass} value={harvestVolume} onChange={(e) => setHarvestVolume(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="volume_unit">Satuan volume *</label>
            <select id="volume_unit" className={inputClass} value={volumeUnit} onChange={(e) => setVolumeUnit(e.target.value)}>
              {['ton', 'kuintal', 'kg'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="farmer_price">Harga petani (Rp/kg)</label>
            <input id="farmer_price" type="number" min={0} className={inputClass} value={farmerPrice} onChange={(e) => setFarmerPrice(e.target.value)} placeholder="6500" />
          </div>
          <p className="sm:col-span-2 text-[11px] text-tinta3">Produktivitas (ton/ha) dihitung otomatis dari volume dan luas panen.</p>
        </div>
      );
    }
    if (reportType === 'weather') {
      return (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="weather_condition">Kondisi cuaca *</label>
            <select id="weather_condition" className={inputClass} value={weatherCondition} onChange={(e) => setWeatherCondition(e.target.value)}>
              <option value="">-- Pilih --</option>
              {['Cerah', 'Berawan', 'Hujan Ringan', 'Hujan Lebat', 'Angin Kencang', 'Banjir', 'Kekeringan'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="temperature">Suhu (°C)</label>
            <input id="temperature" type="number" step="0.1" className={inputClass} value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="humidity">Kelembapan (%)</label>
            <input id="humidity" type="number" step="0.1" className={inputClass} value={humidity} onChange={(e) => setHumidity(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="rainfall">Curah hujan (mm)</label>
            <input id="rainfall" type="number" min={0} step="0.01" className={inputClass} value={rainfall} onChange={(e) => setRainfall(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="wind_speed">Kecepatan angin (km/jam)</label>
            <input id="wind_speed" type="number" min={0} step="0.1" className={inputClass} value={windSpeed} onChange={(e) => setWindSpeed(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="wind_direction">Arah angin</label>
            <input id="wind_direction" className={inputClass} value={windDirection} onChange={(e) => setWindDirection(e.target.value)} placeholder="Barat Daya" />
          </div>
          <div>
            <label className={labelClass} htmlFor="impacted_area">Luas terdampak (ha)</label>
            <input id="impacted_area" type="number" min={0} step="0.01" className={inputClass} value={impactedArea} onChange={(e) => setImpactedArea(e.target.value)} />
          </div>
        </div>
      );
    }
    if (reportType === 'equipment') {
      return (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="equipment_category">Kategori alsintan *</label>
            <select id="equipment_category" className={inputClass} value={equipmentCategory} onChange={(e) => setEquipmentCategory(e.target.value)}>
              <option value="">-- Pilih --</option>
              {['Traktor Roda 2', 'Traktor Roda 4', 'Pompa Air', 'Combine Harvester', 'Transplanter', 'Sprayer', 'Lainnya'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="equipment_name">Nama alat/sarana *</label>
            <input id="equipment_name" className={inputClass} value={equipmentName} onChange={(e) => setEquipmentName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="unit_count">Jumlah unit *</label>
            <input id="unit_count" type="number" min={1} className={inputClass} value={unitCount} onChange={(e) => setUnitCount(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="condition_status">Kondisi *</label>
            <select id="condition_status" className={inputClass} value={conditionStatus} onChange={(e) => setConditionStatus(e.target.value)}>
              {['Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang/Tidak Aktif'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="ownership_group">Kelompok pemilik</label>
            <input id="ownership_group" className={inputClass} value={ownershipGroup} onChange={(e) => setOwnershipGroup(e.target.value)} placeholder="Poktan / Gapoktan / UPJA" />
          </div>
        </div>
      );
    }
    return null;
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
              selectedSlsId={sls?.id ?? report?.sls_id ?? null}
              onDistrictChange={setDistrict}
              onVillageChange={setVillage}
              onSlsChange={setSls}
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
              <div role="group" aria-label="Metode titik GPS" className="mb-3 grid grid-cols-3 gap-1 rounded-md border border-garis bg-panel2 p-1">
                {(
                  [
                    { key: 'auto', label: 'Ambil Otomatis', icon: Crosshair },
                    { key: 'map', label: 'Pilih di Peta', icon: MapPin },
                    { key: 'manual', label: 'Input Manual', icon: PencilLine },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setGpsMode(key)}
                    aria-pressed={gpsMode === key}
                    className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-bold transition-colors sm:text-sm ${
                      gpsMode === key ? 'bg-cta text-ctafg' : 'text-tinta2 hover:text-tinta'
                    }`}
                  >
                    <Icon size={15} aria-hidden="true" />
                    <span className="leading-tight">{label}</span>
                  </button>
                ))}
              </div>

              {gpsMode === 'auto' && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handlePickGPS}
                    disabled={gpsLoading}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-garis bg-panel2 px-3 py-2 text-sm font-semibold text-tinta transition-colors hover:border-cta hover:text-cta disabled:opacity-60"
                  >
                    {gpsLoading ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Crosshair size={17} aria-hidden="true" />}
                    Ambil Titik Saat Ini
                  </button>
                  <div className="flex flex-1 items-center gap-2">
                    <input aria-label="Garis lintang" readOnly className={`${inputClass} bg-panel2/60`} placeholder="-8.2100000" value={latitude} />
                    <input aria-label="Garis bujur" readOnly className={`${inputClass} bg-panel2/60`} placeholder="113.6420000" value={longitude} />
                  </div>
                </div>
              )}

              {gpsMode === 'map' && (
                <div className="space-y-2">
                  <GpsMapPicker
                    latitude={latitude}
                    longitude={longitude}
                    onSelect={(lat, lng) => {
                      setLatitude(lat.toFixed(7));
                      setLongitude(lng.toFixed(7));
                      void autoLocate(lat, lng);
                    }}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-2">
                      <input aria-label="Garis lintang" readOnly className={`${inputClass} bg-panel2/60`} placeholder="-8.2100000" value={latitude} />
                      <input aria-label="Garis bujur" readOnly className={`${inputClass} bg-panel2/60`} placeholder="113.6420000" value={longitude} />
                    </div>
                    <button
                      type="button"
                      onClick={handlePickGPS}
                      disabled={gpsLoading}
                      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-garis bg-panel2 px-3 py-2 text-sm font-semibold text-tinta transition-colors hover:border-cta hover:text-cta disabled:opacity-60"
                    >
                      {gpsLoading ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Crosshair size={17} aria-hidden="true" />}
                      Ambil Titik Saat Ini
                    </button>
                  </div>
                </div>
              )}

              {gpsMode === 'manual' && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
              )}

              {gpsMode === 'manual' && (latitude || longitude) && (
                <p className="mt-1 text-[11px] text-tinta2">
                  Rentang Jember: lintang −8,6 s.d. −7,8 · bujur 113,2 s.d. 114,1. Di luar rentang akan ditandai tidak cocok (mismatch).
                </p>
              )}
              {exifGpsDetected && (
                <p role="status" className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-chip-verifikasi-bg bg-chip-verifikasi-bg/40 px-3 py-1.5 text-xs font-semibold text-chip-verifikasi-fg">
                  📍 Koordinat terdeteksi dari metadata foto
                </p>
              )}
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
              {exifDate && exifDate !== reportDate && (
                <button
                  type="button"
                  onClick={() => setReportDate(exifDate)}
                  className="mt-2 inline-flex min-h-9 items-center rounded-md border border-garis bg-panel2 px-3 py-1.5 text-xs font-semibold text-tinta2 hover:border-cta hover:text-cta"
                >
                  🗓️ Gunakan tanggal foto ({exifDate})
                </button>
              )}
            </div>
            {mode === 'create' && (
              <fieldset>
                <legend className={labelClass}>Jenis laporan</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.keys(REPORT_TYPE_LABEL) as ReportType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setReportType(type)}
                      aria-pressed={reportType === type}
                      className={`min-h-11 rounded-md border px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                        reportType === type
                          ? 'border-cta bg-cta text-ctafg'
                          : 'border-garis bg-panel2 text-tinta2 hover:text-tinta'
                      }`}
                    >
                      {REPORT_TYPE_LABEL[type]}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          {/* Konteks Statistik BPS */}
          <div className="mt-5 rounded-md border border-garis bg-panel2/60 p-4">
            <h3 className="text-sm font-bold text-tinta">Konteks Statistik BPS (Opsional)</h3>
            <p className="mt-0.5 text-[11px] text-tinta3">
              Menautkan laporan ke segmen KSA / Ubinan dan indikator PDRB.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="commodity">Komoditas</label>
                <select id="commodity" className={inputClass} value={commodity} onChange={(e) => setCommodity(e.target.value)}>
                  <option value="">-- Pilih komoditas --</option>
                  {['Padi', 'Jagung', 'Kedelai', 'Tembakau', 'Tebu', 'Edamame', 'Cabai', 'Hortikultura', 'Lainnya'].map((item) => (
                    <option key={item} value={item.toLowerCase()}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="ksa_segment">Kode Segmen KSA</label>
                <input
                  id="ksa_segment"
                  className={inputClass}
                  value={ksaSegment}
                  onChange={(e) => setKsaSegment(e.target.value)}
                  placeholder="350901001-A1"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="ksa_phase">Fase Amatan KSA</label>
                <select id="ksa_phase" className={inputClass} value={ksaPhase} onChange={(e) => setKsaPhase(e.target.value)}>
                  <option value="">-- Pilih fase --</option>
                  {['Vegetatif 1', 'Vegetatif 2', 'Generatif', 'Panen', 'Persiapan Lahan', 'Bera', 'Puso', 'Bukan Sawah'].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <span className={labelClass}>Dampak Indikator BPS</span>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['luas_panen', 'Luas Panen'],
                    ['produktivitas', 'Produktivitas'],
                    ['jadwal_tanam', 'Jadwal Tanam'],
                    ['harga_petani', 'Harga Petani'],
                    ['alih_fungsi_lahan', 'Alih Fungsi Lahan'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={impacts.includes(value)}
                      onClick={() => setImpacts((prev) =>
                        prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
                      )}
                      className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        impacts.includes(value)
                          ? 'border-cta bg-cta text-ctafg'
                          : 'border-garis bg-panel text-tinta2 hover:text-tinta'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {reportType === 'pest' ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="opt">Organisme Pengganggu Tumbuhan (OPT) *</label>
                {optId && selectedOpt ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-cta/40 bg-cta/10 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-tinta">{selectedOpt.name}</p>
                      <p className="font-mono text-[11px] text-tinta3">
                        {selectedOpt.code} · {selectedOpt.category}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearOpt}
                      className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold text-tinta2 hover:text-tinta"
                      aria-label="Ganti OPT"
                    >
                      <X size={14} aria-hidden="true" /> Ganti
                    </button>
                  </div>
                ) : (
                  <div className="relative" onBlur={() => setOptOpen(false)}>
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta3"
                      aria-hidden="true"
                    />
                    <input
                      id="opt"
                      type="search"
                      role="combobox"
                      aria-expanded={optOpen}
                      aria-controls="opt-listbox"
                      autoComplete="off"
                      placeholder="Ketik nama hama / penyakit / gulma atau kode OPT…"
                      className="w-full rounded-md border border-garis bg-panel2 py-2.5 pl-9 pr-3 text-sm text-tinta placeholder:text-tinta3 focus:outline-none focus:ring-2 focus:ring-cta"
                      value={optSearch}
                      onChange={(e) => {
                        setOptSearch(e.target.value);
                        setOptOpen(true);
                      }}
                      onFocus={() => setOptOpen(true)}
                    />
                    {optSearchQuery.isLoading && (
                      <Loader2
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-cta"
                        aria-hidden="true"
                      />
                    )}
                    {optOpen && optItems.length > 0 && (
                      <ul
                        id="opt-listbox"
                        role="listbox"
                        className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-md border border-garis bg-panel shadow-card"
                      >
                        {optItems.map((item) => (
                          <li key={item.id} role="option" aria-selected={false}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleOptSelect(item)}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-panel2"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-tinta">{item.name}</span>
                                <span className="block font-mono text-[11px] text-tinta3">
                                  {item.code} · {item.category}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {optOpen && !optSearchQuery.isLoading && optItems.length === 0 && (
                      <div className="absolute left-0 right-0 z-10 mt-1 rounded-md border border-garis bg-panel px-3 py-2.5 text-sm text-tinta2 shadow-card">
                        Tidak ada OPT cocok dengan pencarian.
                      </div>
                    )}
                  </div>
                )}
              </div>
              {selectedOpt && etlReference !== null && (
                <div className="sm:col-span-2 rounded-md border border-garis bg-panel2 p-3">
                  <p className="text-sm font-semibold text-tinta">
                    Ambang Kendali: {Number(etlReference).toLocaleString('id-ID')}
                    {etlUnit ? ` ${etlUnit}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-tinta2">
                    {selectedOpt.name} · {selectedOpt.category} · {selectedOpt.target_crop}
                  </p>
                </div>
              )}
              {selectedOpt && (
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="population_intensity">
                    Populasi terukur{etlUnit ? ` (${etlUnit})` : ''}
                  </label>
                  <input
                    id="population_intensity"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    className={inputClass}
                    value={populationIntensity}
                    onChange={(e) => setPopulationIntensity(e.target.value)}
                    placeholder="mis. 12"
                  />
                  <p className="mt-1.5 text-[11px] text-tinta3">
                    Jumlah {etlUnit ?? 'populasi'} per satuan pengamatan (rumpun / meter persegi / tanaman sesuai OPT).
                  </p>
                  {isAboveEtl && (
                    <p role="alert" className="mt-2 rounded-md border border-chip-warn-bg bg-chip-warn-bg/40 px-3 py-2 text-xs font-semibold text-chip-warn-fg">
                      ⚠️ Melampaui Ambang Kendali (Perlu Tindakan Segera)
                    </p>
                  )}
                </div>
              )}
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
                <label className={labelClass} htmlFor="threatened">Luas Populasi (ha)</label>
                <input id="threatened" type="number" min={0} step="0.01" inputMode="decimal" className={inputClass} value={threatened} onChange={(e) => setThreatened(e.target.value)} placeholder="3.0" />
                <p className="mt-1.5 text-[11px] text-tinta3">
                  Seluruh tanaman di hamparan, baik yang terkena maupun yang tidak terkena OPT.
                </p>
              </div>
            </div>
          ) : reportType === 'irrigation' ? (
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
          ) : (
            extraDomainForm()
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
