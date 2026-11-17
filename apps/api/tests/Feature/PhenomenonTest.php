<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class PhenomenonTest extends TestCase
{
    use DatabaseTransactions;

    public function test_ringkasan_membutuhkan_autentikasi(): void
    {
        $this->getJson('/api/phenomena/summary')->assertUnauthorized();
    }

    public function test_ringkasan_memiliki_cakupan_matriks_dan_narasi(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();

        $response = $this->actingAs($petugas)
            ->getJson('/api/phenomena/summary?year=2026&subround=3')
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $data = $response->json('data');
        $this->assertSame(31, $data['coverage']['total_districts']);
        $this->assertCount(31, $data['matrix']);
        $this->assertSame(31, $data['coverage']['reporting_districts'] + count($data['coverage']['blank_spot_districts']));
        $this->assertStringContainsString('Subround III', $data['period_label']);
        $this->assertNotEmpty($data['narratives']);
        $this->assertStringContainsString('Kabupaten Jember', end($data['narratives'])['narrative']);
    }

    public function test_ekspor_csv_memiliki_bom_dan_kolom_bps(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();

        $response = $this->actingAs($petugas)
            ->get('/api/phenomena/export?year=2026')
            ->assertOk();

        $this->assertStringStartsWith('text/csv', (string) $response->headers->get('Content-Type'));
        $content = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $content);
        $this->assertStringContainsString('Kode Kecamatan', $content);
        $this->assertStringContainsString('Segmen KSA', $content);
        $this->assertStringContainsString('Dampak Statistik', $content);
        $this->assertStringContainsString('Narasi', $content);
    }
}
