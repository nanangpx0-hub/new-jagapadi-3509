<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\District;
use App\Models\Village;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SlsSeeder extends Seeder
{
    /**
     * Memuat 16.776 SLS dari database/data/sls.json (hasil tools/sync_mfd_data.py).
     * Idempoten: tabel dikosongkan lalu dimuat ulang.
     */
    public function run(): void
    {
        $path = database_path('data/sls.json');

        if (! file_exists($path)) {
            $this->command?->warn('File sls.json tidak ditemukan. Jalankan tools/sync_mfd_data.py terlebih dahulu.');

            return;
        }

        /** @var list<array{idsls:string, code:string, name:string, village_code:string, district_code:string, kk:int|null, muatan:int|null, luas:float|null, latitude:float|null, longitude:float|null}> $rows */
        $rows = json_decode((string) file_get_contents($path), true);

        /** @var array<string, int> $villageMap */
        $villageMap = Village::pluck('id', 'code')->all();
        /** @var array<string, int> $districtMap */
        $districtMap = District::pluck('id', 'code')->all();

        $now = now();
        $batch = [];
        $skipped = 0;
        $flush = function () use (&$batch): void {
            if ($batch !== []) {
                DB::table('sls')->insert($batch);
                $batch = [];
            }
        };

        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            try {
                DB::table('sls')->truncate();
            } finally {
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
            }
        } else {
            DB::table('sls')->truncate();
        }

        foreach ($rows as $row) {
            $villageId = $villageMap[$row['village_code']] ?? null;
            $districtId = $districtMap[$row['district_code']] ?? null;
            if (! $villageId || ! $districtId) {
                $skipped++;

                continue;
            }
            $batch[] = [
                'district_id' => $districtId,
                'village_id' => $villageId,
                'idsls' => $row['idsls'],
                'code' => $row['code'],
                'name' => $row['name'],
                'latitude' => $row['latitude'] ?? null,
                'longitude' => $row['longitude'] ?? null,
                'kk' => $row['kk'] ?? null,
                'muatan' => $row['muatan'] ?? null,
                'luas' => $row['luas'] ?? null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            if (count($batch) >= 500) {
                $flush();
            }
        }
        $flush();

        $count = DB::table('sls')->count();
        $this->command?->info("SLS termuat: {$count} baris".($skipped > 0 ? " ({$skipped} dilewati)" : ''));
    }
}
