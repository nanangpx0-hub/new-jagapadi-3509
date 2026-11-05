<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\District;
use App\Models\Report;
use App\Models\ReportIrrigationDetail;
use App\Models\ReportNumberCounter;
use App\Models\ReportPestDetail;
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
     * Membuat laporan baru (Draf atau langsung Submitted).
     */
    public function createReport(array $data, User $user, ?string $ip = null): Report
    {
        return DB::transaction(function () use ($data, $user, $ip): Report {
            $reportType = $data['report_type'];
            $isSubmit = ($data['action'] ?? 'draft') === 'submit';
            $status = $isSubmit ? 'Submitted' : 'Draf';
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

            $reportNumber = null;
            if ($isSubmit) {
                $reportNumber = $this->generateReportNumber($reportType, $reportDate);
            }

            $report = Report::create([
                'client_uuid' => $data['client_uuid'] ?? null,
                'report_number' => $reportNumber,
                'report_type' => $reportType,
                'user_id' => $user->id,
                'status' => $status,
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
                'to_status' => $status,
                'actor_id' => $user->id,
                'notes' => $isSubmit ? 'Laporan dikirim langsung dari formulir.' : 'Draf baru dibuat.',
            ]);

            return $report->load(['pestDetail.opt', 'irrigationDetail', 'district', 'village']);
        });
    }

    /**
     * Submit laporan dari status Draf atau Ditolak.
     */
    public function submitReport(Report $report, User $actor): Report
    {
        if (! in_array($report->status, ['Draf', 'Ditolak'], true)) {
            throw ValidationException::withMessages([
                'status' => ["Hanya laporan berstatus 'Draf' atau 'Ditolak' yang dapat dikirim."],
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

            $report->update([
                'status' => 'Submitted',
                'report_number' => $reportNumber,
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
}
