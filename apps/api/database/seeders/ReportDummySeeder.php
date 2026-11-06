<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\District;
use App\Models\Opt;
use App\Models\Report;
use App\Models\ReportPhoto;
use App\Models\User;
use App\Models\Village;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Data dummy realistis untuk Fase 3/4: 40 laporan Hama & Irigasi tersebar dalam 90 hari terakhir.
 * Distribusi status: Diverifikasi 20, Submitted 12, Draf 5, Ditolak 3.
 * Koordinat: di sekitar centroid kecamatan (fallback, poligon desa belum lengkap).
 * Idempoten: laporan dummy (`client_uuid` prefix d0000000-…) dihapus dan dimuat ulang.
 */
final class ReportDummySeeder extends Seeder
{
    private const DUMMY_PREFIX = 'd0000000-0000-4000-8000-';

    public function run(): void
    {
        $service = app(ReportService::class);

        // Bersihkan dummy sebelumnya (idempoten)
        $dummyIds = Report::withTrashed()->where('client_uuid', 'like', self::DUMMY_PREFIX.'%')->pluck('id');
        if ($dummyIds->isNotEmpty()) {
            ReportPhoto::whereIn('report_id', $dummyIds)->delete();
            Report::withTrashed()->whereIn('id', $dummyIds)->forceDelete();
            $this->command?->info('Dummy lama dihapus: '.$dummyIds->count());
        }

        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $statistisi = User::where('email', 'statistisi@jagapadi.test')->firstOrFail();
        $operator = User::where('email', 'operator@jagapadi.test')->firstOrFail();

        $districtPool = District::with('villages:id,district_id')->get();
        $opts = Opt::where('is_active', true)->get()->groupBy('target_crop');

        // Rencana 40 laporan: [target status, report_type, pest crop]
        $plan = [];
        foreach (array_merge(array_fill(0, 20, 'Diverifikasi'), array_fill(0, 12, 'Submitted'), array_fill(0, 5, 'Draf'), array_fill(0, 3, 'Ditolak')) as $status) {
            $plan[] = $status;
        }
        shuffle($plan);
        // Pastikan tiap status muncul tepat sesuai rencana
        $plan = array_slice($plan, 0, 40);

        mt_srand(20261105);
        $made = 0;

        foreach ($plan as $i => $targetStatus) {
            $district = $districtPool->random();
            /** @var Village|null $village */
            $village = $district->villages->isNotEmpty() ? $district->villages->random() : null;

            $latJitter = (mt_rand(-2800, 2800)) / 100000;
            $lngJitter = (mt_rand(-3300, 3300)) / 100000;
            $lat = round((float) $district->latitude + $latJitter, 6);
            $lng = round((float) $district->longitude + $lngJitter, 6);

            $daysAgo = mt_rand(1, 88);
            $date = Carbon::today('Asia/Jakarta')->subDays($daysAgo);
            $clientUuid = self::DUMMY_PREFIX.str_pad((string) ($i + 1), 12, '0', STR_PAD_LEFT);

            $isPest = mt_rand(1, 10) <= 7; // 70% pest, 30% irrigation
            $reportType = $isPest ? 'pest' : 'irrigation';
            $crop = $isPest ? (['padi', 'padi', 'padi', 'jagung', 'jagung', 'kedelai'][mt_rand(0, 5)]) : null;

            $data = [
                'client_uuid' => $clientUuid,
                'report_type' => $reportType,
                'action' => 'draft',
                'report_date' => $date->format('Y-m-d'),
                'district_id' => $district->id,
                'village_id' => $village?->id,
                'location_name' => ['Blok Sawah Timur', 'Blok Sawah Barat', 'Petakan Atas', 'Petakan Bawah', 'Dekat Embung', 'Sisi Saluran Primer', 'Pekarangan Dekat Rumah'][mt_rand(0, 6)],
                'address_detail' => 'Dusun '.['Krajan', 'Panggulmati', 'Sumbersari', 'Jatiagung', 'Kalimalang', 'Kamaran'][mt_rand(0, 5)],
                'latitude' => $lat,
                'longitude' => $lng,
                'notes' => ['Serangan terlihat sejak 3 hari lalu.', 'Petani membutuhkan rekomendasi segera.', 'Monitoring rutin mingguan.', 'Cuaca kering memicu lonjakan populasi.', 'Curah hujan tinggi 3 hari terakhir.'][mt_rand(0, 4)],
            ];

            if ($isPest) {
                $cropOpts = $opts->get($crop) ?? $opts->first();
                /** @var Opt $opt */
                $opt = $cropOpts->random();
                $severity = ['Ringan', 'Sedang', 'Sedang', 'Berat', 'Berat', 'Berat', 'Puso'][mt_rand(0, 6)];
                $data['pest_detail'] = [
                    'opt_id' => $opt->id,
                    'crop_type' => $crop,
                    'crop_age_days' => mt_rand(15, 125),
                    'crop_phase' => ['vegetatif', 'vegetatif', 'generatif', 'panen'][mt_rand(0, 3)],
                    'intensity_level' => $severity,
                    'affected_area_ha' => round(mt_rand(25, 1250) / 100, 2),
                    'threatened_area_ha' => round(mt_rand(10, 400) / 100, 2),
                    'control_recommendation' => ['Pemantauan intensif & pelepasan musuh alami.', 'Aplikasi agens hayati Beauveria bassiana.', 'Konsultasi dinas untuk insektisida selektif.', null][mt_rand(0, 3)],
                ];
            } else {
                $data['irrigation_detail'] = [
                    'irrigation_area_name' => ['DI Bedadung', 'DI Juanda', 'DI Kalisat', 'DI Tanggul', 'DI Gumukmas', 'DI Silo'][mt_rand(0, 5)],
                    'channel_type' => ['Tersier', 'Sekunder', 'Sekunder', 'Primer'][mt_rand(0, 3)],
                    'physical_condition' => ['Bagus', 'Sedang', 'Sedang', 'Rusak'][mt_rand(0, 3)],
                    'water_discharge_status' => ['Cukup', 'Kurang', 'Kurang', 'Kering'][mt_rand(0, 3)],
                    'service_area_ha' => round(mt_rand(50, 2500) / 10, 1),
                    'repair_status' => ['Normal', 'Belum Ditangani', 'Dalam Perbaikan'][mt_rand(0, 2)],
                    'action_taken' => ['Pembersihan sedimen saluran.', 'Perbaikan pasangan bata rusak.', 'Belum ada tindakan; dilaporkan ke dinas.', null][mt_rand(0, 3)],
                ];
            }

            // 1) Buat Draf
            $report = $service->createReport($data, $petugas, '127.0.0.1');

            if ($targetStatus === 'Draf') {
                $made++;

                continue;
            }

            // 2) Lampirkan foto placeholder (wajib sebelum Submitted)
            $photoPath = $this->storePlaceholderPhoto($report->id, $i + 1);
            ReportPhoto::create([
                'report_id' => $report->id,
                'file_path' => $photoPath,
                'caption' => 'Dokumentasi lapangan (data contoh)',
                'file_size_bytes' => Storage::disk('public')->size($photoPath),
                'mime_type' => 'image/webp',
                'width' => 640,
                'height' => 480,
            ]);

            // 3) Submit (nomor atomik + riwayat)
            $service->submitReport($report, $petugas);

            if ($targetStatus === 'Submitted') {
                $made++;

                continue;
            }

            // 4) Verifikasi (mayoritas) atau Tolak
            if ($targetStatus === 'Diverifikasi') {
                $verificator = mt_rand(0, 1) ? $statistisi : $operator;
                $service->verifyReport($report->fresh(), $verificator, [
                    'Sesuai sampel lapangan; data valid.',
                    'Kondisi sesuai laporan petugas.',
                    'Diverifikasi untuk rekapitulasi bulanan.',
                ][mt_rand(0, 2)]);
            } else {
                $service->rejectReport($report->fresh(), $operator, [
                    'Foto bukti kurang jelas; mohon ambil ulang.',
                    'Koordinat di luar batas desa yang dipilih.',
                    'Detail serangan belum lengkap; lengkapi intensitas.',
                ][mt_rand(0, 2)]);
            }
            $made++;
        }

        // Isi geom spasial untuk seluruh laporan yang punya koordinat
        DB::statement('UPDATE reports SET geom = ST_SetSRID(ST_Point(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geom IS NULL');

        $byStatus = Report::selectRaw('status, count(*) AS c')->groupBy('status')->pluck('c', 'status');
        $this->command?->info("Dummy laporan dibuat: {$made} baris | ".json_encode($byStatus));
    }

