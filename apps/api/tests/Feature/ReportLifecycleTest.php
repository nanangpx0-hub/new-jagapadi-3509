<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\District;
use App\Models\Opt;
use App\Models\User;
use App\Models\Village;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class ReportLifecycleTest extends TestCase
{
    use DatabaseTransactions;

    public function test_petugas_can_create_pest_draft_and_submit(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::where('code', '3509010')->firstOrFail(); // Ajung
        $village = Village::where('district_id', $district->id)->firstOrFail();
        $opt = Opt::firstOrFail();

        // 1. Buat Draf
        $draftResponse = $this->actingAs($petugas)
            ->postJson('/api/reports', [
                'report_type' => 'pest',
                'action' => 'draft',
                'report_date' => '2026-11-04',
                'district_id' => $district->id,
                'village_id' => $village->id,
                'location_name' => 'Blok Sawah Timur',
                'latitude' => -8.2180000,
                'longitude' => 113.6420000,
                'pest_detail' => [
                    'opt_id' => $opt->id,
                    'crop_type' => 'padi',
                    'crop_age_days' => 45,
                    'crop_phase' => 'vegetatif',
                    'intensity_level' => 'Sedang',
                    'affected_area_ha' => 1.5,
                ],
            ]);

        $draftResponse
            ->assertStatus(201)
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('data.status', 'Draf')
            ->assertJsonPath('data.report_number', null);

        $reportId = $draftResponse->json('data.id');

        // 2. Submit Draf menjadi Submitted
        $submitResponse = $this->actingAs($petugas)
            ->postJson("/api/reports/{$reportId}/submit");

        $submitResponse
            ->assertStatus(200)
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('data.status', 'Submitted');

        $reportNumber = $submitResponse->json('data.report_number');
        $this->assertNotNull($reportNumber);
        $this->assertStringStartsWith('LH-', $reportNumber);
    }

    public function test_verifikator_can_verify_and_reject_report(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $statistisi = User::where('email', 'statistisi@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $opt = Opt::firstOrFail();

        // Buat laporan langsung submit
        $createResponse = $this->actingAs($petugas)
            ->postJson('/api/reports', [
                'report_type' => 'pest',
                'action' => 'submit',
                'report_date' => '2026-11-04',
                'district_id' => $district->id,
                'latitude' => -8.2180000,
                'longitude' => 113.6420000,
                'pest_detail' => [
                    'opt_id' => $opt->id,
                    'intensity_level' => 'Berat',
                    'affected_area_ha' => 2.0,
                ],
            ]);

        $createResponse->assertStatus(201);
        $reportId = $createResponse->json('data.id');

        // Petugas mencoba memverifikasi laporannya sendiri -> harus 403 Forbidden
        $forbiddenResponse = $this->actingAs($petugas)
            ->postJson("/api/reports/{$reportId}/verify");
        $forbiddenResponse->assertStatus(403);

        // Statistisi memverifikasi laporan -> 200 OK
        $verifyResponse = $this->actingAs($statistisi)
            ->postJson("/api/reports/{$reportId}/verify", [
                'notes' => 'Data serangan terkonfirmasi sesuai sampel lapangan.',
            ]);

        $verifyResponse
            ->assertStatus(200)
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('data.status', 'Diverifikasi');
    }

    public function test_verifikator_can_reject_report_with_mandatory_reason(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $operator = User::where('email', 'operator@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $opt = Opt::firstOrFail();

        $createResponse = $this->actingAs($petugas)
            ->postJson('/api/reports', [
                'report_type' => 'pest',
                'action' => 'submit',
                'district_id' => $district->id,
                'pest_detail' => [
                    'opt_id' => $opt->id,
                    'intensity_level' => 'Ringan',
                    'affected_area_ha' => 0.5,
                ],
            ]);

        $reportId = $createResponse->json('data.id');

        // Reject tanpa alasan -> 422
        $invalidReject = $this->actingAs($operator)
            ->postJson("/api/reports/{$reportId}/reject", ['reason' => '']);
        $invalidReject->assertStatus(422);

        // Reject dengan alasan valid -> 200
        $validReject = $this->actingAs($operator)
            ->postJson("/api/reports/{$reportId}/reject", [
                'reason' => 'Foto bukti tidak jelas, mohon ambil ulang foto malai.',
            ]);

        $validReject
            ->assertStatus(200)
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('data.status', 'Ditolak');
    }

    public function test_petugas_can_create_irrigation_report(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();

        $response = $this->actingAs($petugas)
            ->postJson('/api/reports', [
                'report_type' => 'irrigation',
                'action' => 'submit',
                'report_date' => '2026-11-04',
                'district_id' => $district->id,
                'latitude' => -8.2180000,
                'longitude' => 113.6420000,
                'irrigation_detail' => [
                    'irrigation_area_name' => 'DI Bedadung',
                    'channel_type' => 'Sekunder',
                    'physical_condition' => 'Rusak',
                    'water_discharge_status' => 'Kurang',
                    'service_area_ha' => 120.5,
                    'repair_status' => 'Belum Ditangani',
                ],
            ]);

        $response
            ->assertStatus(201)
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('data.status', 'Submitted');

        $reportNumber = $response->json('data.report_number');
        $this->assertStringStartsWith('LI-', $reportNumber);
    }
}
