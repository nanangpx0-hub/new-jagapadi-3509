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

        /** @var list<array{code: string, name: string, scientific_name?: string|null, local_name?: string|null, category: string, danger_level?: string|null, target_crop?: string|null, description?: string|null, attack_signs?: string|null, management?: string|null, photo_url?: string|null}> $optsData */
        $optsData = json_decode((string) file_get_contents($optsPath), true);

        foreach ($optsData as $item) {
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
                    'photo_url' => $item['photo_url'] ?? null,
                    'is_active' => true,
                ]
            );
        }
    }
}
