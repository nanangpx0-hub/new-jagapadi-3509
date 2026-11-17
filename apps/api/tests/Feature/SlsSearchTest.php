<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\District;
use App\Models\Sls;
use App\Models\Village;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class SlsSearchTest extends TestCase
{
    use DatabaseTransactions;

    public function test_search_menerima_variasi_penulisan_rt_rw(): void
    {
        $district = District::firstOrFail();
        $village = Village::where('district_id', $district->id)->firstOrFail();

        $sls = Sls::create([
            'district_id' => $district->id,
            'village_id' => $village->id,
            'idsls' => 'TEST-SLS-001',
            'code' => '9001',
            'name' => 'RT 001 RW 002 DUSUN Uji',
        ]);

        foreach (['RT 01', 'RT01', 'rt 1', 'RW 2', 'RW 02', 'DUSUN Uji'] as $query) {
            $this->getJson('/api/villages/'.$village->id.'/sls?search='.urlencode($query))
                ->assertOk()
                ->assertJsonFragment(['id' => $sls->id]);
        }
    }

    public function test_search_angka_murni_menampilkan_rt_rw_yang_dimaksud_saja(): void
    {
        $district = District::firstOrFail();
        $village = Village::where('district_id', $district->id)->firstOrFail();

        $cocok = Sls::create([
            'district_id' => $district->id,
            'village_id' => $village->id,
            'idsls' => 'TEST-SLS-RT001',
            'code' => '9101',
            'name' => 'RT 001 RW 002 DUSUN Uji',
        ]);
        $tidakCocok = Sls::create([
            'district_id' => $district->id,
            'village_id' => $village->id,
            'idsls' => 'TEST-SLS-RT009',
            'code' => '9109',
            'name' => 'RT 009 RW 008 DUSUN Uji',
        ]);

        foreach (['001', '01', '1'] as $query) {
            $this->getJson('/api/villages/'.$village->id.'/sls?search='.urlencode($query))
                ->assertOk()
                ->assertJsonFragment(['id' => $cocok->id])
                ->assertJsonMissing(['id' => $tidakCocok->id]);
        }
    }
}
