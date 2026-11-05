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

        /** @var list<array{code: string, name: string, latitude: float, longitude: float}> $districtsData */
        $districtsData = json_decode((string) file_get_contents($districtsPath), true);
        /** @var list<array{district_code: string, code: string, name: string}> $villagesData */
        $villagesData = json_decode((string) file_get_contents($villagesPath), true);

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
                DB::statement(
                    'UPDATE districts SET centroid = ST_SetSRID(ST_Point(?, ?), 4326) WHERE id = ?',
                    [$d['longitude'], $d['latitude'], $district->id]
                );
            }

            $districtMap[$d['code']] = $district;
        }

        // 2. Seed 248 Desa/Kelurahan
        foreach ($villagesData as $v) {
            $district = $districtMap[$v['district_code']] ?? null;
            if (! $district) {
                continue;
            }

            $village = Village::updateOrCreate(
                ['code' => $v['code']],
                [
                    'district_id' => $district->id,
                    'name' => $v['name'],
                    'fallback_radius_m' => 3000.0,
                    'source' => 'BPS Jember (3509)',
                ]
            );

            // Set fallback centroid ke centroid kecamatan
            if ($district->longitude && $district->latitude) {
                DB::statement(
                    'UPDATE villages SET centroid = ST_SetSRID(ST_Point(?, ?), 4326) WHERE id = ? AND centroid IS NULL',
                    [$district->longitude, $district->latitude, $village->id]
                );
            }
        }
    }
}
