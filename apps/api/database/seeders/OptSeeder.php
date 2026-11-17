<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Opt;
use Illuminate\Database\Seeder;

class OptSeeder extends Seeder
{
    public function run(): void
    {
        $optsPath = database_path('data/opts.json');

        if (! file_exists($optsPath)) {
            $this->command?->warn('File opts.json tidak ditemukan.');

            return;
        }

        /** @var list<array{code: string, name: string, scientific_name?: string|null, local_name?: string|null, category: string, danger_level?: string|null, target_crop?: string|null, description?: string|null, attack_signs?: string|null, management?: string|null, etl_reference?: numeric|null, etl_unit?: string|null, photo_url?: string|null}> $optsData */
        $optsData = json_decode((string) file_get_contents($optsPath), true);

        /** Ambang ekonomi (ETL) referensi per kode OPT, bila tidak ada di opts.json. */
        $etlMap = [
            'OPT-PADI-WBC' => [10, 'ekor/rumpun'],
            'OPT-PADI-PBP' => [2, 'kelompok telur/rumpun'],
            'OPT-PADI-TIK' => [5, '%'],
            'OPT-PADI-WS' => [5, 'ekor/100 m2'],
            'OPT-PADI-BLAS' => [5, '%'],
            'OPT-PADI-HDB' => [5, '%'],
            'OPT-PADI-KM' => [2, 'ekor/m2'],
            'OPT-JAG-FAW' => [1, 'ekor/tanaman'],
            'OPT-JAG-BLB' => [1, '%'],
            'OPT-JAG-PTJ' => [1, 'larva/tongkol'],
            'OPT-KED-LGK' => [5, 'ekor/tanaman'],
            'OPT-KED-PPK' => [1, 'larva/rumpun'],
            'OPT-UBI-TMK' => [10, 'ekor/daun'],
            'OPT-UBI-BLNG' => [5, '%'],
        ];

        foreach ($optsData as $item) {
            [$etlReference, $etlUnit] = $etlMap[$item['code']] ?? [null, null];
            Opt::updateOrCreate(
                ['code' => $item['code']],
                [
                    'name' => $item['name'],
                    'scientific_name' => $item['scientific_name'] ?? null,
                    'local_name' => $item['local_name'] ?? null,
                    'category' => $item['category'] ?? 'hama',
                    'danger_level' => $item['danger_level'] ?? 'Sedang',
                    'target_crop' => $item['target_crop'] ?? 'padi',
                    'description' => $item['description'] ?? null,
                    'attack_signs' => $item['attack_signs'] ?? null,
                    'management' => $item['management'] ?? null,
                    'etl_reference' => $item['etl_reference'] ?? $etlReference,
                    'etl_unit' => $item['etl_unit'] ?? $etlUnit,
                    'photo_url' => $item['photo_url'] ?? null,
                    'is_active' => true,
                ]
            );
        }
    }
}
