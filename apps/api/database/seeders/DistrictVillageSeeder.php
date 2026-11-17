<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\District;
use App\Models\Village;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DistrictVillageSeeder extends Seeder
{
    public function run(): void
    {
        $districtsPath = database_path('data/districts.json');
        $villagesPath = database_path('data/villages.json');

        if (! file_exists($districtsPath) || ! file_exists($villagesPath)) {
            $this->command?->warn('File data wilayah JSON tidak ditemukan.');

            return;
        }

        /** @var list<array{code: string, name: string, latitude: float|null, longitude: float|null}> $districtsData */
        $districtsData = json_decode((string) file_get_contents($districtsPath), true);
        /** @var list<array{district_code: string, code: string, name: string, latitude?: float|null, longitude?: float|null, fallback_radius_m?: float|null}> $villagesData */
        $villagesData = json_decode((string) file_get_contents($villagesPath), true);

        $driver = DB::connection()->getDriverName();
        $districtMap = [];

        // 1. Seed 31 Kecamatan
        foreach ($districtsData as $d) {
            $district = District::updateOrCreate(
                ['code' => $d['code']],
                [
                    'regency_bps_code' => '3509',
                    'name' => $d['name'],
                    'latitude' => $d['latitude'],
                    'longitude' => $d['longitude'],
                    'source' => 'BPS Jember (3509)',
                ]
            );

            if ($d['longitude'] && $d['latitude']) {
                $this->setCentroid('districts', $district->id, (float) $d['longitude'], (float) $d['latitude'], $driver);
            }

            $districtMap[$d['code']] = $district;
        }

        // 2. Seed 248 Desa/Kelurahan dengan koordinat & radius spesifik masing-masing desa
        foreach ($villagesData as $v) {
            $district = $districtMap[$v['district_code']] ?? null;
            if (! $district) {
                continue;
            }

            $lat = $v['latitude'] ?? null;
            $lon = $v['longitude'] ?? null;
            // Fallback ke koordinat kecamatan hanya bila koordinat desa tidak tersedia.
            $centroidLat = $lat ?? ($district->latitude !== null ? (float) $district->latitude : null);
            $centroidLon = $lon ?? ($district->longitude !== null ? (float) $district->longitude : null);

            $village = Village::updateOrCreate(
                ['code' => $v['code']],
                [
                    'district_id' => $district->id,
                    'name' => $v['name'],
                    'latitude' => $lat,
                    'longitude' => $lon,
                    'fallback_radius_m' => $v['fallback_radius_m'] ?? 3000.0,
                    'source' => 'BPS Jember (3509)',
                ]
            );

            if ($centroidLon !== null && $centroidLat !== null) {
                // Setel ulang centroid desa agar mengikuti koordinat aslinya.
                $this->setCentroid('villages', $village->id, $centroidLon, $centroidLat, $driver);
            }
        }
    }

    private function setCentroid(string $table, int $id, float $lon, float $lat, string $driver): void
    {
        if ($driver === 'pgsql') {
            DB::statement(
                "UPDATE {$table} SET centroid = ST_SetSRID(ST_Point(?, ?), 4326) WHERE id = ?",
                [$lon, $lat, $id]
            );
        } elseif ($driver === 'mysql') {
            DB::statement(
                "UPDATE {$table} SET centroid = ST_GeomFromText(?, 4326) WHERE id = ?",
                ["POINT({$lon} {$lat})", $id]
            );
        }
    }
}
