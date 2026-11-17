<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\District;
use App\Models\Opt;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class RemainingDomainsTest extends TestCase
{
    use DatabaseTransactions;

    /** @return array<string, mixed> */
    private function basePayload(string $type): array
    {
        return [
            'report_type' => $type,
            'action' => 'submit',
            'report_date' => '2026-11-04',
            'district_id' => District::firstOrFail()->id,
            'photos' => [UploadedFile::fake()->image('bukti.jpg', 800, 600)],
        ];
    }

    public function test_laporan_pupuk_dapat_disubmit(): void
    {
        Storage::fake('public');
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $opt = Opt::firstOrFail();

        $response = $this->actingAs($petugas)->post('/api/reports', array_merge($this->basePayload('fertilizer'), [
            'fertilizer_detail' => [
                'fertilizer_type' => 'Urea',
                'dosage_amount' => 250,
                'dosage_unit' => 'kg/ha',
                'application_method' => 'Tebar',
                'availability_status' => 'Langka',
                'related_opt_id' => $opt->id,
            ],
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.status', 'Submitted')
            ->assertJsonPath('data.fertilizer_detail.fertilizer_type', 'Urea')
            ->assertJsonPath('data.fertilizer_detail.availability_status', 'Langka');
        $this->assertStringStartsWith('LP-', (string) $response->json('data.report_number'));
    }

    public function test_laporan_panen_menghitung_produktivitas_otomatis(): void
    {
        Storage::fake('public');
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();

        $response = $this->actingAs($petugas)->post('/api/reports', array_merge($this->basePayload('harvest'), [
            'harvest_detail' => [
                'commodity' => 'Padi',
                'variety' => 'Inpari 32',
                'harvest_area_ha' => 2,
                'harvest_volume' => 14000,
                'volume_unit' => 'kg',
                'farmer_price_per_kg' => 6500,
            ],
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.status', 'Submitted')
            // 14.000 kg = 14 ton / 2 ha = 7 ton/ha
            ->assertJsonPath('data.harvest_detail.productivity_ton_ha', 7);
        $this->assertStringStartsWith('LPA-', (string) $response->json('data.report_number'));
    }

    public function test_laporan_cuaca_dapat_disubmit(): void
    {
        Storage::fake('public');
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();

        $this->actingAs($petugas)->post('/api/reports', array_merge($this->basePayload('weather'), [
            'weather_detail' => [
                'weather_condition' => 'Banjir',
                'rainfall_mm' => 180.5,
                'impacted_area_ha' => 12.5,
            ],
        ]))
            ->assertCreated()
            ->assertJsonPath('data.weather_detail.weather_condition', 'Banjir')
            ->assertJsonPath('data.weather_detail.impacted_area_ha', 12.5);
    }

    public function test_laporan_alsintan_dapat_disubmit(): void
    {
        Storage::fake('public');
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();

        $this->actingAs($petugas)->post('/api/reports', array_merge($this->basePayload('equipment'), [
            'equipment_detail' => [
                'equipment_category' => 'Traktor Roda 2',
                'equipment_name' => 'Traktor Poktan Sumber Rejeki',
                'unit_count' => 3,
                'condition_status' => 'Rusak Ringan',
                'ownership_group' => 'Poktan Sumber Rejeki',
            ],
        ]))
            ->assertCreated()
            ->assertJsonPath('data.equipment_detail.equipment_category', 'Traktor Roda 2')
            ->assertJsonPath('data.equipment_detail.unit_count', 3);
    }

    public function test_submit_domain_baru_wajib_memiliki_detail(): void
    {
        Storage::fake('public');
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();

        $this->actingAs($petugas)->post('/api/reports', $this->basePayload('harvest'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('harvest_detail');
    }

    public function test_draf_parsial_empat_domain_baru_tidak_error_dan_dapat_diupdate(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();

        $partials = [
            'fertilizer' => ['fertilizer_detail' => ['dosage_amount' => 10]],
            'harvest' => ['harvest_detail' => ['harvest_volume' => 100]],
            'weather' => ['weather_detail' => ['rainfall_mm' => 12.5]],
            'equipment' => ['equipment_detail' => ['unit_count' => 2]],
        ];

        foreach ($partials as $type => $detail) {
            $created = $this->actingAs($petugas)->postJson('/api/reports', array_merge([
                'report_type' => $type,
                'action' => 'draft',
                'district_id' => $district->id,
            ], $detail));

            $created->assertCreated();
            $reportId = (int) $created->json('data.id');

            // Update draf dengan detail parsial lain harus tetap diterima.
            $this->actingAs($petugas)
                ->putJson('/api/reports/'.$reportId, [
                    'notes' => 'Draf parsial diperbarui.',
                    ...$detail,
                ])
                ->assertOk()
                ->assertJsonPath('data.notes', 'Draf parsial diperbarui.');
        }

        // Fallback kolom non-nullable harus terisi sehingga tidak ada NOT NULL violation.
        $fertilizer = $this->actingAs($petugas)->postJson('/api/reports', [
            'report_type' => 'fertilizer',
            'action' => 'draft',
            'district_id' => $district->id,
            'fertilizer_detail' => ['dosage_amount' => 5],
        ])->assertCreated();
        $this->assertSame('', $fertilizer->json('data.fertilizer_detail.fertilizer_type'));
        $this->assertSame('kg/ha', $fertilizer->json('data.fertilizer_detail.dosage_unit'));
        $this->assertSame('Tersedia', $fertilizer->json('data.fertilizer_detail.availability_status'));

        $harvest = $this->actingAs($petugas)->postJson('/api/reports', [
            'report_type' => 'harvest',
            'action' => 'draft',
            'district_id' => $district->id,
            'harvest_detail' => ['harvest_volume' => 100],
        ])->assertCreated();
        $this->assertSame('', $harvest->json('data.harvest_detail.commodity'));
        $this->assertSame('ton', $harvest->json('data.harvest_detail.volume_unit'));

        $weather = $this->actingAs($petugas)->postJson('/api/reports', [
            'report_type' => 'weather',
            'action' => 'draft',
            'district_id' => $district->id,
            'weather_detail' => ['rainfall_mm' => 20],
        ])->assertCreated();
        $this->assertSame('', $weather->json('data.weather_detail.weather_condition'));

        $equipment = $this->actingAs($petugas)->postJson('/api/reports', [
            'report_type' => 'equipment',
            'action' => 'draft',
            'district_id' => $district->id,
            'equipment_detail' => ['unit_count' => 2],
        ])->assertCreated();
        $this->assertSame('', $equipment->json('data.equipment_detail.equipment_category'));
        $this->assertSame('', $equipment->json('data.equipment_detail.equipment_name'));
        $this->assertSame('Baik', $equipment->json('data.equipment_detail.condition_status'));
    }
}
