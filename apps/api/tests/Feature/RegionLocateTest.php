<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class RegionLocateTest extends TestCase
{
    use DatabaseTransactions;

    public function test_locate_mengembalikan_kecamatan_desa_dan_sls_terdekat(): void
    {
        $this->getJson('/api/regions/locate?latitude=-8.3074&longitude=113.3304')
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('data.district.code', '3509010')
            ->assertJsonPath('data.village.code', '3509010001')
            ->assertJsonPath('data.sls.idsls', '35090100010001');
    }

    public function test_locate_memvalidasi_koordinat(): void
    {
        $this->getJson('/api/regions/locate')->assertUnprocessable();
        $this->getJson('/api/regions/locate?latitude=200&longitude=0')->assertUnprocessable();
    }
}
