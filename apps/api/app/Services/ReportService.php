<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\District;
use App\Models\Report;
use App\Models\ReportIrrigationDetail;
use App\Models\ReportNumberCounter;
use App\Models\ReportPestDetail;
use App\Models\ReportPhoto;
use App\Models\ReportStatusHistory;
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

    /**
     * Memeriksa apakah titik koordinat berada di luar batas wilayah yang dipilih.
     */
    public function checkCoordinateMismatch(float $lon, float $lat, int $districtId, ?int $villageId): bool
    {
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
                'user_id' => $user->id,
                'status' => 'Draf',
                'report_date' => $reportDate,
                'regency_bps_code' => '3509',
                'district_id' => $data['district_id'],
                'village_id' => $data['village_id'] ?? null,
                'location_name' => $data['location_name'] ?? null,
                'address_detail' => $data['address_detail'] ?? null,
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'is_coordinate_mismatch' => $mismatch,
                'notes' => $data['notes'] ?? null,
                'submitted_ip' => $ip,
            ]);

            // Set PostGIS point geometry jika koordinat tersedia
            if (isset($data['longitude'], $data['latitude'])) {
                DB::statement(
                    'UPDATE reports SET geom = ST_SetSRID(ST_Point(?, ?), 4326) WHERE id = ?',
                    [(float) $data['longitude'], (float) $data['latitude'], $report->id]
                );
            }

            // Simpan detail sesuai domain
            if ($reportType === 'pest' && isset($data['pest_detail'])) {
                $p = $data['pest_detail'];
                ReportPestDetail::create([
                    'report_id' => $report->id,
                    'opt_id' => $p['opt_id'],
                    'crop_type' => $p['crop_type'] ?? 'padi',
                    'crop_age_days' => $p['crop_age_days'] ?? null,
                    'crop_phase' => $p['crop_phase'] ?? null,
                    'intensity_level' => $p['intensity_level'],
                    'affected_area_ha' => $p['affected_area_ha'],
                    'threatened_area_ha' => $p['threatened_area_ha'] ?? null,
                    'control_recommendation' => $p['control_recommendation'] ?? null,
                ]);
            } elseif ($reportType === 'irrigation' && isset($data['irrigation_detail'])) {
                $i = $data['irrigation_detail'];
                ReportIrrigationDetail::create([
                    'report_id' => $report->id,
                    'irrigation_area_name' => $i['irrigation_area_name'] ?? null,
                    'channel_type' => $i['channel_type'],
                    'physical_condition' => $i['physical_condition'],
                    'water_discharge_status' => $i['water_discharge_status'],
                    'service_area_ha' => $i['service_area_ha'] ?? null,
                    'repair_status' => $i['repair_status'] ?? 'Normal',
                    'action_taken' => $i['action_taken'] ?? null,
                ]);
            }

            // Catat riwayat status
            ReportStatusHistory::create([
                'report_id' => $report->id,
                'from_status' => null,
                'to_status' => 'Draf',
                'actor_id' => $user->id,
                'notes' => 'Draf baru dibuat.',
            ]);

            return $report->load(['pestDetail.opt', 'irrigationDetail', 'district', 'village']);
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
            foreach (['report_date', 'district_id', 'village_id', 'location_name', 'address_detail', 'latitude', 'longitude', 'notes'] as $field) {
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

            if ($update !== [] && (isset($update['latitude']) || isset($update['longitude'])) && $report->latitude !== null && $report->longitude !== null) {
                DB::statement(
                    'UPDATE reports SET geom = ST_SetSRID(ST_Point(?, ?), 4326) WHERE id = ?',
                    [(float) $report->longitude, (float) $report->latitude, $report->id]
                );
            }

            // Detail domain: ganti utuh bila dikirim
            if ($report->report_type === 'pest' && array_key_exists('pest_detail', $data) && is_array($data['pest_detail'])) {
                $p = $data['pest_detail'];
                $report->pestDetail()->delete();
                ReportPestDetail::create([
                    'report_id' => $report->id,
                    'opt_id' => $p['opt_id'],
                    'crop_type' => $p['crop_type'] ?? 'padi',
                    'crop_age_days' => $p['crop_age_days'] ?? null,
                    'crop_phase' => $p['crop_phase'] ?? null,
                    'intensity_level' => $p['intensity_level'],
                    'affected_area_ha' => $p['affected_area_ha'],
                    'threatened_area_ha' => $p['threatened_area_ha'] ?? null,
                    'control_recommendation' => $p['control_recommendation'] ?? null,
                ]);
            } elseif ($report->report_type === 'irrigation' && array_key_exists('irrigation_detail', $data) && is_array($data['irrigation_detail'])) {
                $i = $data['irrigation_detail'];
                $report->irrigationDetail()->delete();
                ReportIrrigationDetail::create([
                    'report_id' => $report->id,
                    'irrigation_area_name' => $i['irrigation_area_name'] ?? null,
                    'channel_type' => $i['channel_type'],
                    'physical_condition' => $i['physical_condition'],
                    'water_discharge_status' => $i['water_discharge_status'],
                    'service_area_ha' => $i['service_area_ha'] ?? null,
                    'repair_status' => $i['repair_status'] ?? 'Normal',
                    'action_taken' => $i['action_taken'] ?? null,
                ]);
            }

            return $report->fresh(['pestDetail.opt', 'irrigationDetail', 'district', 'village']);
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

            return $report->fresh();
        });
    }

    /**
     * Soft delete laporan (Admin: semua status; Petugas: hanya Draf miliknya).
     */
    public function deleteReport(Report $report, User $actor): void
    {
        if (! $actor->hasRole('admin')) {
            if (! ($actor->hasRole('petugas') && $report->user_id === $actor->id && $report->status === 'Draf')) {
                throw ValidationException::withMessages([
                    'report' => ['Anda tidak memiliki hak menghapus laporan ini.'],
                ]);
            }
        }

        $report->delete();
    }
}
