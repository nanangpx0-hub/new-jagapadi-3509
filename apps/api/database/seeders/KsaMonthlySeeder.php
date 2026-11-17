<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\District;
use App\Models\KsaMonthly;
use Illuminate\Database\Seeder;

class KsaMonthlySeeder extends Seeder
{
    public function run(): void
    {
        $districts = District::orderBy('code')->get();
        $year = 2026;

        foreach ($districts as $index => $district) {
            $seed = (int) substr($district->code, -3);
            // Beberapa kecamatan sengaja diberi angka Puso > 0 agar deteksi anomali teruji.
            $puso = $index % 7 === 0 ? round(5 + ($index % 5) * 1.5, 2) : 0.0;

            for ($month = 1; $month <= 11; $month++) {
                $planted = round(500 + ($seed % 10) * 75 + $month * 12, 2);
                $bera = round(20 + ($seed % 8) * 5, 2);
                $harvest = round(max(0, $planted - $bera - $puso), 2);
                $production = round($harvest * (4.5 + ($seed % 10) / 10), 2);

                KsaMonthly::updateOrCreate(
                    [
                        'district_id' => $district->id,
                        'year' => $year,
                        'month' => $month,
                        'commodity' => 'padi',
                    ],
                    [
                        'planted_area_ha' => $planted,
                        'bera_area_ha' => $bera,
                        'puso_area_ha' => $puso,
                        'harvest_area_ha' => $harvest,
                        'estimated_production_ton' => $production,
                    ]
                );
            }
        }

        $this->command?->info('KSA bulanan termuat: '.KsaMonthly::count().' baris.');
    }
}
