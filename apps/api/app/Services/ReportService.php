<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AppNotification;
use App\Models\District;
use App\Models\Opt;
use App\Models\Report;
use App\Models\ReportEquipmentDetail;
use App\Models\ReportFertilizerDetail;
use App\Models\ReportHarvestDetail;
use App\Models\ReportIrrigationDetail;
use App\Models\ReportNumberCounter;
use App\Models\ReportPestDetail;
use App\Models\ReportPestFollowup;
use App\Models\ReportPhoto;
use App\Models\ReportStatusHistory;
use App\Models\ReportWeatherDetail;
use App\Models\User;
use App\Models\Village;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReportService
{
    private const PREFIXES = [
        'pest' => 'LH',
        'irrigation' => 'LI',
        'fertilizer' => 'LP',
        'harvest' => 'LPA',
        'weather' => 'LC',
        'equipment' => 'LAS',
    ];

    /**
     * Generate nomor laporan atomik dengan locking: {PREFIX}-{YYYYMMDD}-{NNNN}
     */
    public function generateReportNumber(string $reportType, ?string $date = null): string
    {
        $prefix = self::PREFIXES[$reportType] ?? 'LP';
        $carbonDate = $date ? Carbon::parse($date) : Carbon::today('Asia/Jakarta');
        $dateYmd = $carbonDate->format('Ymd');

        return DB::transaction(function () use ($reportType, $prefix, $dateYmd): string {
            /** @var ReportNumberCounter|null $counter */
            $counter = ReportNumberCounter::where('report_type', $reportType)
                ->where('date_ymd', $dateYmd)
                ->lockForUpdate()
                ->first();

            if (! $counter) {
                $counter = ReportNumberCounter::create([
                    'report_type' => $reportType,
                    'date_ymd' => $dateYmd,
                    'last_number' => 1,
                ]);
                $seq = 1;
            } else {
                $counter->increment('last_number');
                $seq = $counter->last_number;
            }

            $seqPadded = str_pad((string) $seq, 4, '0', STR_PAD_LEFT);

            return "{$prefix}-{$dateYmd}-{$seqPadded}";
        });
    }

    private function haversineMeters(float $lon, float $lat, float $refLon, float $refLat): float
    {
        $earth = 6371000.0;
        $dLat = deg2rad($refLat - $lat);
        $dLon = deg2rad($refLon - $lon);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat)) * cos(deg2rad($refLat)) * sin($dLon / 2) ** 2;

        return 2 * $earth * asin(min(1.0, sqrt($a)));
    }

    /**
     * Memeriksa apakah titik koordinat berada di luar batas wilayah yang dipilih.
     */
    public function checkCoordinateMismatch(float $lon, float $lat, int $districtId, ?int $villageId): bool
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            // Untuk driver tanpa PostGIS, desa yang dipilih memakai centroid & radiusnya
            // sendiri agar laporan di desa pinggiran tidak terkena false positive.
            if ($villageId) {
                $village = Village::find($villageId);
                if ($village && $village->latitude !== null && $village->longitude !== null) {
                    $radius = (float) ($village->fallback_radius_m ?? 3000.0);

                    return $this->haversineMeters(
                        $lon,
                        $lat,
                        (float) $village->longitude,
                        (float) $village->latitude
                    ) > $radius;
                }
            }

            $district = District::find($districtId);
            if ($district && $district->latitude !== null && $district->longitude !== null) {
                return $this->haversineMeters(
                    $lon,
                    $lat,
                    (float) $district->longitude,
                    (float) $district->latitude
                ) > 15000.0;
            }

            return false;
        }
        // 1. Cek terhadap Desa jika dipilih
        if ($villageId) {
            $village = Village::find($villageId);
            if ($village) {
                // Prioritas 1: Jika poligon desa ada, cek ST_Contains
                $insidePolygon = DB::selectOne(
                    'SELECT ST_Contains(geom, ST_SetSRID(ST_Point(?, ?), 4326)) AS inside FROM villages WHERE id = ? AND geom IS NOT NULL',
                    [$lon, $lat, $villageId]
                );
                if ($insidePolygon !== null) {
                    return ! (bool) $insidePolygon->inside;
                }

                // Prioritas 2: Fallback radius centroid desa
                $radius = $village->fallback_radius_m ?? 3000.0;
                $insideRadius = DB::selectOne(
                    'SELECT (ST_DistanceSphere(centroid, ST_SetSRID(ST_Point(?, ?), 4326)) <= ?) AS inside FROM villages WHERE id = ? AND centroid IS NOT NULL',
                    [$lon, $lat, $radius, $villageId]
                );
                if ($insideRadius !== null && $insideRadius->inside !== null) {
                    return ! (bool) $insideRadius->inside;
                }
            }
        }

        // 2. Fallback terhadap Kecamatan
        $district = District::find($districtId);
        if ($district) {
            $insideDistrict = DB::selectOne(
                'SELECT (ST_DistanceSphere(centroid, ST_SetSRID(ST_Point(?, ?), 4326)) <= 15000) AS inside FROM districts WHERE id = ? AND centroid IS NOT NULL',
                [$lon, $lat, $districtId]
            );
            if ($insideDistrict !== null && $insideDistrict->inside !== null) {
                return ! (bool) $insideDistrict->inside;
            }
        }

        return false;
    }

    /**
     * Evaluasi Ambang Ekonomi (ETL): apakah populasi terukur melampaui ambang OPT?
     *
     * @param  array{opt_id?: mixed, population_intensity?: mixed, etl_unit?: mixed}  $p
     * @return array{population_intensity: float|null, etl_unit: string|null, is_above_etl: bool}
     */
    public function evaluateEtl(array $p): array
    {
        $population = isset($p['population_intensity']) && is_numeric($p['population_intensity'])
            ? (float) $p['population_intensity']
            : null;

        $opt = isset($p['opt_id']) ? Opt::find((int) $p['opt_id']) : null;
        $etlReference = $opt && is_numeric($opt->etl_reference) ? (float) $opt->etl_reference : null;
        $etlUnit = isset($p['etl_unit']) && is_string($p['etl_unit']) && trim($p['etl_unit']) !== ''
            ? trim($p['etl_unit'])
            : $opt?->etl_unit;

        return [
            'population_intensity' => $population,
            'etl_unit' => $etlUnit,
            'is_above_etl' => $population !== null && $etlReference !== null && $population >= $etlReference,
        ];
    }

    /** Produktivitas ton/ha dihitung otomatis dari volume dan luas panen. */
    private function productivityTonHa(array $detail): ?float
    {
        $area = is_numeric($detail['harvest_area_ha'] ?? null) ? (float) $detail['harvest_area_ha'] : 0.0;
        $volume = is_numeric($detail['harvest_volume'] ?? null) ? (float) $detail['harvest_volume'] : 0.0;
        if ($area <= 0) {
            return null;
        }
        $factor = match ($detail['volume_unit'] ?? 'ton') {
            'kg' => 0.001,
            'kuintal' => 0.1,
            default => 1.0,
        };

        return round($volume * $factor / $area, 2);
    }

    /** Simpan detail domain tambahan (pupuk, panen, cuaca, alsintan). */
    private function createDomainDetails(Report $report, array $data): void
    {
        if ($report->report_type === 'fertilizer' && ! empty($data['fertilizer_detail'])) {
            $d = $data['fertilizer_detail'];
            ReportFertilizerDetail::create([
                'report_id' => $report->id,
                'fertilizer_type' => $d['fertilizer_type'] ?? '',
                'dosage_amount' => $d['dosage_amount'] ?? 0,
                'dosage_unit' => $d['dosage_unit'] ?? 'kg/ha',
                'application_method' => $d['application_method'] ?? null,
                'availability_status' => $d['availability_status'] ?? 'Tersedia',
                'related_opt_id' => $d['related_opt_id'] ?? null,
            ]);
        }

        if ($report->report_type === 'harvest' && ! empty($data['harvest_detail'])) {
            $d = $data['harvest_detail'];
            ReportHarvestDetail::create([
                'report_id' => $report->id,
                'commodity' => $d['commodity'] ?? '',
                'variety' => $d['variety'] ?? null,
                'harvest_area_ha' => $d['harvest_area_ha'] ?? 0,
                'harvest_volume' => $d['harvest_volume'] ?? 0,
                'volume_unit' => $d['volume_unit'] ?? 'ton',
                'productivity_ton_ha' => $this->productivityTonHa($d),
                'farmer_price_per_kg' => $d['farmer_price_per_kg'] ?? null,
            ]);
        }

        if ($report->report_type === 'weather' && ! empty($data['weather_detail'])) {
            $d = $data['weather_detail'];
            ReportWeatherDetail::create([
                'report_id' => $report->id,
                'weather_condition' => $d['weather_condition'] ?? '',
                'temperature_c' => $d['temperature_c'] ?? null,
                'humidity_pct' => $d['humidity_pct'] ?? null,
                'rainfall_mm' => $d['rainfall_mm'] ?? null,
                'wind_speed_kmh' => $d['wind_speed_kmh'] ?? null,
                'wind_direction' => $d['wind_direction'] ?? null,
                'impacted_area_ha' => $d['impacted_area_ha'] ?? null,
            ]);
        }

        if ($report->report_type === 'equipment' && ! empty($data['equipment_detail'])) {
            $d = $data['equipment_detail'];
            ReportEquipmentDetail::create([
                'report_id' => $report->id,
                'equipment_category' => $d['equipment_category'] ?? '',
                'equipment_name' => $d['equipment_name'] ?? '',
                'unit_count' => $d['unit_count'] ?? 1,
                'condition_status' => $d['condition_status'] ?? 'Baik',
                'ownership_group' => $d['ownership_group'] ?? null,
            ]);
        }
    }

    /**
     * Kirim notifikasi in-app ke sejumlah pengguna.
     *
     * @param  list<int>  $userIds
     */
    private function notifyUsers(array $userIds, string $type, string $title, string $body, int $reportId): void
    {
        foreach ($userIds as $userId) {
            AppNotification::create([
                'user_id' => $userId,
                'type' => $type,
                'title' => $title,
                'body' => $body,
                'report_id' => $reportId,
            ]);
        }
    }

    /** Catat aktivitas laporan ke activity_log (spatie/laravel-activitylog). */
    private function logReportActivity(string $event, Report $report, User $actor): void
    {
        activity('reports')
            ->causedBy($actor)
            ->performedOn($report)
            ->event($event)
            ->withProperties([
                'report_number' => $report->report_number,
                'status' => $report->status,
            ])
            ->log('Laporan '.$event.': '.($report->report_number ?? '(draf)').'.');
    }

    /** Hapus detail domain lama sebelum ditimpa saat update. */
    private function deleteDomainDetails(Report $report): void
    {
        $report->fertilizerDetail()->delete();
        $report->harvestDetail()->delete();
        $report->weatherDetail()->delete();
        $report->equipmentDetail()->delete();
    }

    /**
     * Membuat laporan baru (selalu berstatus Draf).
     * Transisi ke Submitted dilakukan via submitReport() agar enforcement
     * foto & re-check spasial berjalan satu jalur.
     */
    public function createReport(array $data, User $user, ?string $ip = null): Report
    {
        return DB::transaction(function () use ($data, $user, $ip): Report {
            $reportType = $data['report_type'];
            $reportDate = $data['report_date'] ?? Carbon::today('Asia/Jakarta')->format('Y-m-d');

            $mismatch = false;
            if (isset($data['longitude'], $data['latitude'])) {
                $mismatch = $this->checkCoordinateMismatch(
                    (float) $data['longitude'],
                    (float) $data['latitude'],
                    (int) $data['district_id'],
                    isset($data['village_id']) ? (int) $data['village_id'] : null
                );
            }

            $report = Report::create([
                'client_uuid' => $data['client_uuid'] ?? null,
                'report_number' => null,
                'report_type' => $reportType,
                'commodity' => $data['commodity'] ?? null,
                'ksa_segment_code' => $data['ksa_segment_code'] ?? null,
                'ksa_phase' => $data['ksa_phase'] ?? null,
                'statistical_impacts' => $data['statistical_impacts'] ?? null,
                'user_id' => $user->id,
                'status' => 'Draf',
                'report_date' => $reportDate,
                'regency_bps_code' => '3509',
                'district_id' => $data['district_id'],
                'village_id' => $data['village_id'] ?? null,
                'sls_id' => $data['sls_id'] ?? null,
                'location_name' => $data['location_name'] ?? null,
                'address_detail' => $data['address_detail'] ?? null,
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'is_coordinate_mismatch' => $mismatch,
                'notes' => $data['notes'] ?? null,
                'submitted_ip' => $ip,
            ]);

            // Set PostGIS point geometry jika koordinat tersedia (hanya PostgreSQL)
            if (isset($data['longitude'], $data['latitude']) && DB::connection()->getDriverName() === 'pgsql') {
                DB::statement(
                    'UPDATE reports SET geom = ST_SetSRID(ST_Point(?, ?), 4326) WHERE id = ?',
                    [(float) $data['longitude'], (float) $data['latitude'], $report->id]
                );
            }

            // Simpan detail sesuai domain
            if ($reportType === 'pest' && ! empty($data['pest_detail']['opt_id'])) {
                $p = $data['pest_detail'];
                $etl = $this->evaluateEtl($p);
                ReportPestDetail::create([
                    'report_id' => $report->id,
                    'opt_id' => $p['opt_id'],
                    'crop_type' => $p['crop_type'] ?? 'padi',
                    'crop_age_days' => $p['crop_age_days'] ?? null,
                    'crop_phase' => $p['crop_phase'] ?? null,
                    // Draf boleh parsial; kolom bukan-nullable diberi nilai aman.
                    'intensity_level' => $p['intensity_level'] ?? '',
                    'affected_area_ha' => $p['affected_area_ha'] ?? 0,
                    'threatened_area_ha' => $p['threatened_area_ha'] ?? null,
                    'population_intensity' => $etl['population_intensity'],
                    'etl_unit' => $etl['etl_unit'],
                    'is_above_etl' => $etl['is_above_etl'],
                    'control_recommendation' => $p['control_recommendation'] ?? null,
                ]);
            } elseif ($reportType === 'irrigation' && isset($data['irrigation_detail'])) {
                $i = $data['irrigation_detail'];
                ReportIrrigationDetail::create([
                    'report_id' => $report->id,
                    'irrigation_area_name' => $i['irrigation_area_name'] ?? null,
                    'channel_type' => $i['channel_type'] ?? '',
                    'physical_condition' => $i['physical_condition'] ?? '',
                    'water_discharge_status' => $i['water_discharge_status'] ?? '',
                    'service_area_ha' => $i['service_area_ha'] ?? null,
                    'repair_status' => $i['repair_status'] ?? 'Normal',
                    'action_taken' => $i['action_taken'] ?? null,
                ]);
            }

            $this->createDomainDetails($report, $data);

            // Catat riwayat status
            ReportStatusHistory::create([
                'report_id' => $report->id,
                'from_status' => null,
                'to_status' => 'Draf',
                'actor_id' => $user->id,
                'notes' => 'Draf baru dibuat.',
            ]);

            $this->logReportActivity('created', $report, $user);

            return $report->load([
                'pestDetail.opt',
                'irrigationDetail',
                'fertilizerDetail',
                'harvestDetail',
                'weatherDetail',
                'equipmentDetail',
                'district',
                'village',
                'sls',
            ]);
        });
    }

    /**
     * Submit laporan dari status Draf atau Ditolak.
     * PRD: minimal 1 foto bukti lapangan; PostGIS re-check saat transisi ke Submitted.
     */
    public function submitReport(Report $report, User $actor): Report
    {
        if (! in_array($report->status, ['Draf', 'Ditolak'], true)) {
            throw ValidationException::withMessages([
                'status' => ["Hanya laporan berstatus 'Draf' atau 'Ditolak' yang dapat dikirim."],
            ]);
        }

        // Penegakan PRD: minimal 1 foto bukti lapangan sebelum Submitted
        $photoCount = ReportPhoto::where('report_id', $report->id)->count();
        if ($photoCount < 1) {
            throw ValidationException::withMessages([
                'photos' => ['Minimal 1 foto bukti lapangan wajib diunggah sebelum laporan dikirim.'],
            ]);
        }

        return DB::transaction(function () use ($report, $actor): Report {
            $fromStatus = $report->status;

            // Generate nomor laporan jika belum ada
            $reportNumber = $report->report_number;
            if (! $reportNumber) {
                $dateYmd = Carbon::parse($report->report_date)->format('Ymd');
                $reportNumber = $this->generateReportNumber($report->report_type, $dateYmd);
            }

            // PostGIS re-check pada transisi ke Submitted (PRD §4)
            $mismatch = $report->is_coordinate_mismatch;
            if ($report->latitude !== null && $report->longitude !== null) {
                $mismatch = $this->checkCoordinateMismatch(
                    (float) $report->longitude,
                    (float) $report->latitude,
                    (int) $report->district_id,
                    $report->village_id !== null ? (int) $report->village_id : null
                );
            }

            $report->update([
                'status' => 'Submitted',
                'report_number' => $reportNumber,
                'is_coordinate_mismatch' => $mismatch,
            ]);

            ReportStatusHistory::create([
                'report_id' => $report->id,
                'from_status' => $fromStatus,
                'to_status' => 'Submitted',
                'actor_id' => $actor->id,
                'notes' => $fromStatus === 'Ditolak' ? 'Laporan diperbaiki dan dikirim ulang (resubmit).' : 'Draf dikirim untuk verifikasi.',
            ]);

            $this->logReportActivity('submitted', $report, $actor);

            $verifierIds = User::query()
                ->where('is_active', true)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', ['operator', 'statistisi']))
                ->pluck('id')
                ->all();
            $this->notifyUsers(
                $verifierIds,
                'report_submitted',
                'Laporan Baru Menunggu Verifikasi',
                "Laporan {$reportNumber} telah dikirim oleh {$actor->name}.",
                $report->id
            );

            return $report->fresh();
        });
    }

    /**
     * Verifikasi laporan oleh verifikator (Admin / Operator / Statistisi).
     */
    public function verifyReport(Report $report, User $actor, ?string $notes = null): Report
    {
        if ($report->status !== 'Submitted') {
            throw ValidationException::withMessages([
                'status' => ["Hanya laporan berstatus 'Submitted' yang dapat diverifikasi."],
            ]);
        }

        return DB::transaction(function () use ($report, $actor, $notes): Report {
            $report->update([
                'status' => 'Diverifikasi',
                'verified_by' => $actor->id,
                'verified_at' => now(),
                'verification_notes' => $notes,
            ]);

            ReportStatusHistory::create([
                'report_id' => $report->id,
                'from_status' => 'Submitted',
                'to_status' => 'Diverifikasi',
                'actor_id' => $actor->id,
                'notes' => $notes ?? 'Laporan terverifikasi valid.',
            ]);

            $this->logReportActivity('verified', $report, $actor);

            $this->notifyUsers(
                [$report->user_id],
                'report_verified',
                'Laporan Diverifikasi',
                "Laporan {$report->report_number} telah diverifikasi oleh {$actor->name}.",
                $report->id
            );

            return $report->fresh();
        });
    }

    /**
     * Tolak laporan oleh verifikator dengan alasan penolakan wajib.
     */
    public function rejectReport(Report $report, User $actor, string $reason): Report
    {
        if ($report->status !== 'Submitted') {
            throw ValidationException::withMessages([
                'status' => ["Hanya laporan berstatus 'Submitted' yang dapat ditolak."],
            ]);
        }

        if (strlen(trim($reason)) < 5) {
            throw ValidationException::withMessages([
                'reason' => ['Alasan penolakan minimal 5 karakter.'],
            ]);
        }

        return DB::transaction(function () use ($report, $actor, $reason): Report {
            $report->update([
                'status' => 'Ditolak',
                'verified_by' => $actor->id,
                'verified_at' => now(),
                'verification_notes' => $reason,
            ]);

            ReportStatusHistory::create([
                'report_id' => $report->id,
                'from_status' => 'Submitted',
                'to_status' => 'Ditolak',
                'actor_id' => $actor->id,
                'notes' => $reason,
            ]);

            $this->logReportActivity('rejected', $report, $actor);

            $this->notifyUsers(
                [$report->user_id],
                'report_rejected',
                'Laporan Ditolak — Perlu Perbaikan',
                "Laporan {$report->report_number} ditolak: {$reason}",
                $report->id
            );

            return $report->fresh();
        });
    }

    /**
     * Memperbarui laporan berstatus Draf atau Ditolak (milik sendiri / admin).
     * Jenis laporan (report_type) dikunci; detail domain diganti utuh bila dikirim.
     */
    public function updateReport(Report $report, array $data, User $actor): Report
    {
        if (! in_array($report->status, ['Draf', 'Ditolak'], true)) {
            throw ValidationException::withMessages([
                'status' => ["Hanya laporan berstatus 'Draf' atau 'Ditolak' yang dapat diedit."],
            ]);
        }

        if (array_key_exists('report_type', $data) && $data['report_type'] !== $report->report_type) {
            throw ValidationException::withMessages([
                'report_type' => ['Jenis laporan tidak dapat diubah; buat draf laporan baru.'],
            ]);
        }

        return DB::transaction(function () use ($report, $data): Report {
            $update = [];
            foreach (['report_date', 'district_id', 'village_id', 'sls_id', 'location_name', 'address_detail', 'latitude', 'longitude', 'notes', 'commodity', 'ksa_segment_code', 'ksa_phase', 'statistical_impacts'] as $field) {
                if (array_key_exists($field, $data)) {
                    $update[$field] = $data[$field];
                }
            }

            // Koordinat berubah → update geom & re-check mismatch
            $coordsChanged = array_key_exists('latitude', $data) || array_key_exists('longitude', $data) || array_key_exists('village_id', $data) || array_key_exists('district_id', $data);
            if ($coordsChanged) {
                $lat = $update['latitude'] ?? $report->latitude;
                $lng = $update['longitude'] ?? $report->longitude;
                $districtId = (int) ($update['district_id'] ?? $report->district_id);
                $villageIdRaw = $update['village_id'] ?? $report->village_id;
                $villageId = $villageIdRaw !== null ? (int) $villageIdRaw : null;

                if ($lat !== null && $lng !== null) {
                    $update['is_coordinate_mismatch'] = $this->checkCoordinateMismatch((float) $lng, (float) $lat, $districtId, $villageId);
                }
            }

            if ($update !== []) {
                $report->update($update);
            }

            if ($update !== [] && DB::connection()->getDriverName() === 'pgsql' && (isset($update['latitude']) || isset($update['longitude'])) && $report->latitude !== null && $report->longitude !== null) {
                DB::statement(
                    'UPDATE reports SET geom = ST_SetSRID(ST_Point(?, ?), 4326) WHERE id = ?',
                    [(float) $report->longitude, (float) $report->latitude, $report->id]
                );
            }

            // Detail domain: ganti utuh bila dikirim
            if ($report->report_type === 'pest' && ! empty($data['pest_detail']['opt_id'])) {
                $p = $data['pest_detail'];
                $report->pestDetail()->delete();
                $etl = $this->evaluateEtl($p);
                ReportPestDetail::create([
                    'report_id' => $report->id,
                    'opt_id' => $p['opt_id'],
                    'crop_type' => $p['crop_type'] ?? 'padi',
                    'crop_age_days' => $p['crop_age_days'] ?? null,
                    'crop_phase' => $p['crop_phase'] ?? null,
                    'intensity_level' => $p['intensity_level'] ?? '',
                    'affected_area_ha' => $p['affected_area_ha'] ?? 0,
                    'threatened_area_ha' => $p['threatened_area_ha'] ?? null,
                    'population_intensity' => $etl['population_intensity'],
                    'etl_unit' => $etl['etl_unit'],
                    'is_above_etl' => $etl['is_above_etl'],
                    'control_recommendation' => $p['control_recommendation'] ?? null,
                ]);
            } elseif ($report->report_type === 'irrigation' && array_key_exists('irrigation_detail', $data) && is_array($data['irrigation_detail'])) {
                $i = $data['irrigation_detail'];
                $report->irrigationDetail()->delete();
                ReportIrrigationDetail::create([
                    'report_id' => $report->id,
                    'irrigation_area_name' => $i['irrigation_area_name'] ?? null,
                    'channel_type' => $i['channel_type'] ?? '',
                    'physical_condition' => $i['physical_condition'] ?? '',
                    'water_discharge_status' => $i['water_discharge_status'] ?? '',
                    'service_area_ha' => $i['service_area_ha'] ?? null,
                    'repair_status' => $i['repair_status'] ?? 'Normal',
                    'action_taken' => $i['action_taken'] ?? null,
                ]);
            }

            $this->deleteDomainDetails($report);
            $this->createDomainDetails($report, $data);

            return $report->fresh([
                'pestDetail.opt',
                'irrigationDetail',
                'fertilizerDetail',
                'harvestDetail',
                'weatherDetail',
                'equipmentDetail',
                'district',
                'village',
                'sls',
            ]);
        });
    }

    /**
     * Arsipkan laporan Diverifikasi → Diarsipkan (Admin / Operator).
     */
    public function archiveReport(Report $report, User $actor): Report
    {
        if ($report->status !== 'Diverifikasi') {
            throw ValidationException::withMessages([
                'status' => ["Hanya laporan berstatus 'Diverifikasi' yang dapat diarsipkan."],
            ]);
        }

        return DB::transaction(function () use ($report, $actor): Report {
            $report->update(['status' => 'Diarsipkan']);

            ReportStatusHistory::create([
                'report_id' => $report->id,
                'from_status' => 'Diverifikasi',
                'to_status' => 'Diarsipkan',
                'actor_id' => $actor->id,
                'notes' => 'Laporan diarsipkan.',
            ]);

            $this->logReportActivity('archived', $report, $actor);

            return $report->fresh();
        });
    }

    /**
     * Mencatat tindak lanjut pengendalian (Gerdal) pada laporan hama terverifikasi.
     */
    public function recordFollowup(Report $report, array $data, User $actor): ReportPestFollowup
    {
        if ($report->report_type !== 'pest') {
            throw ValidationException::withMessages([
                'report' => ['Tindak lanjut Gerdal hanya untuk laporan hama.'],
            ]);
        }

        if ($report->status !== 'Diverifikasi') {
            throw ValidationException::withMessages([
                'report' => ['Tindak lanjut Gerdal hanya untuk laporan berstatus Diverifikasi.'],
            ]);
        }

        return ReportPestFollowup::create([
            'report_id' => $report->id,
            'user_id' => $actor->id,
            'action_date' => $data['action_date'],
            'control_method' => $data['control_method'],
            'controlled_area_ha' => $data['controlled_area_ha'] ?? null,
            'chemicals_or_agents_used' => $data['chemicals_or_agents_used'] ?? null,
            'outcome_status' => $data['outcome_status'],
            'notes' => $data['notes'] ?? null,
        ]);
    }

    /**
     * Soft delete laporan (Admin: semua status; Petugas: hanya Draf miliknya).
     */
    public function deleteReport(Report $report, User $actor): void
    {
        if (! $actor->hasAnyRole(['superadmin', 'admin'])) {
            if (! ($actor->hasRole('petugas') && $report->user_id === $actor->id && $report->status === 'Draf')) {
                throw ValidationException::withMessages([
                    'report' => ['Anda tidak memiliki hak menghapus laporan ini.'],
                ]);
            }
        }

        $report->delete();

        $this->logReportActivity('deleted', $report, $actor);
    }
}