    /**
     * Placeholder foto WebP 640x480 (GD) — lanskap sawah abstrak bergaris.
     */
    private function storePlaceholderPhoto(int $reportId, int $seed): string
    {
        $img = imagecreatetruecolor(640, 480);
        $sky = imagecolorallocate($img, 168, 209, 235);
        $sun = imagecolorallocate($img, 250, 214, 120);
        $field1 = imagecolorallocate($img, 44, 122, 60);
        $field2 = imagecolorallocate($img, 62, 145, 74);
        imagefilledrectangle($img, 0, 0, 640, 480, $sky);
        imagefilledellipse($img, 500, 70, 90, 90, $sun);
        imagefilledrectangle($img, 0, 260, 640, 480, $field1);
        for ($y = 300; $y < 480; $y += 26) {
            imagefilledrectangle($img, 0, $y, 640, $y + 10, $field2);
        }
        $line = imagecolorallocate($img, 255, 255, 255);
        imageline($img, 0, 260, 640, 260, $line);
        $textColor = imagecolorallocate($img, 255, 255, 255);
        imagestring($img, 5, 18, 440, 'JAGAPADI - LAPANGAN #'.$seed, $textColor);

        $tmp = tempnam(sys_get_temp_dir(), 'dummy_').'.webp';
        imagewebp($img, $tmp, 80);
        imagedestroy($img);

        $path = "reports/{$reportId}/dummy-".uniqid().'.webp';
        Storage::disk('public')->put($path, file_get_contents($tmp));
        unlink($tmp);

        return $path;
    }
}
