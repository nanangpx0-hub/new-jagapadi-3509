<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\District;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class BpsContextTest extends TestCase
{
    use DatabaseTransactions;

    public function test_draf_menyimpan_konteks_bps_dan_subround_triwulan(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();

        $response = $this->actingAs($petugas)->postJson('/api/reports', [
            'report_type' => 'pest',
            'action' => 'draft',
            'report_date' => '2026-02-15',
            'district_id' => $district->id,
            'commodity' => 'edamame',
            'ksa_segment_code' => '350901001-A1',
            'ksa_phase' => 'Vegetatif 1',
            'statistical_impacts' => ['luas_panen', 'harga_petani'],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.commodity', 'edamame')
            ->assertJsonPath('data.ksa_segment_code', '350901001-A1')
            ->assertJsonPath('data.ksa_phase', 'Vegetatif 1')
            ->assertJsonPath('data.statistical_impacts.0', 'luas_panen')
            ->assertJsonPath('data.subround', 1)
            ->assertJsonPath('data.quarter', 1);
    }

    public function test_filter_periode_dan_dampak_statistik(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();

        $this->actingAs($petugas)->postJson('/api/reports', [
            'report_type' => 'pest',
            'action' => 'draft',
            'report_date' => '2026-02-15',
            'district_id' => $district->id,
            'commodity' => 'tembakau',
            'statistical_impacts' => ['alih_fungsi_lahan'],
        ])->assertCreated();

        $this->actingAs($petugas)
            ->getJson('/api/reports?year=2026&month=2&subround=1&quarter=1&commodity=tembakau&statistical_impact=alih_fungsi_lahan')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }
}
