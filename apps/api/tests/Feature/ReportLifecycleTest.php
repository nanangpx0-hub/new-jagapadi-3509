<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\District;
use App\Models\Opt;
use App\Models\Report;
use App\Models\User;
use App\Models\Village;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

final class ReportLifecycleTest extends TestCase
{
    use DatabaseTransactions;

    /**
     * Membuat draft Hama lengkap, mengunggah 1 foto, lalu submit.
     */
    private function createSubmittedPestReport(User $petugas, District $district, ?Village $village, Opt $opt): int
    {
        Storage::fake('public');

        $draftResponse = $this->actingAs($petugas)
            ->postJson('/api/reports', [
                'report_type' => 'pest',
                'action' => 'draft',
                'report_date' => '2026-11-04',
                'district_id' => $district->id,
                'village_id' => $village?->id,
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

        $draftResponse->assertStatus(201);
        $reportId = $draftResponse->json('data.id');

        $photoResponse = $this->actingAs($petugas)
            ->post("/api/reports/{$reportId}/photos", [
                'photo' => UploadedFile::fake()->image('lahan.jpg', 1600, 1200),
                'caption' => 'Kondisi lahan terserang',
            ]);

        $photoResponse->assertStatus(201);
        $this->uploadPhotoAssertWebp($photoResponse);

        $submitResponse = $this->actingAs($petugas)
            ->postJson("/api/reports/{$reportId}/submit");

        $submitResponse->assertStatus(200);

        return (int) $reportId;
    }

    private function uploadPhotoAssertWebp(TestResponse $response): void
    {
        $response
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('data.mime_type', 'image/webp');

        $this->assertLessThanOrEqual(1280, $response->json('data.width'));
        Storage::disk('public')->assertExists((string) $response->json('data.file_path'));
    }

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

        // 2. Submit tanpa foto -> 422 (PRD: minimal 1 foto bukti)
        $noPhotoSubmit = $this->actingAs($petugas)
            ->postJson("/api/reports/{$reportId}/submit");
        $noPhotoSubmit->assertStatus(422);

        // 3. Unggah 1 foto (real fake JPEG 1600px -> harus di-re-encode WebP <=1280px)
        $photoResponse = $this->actingAs($petugas)
            ->post("/api/reports/{$reportId}/photos", [
                'photo' => UploadedFile::fake()->image('lahan.jpg', 1600, 1200),
            ]);
        $this->uploadPhotoAssertWebp($photoResponse);

        // 4. Submit Draf menjadi Submitted
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

    public function test_direct_action_submit_requires_photo(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $opt = Opt::firstOrFail();

        $response = $this->actingAs($petugas)
            ->postJson('/api/reports', [
                'report_type' => 'pest',
                'action' => 'submit',
                'district_id' => $district->id,
                'pest_detail' => [
                    'opt_id' => $opt->id,
                    'intensity_level' => 'Sedang',
                    'affected_area_ha' => 1.0,
                ],
            ]);

        $response->assertStatus(422);
    }

    public function test_direct_action_submit_with_photo_succeeds(): void
    {
        Storage::fake('public');

        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $opt = Opt::firstOrFail();

        $response = $this->actingAs($petugas)
            ->post('/api/reports', [
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
                'photos' => [
                    UploadedFile::fake()->image('bukti1.jpg', 800, 600),
                    UploadedFile::fake()->image('bukti2.png', 900, 700),
                ],
            ]);

        $response->assertStatus(201);
        $this->assertSame('Submitted', $response->json('data.status'));
        $this->assertStringStartsWith('LH-', (string) $response->json('data.report_number'));
        $this->assertCount(2, $response->json('data.photos'));
        $this->assertSame('image/webp', $response->json('data.photos.0.mime_type'));
    }

    public function test_max_five_photos_per_report(): void
    {
        Storage::fake('public');

        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $opt = Opt::firstOrFail();

        $draftResponse = $this->actingAs($petugas)
            ->postJson('/api/reports', [
                'report_type' => 'pest',
                'action' => 'draft',
                'district_id' => $district->id,
                'pest_detail' => [
                    'opt_id' => $opt->id,
                    'intensity_level' => 'Ringan',
                    'affected_area_ha' => 0.25,
                ],
            ]);
        $reportId = $draftResponse->json('data.id');

        for ($i = 1; $i <= 5; $i++) {
            $ok = $this->actingAs($petugas)
                ->post("/api/reports/{$reportId}/photos", [
                    'photo' => UploadedFile::fake()->image("foto{$i}.jpg", 640, 480),
                ]);
            $ok->assertStatus(201);
        }

        // Foto ke-6 harus ditolak
        $sixth = $this->actingAs($petugas)
            ->post("/api/reports/{$reportId}/photos", [
                'photo' => UploadedFile::fake()->image('foto6.jpg', 640, 480),
            ]);
        $sixth->assertStatus(422);
    }

    public function test_owner_can_update_own_draft_but_not_after_submit(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $village = Village::where('district_id', $district->id)->firstOrFail();
        $opt = Opt::firstOrFail();

        $draftResponse = $this->actingAs($petugas)
            ->postJson('/api/reports', [
                'report_type' => 'pest',
                'action' => 'draft',
                'district_id' => $district->id,
                'village_id' => $village->id,
                'pest_detail' => [
                    'opt_id' => $opt->id,
                    'intensity_level' => 'Sedang',
                    'affected_area_ha' => 1.0,
                ],
            ]);
        $reportId = $draftResponse->json('data.id');

        // Update catatan draft miliknya -> 200
        $updateResponse = $this->actingAs($petugas)
            ->putJson("/api/reports/{$reportId}", [
                'notes' => 'Diperbaiki setelah cek lapangan.',
                'location_name' => 'Blok Timur 2',
            ]);
        $updateResponse->assertStatus(200);
        $this->assertSame('Diperbaiki setelah cek lapangan.', $updateResponse->json('data.notes'));

        // Unggah foto lalu submit
        Storage::fake('public');
        $this->actingAs($petugas)
            ->post("/api/reports/{$reportId}/photos", [
                'photo' => UploadedFile::fake()->image('bukti.jpg', 800, 600),
            ]);
        $this->actingAs($petugas)->postJson("/api/reports/{$reportId}/submit")->assertStatus(200);

        // Setelah Submitted, edit harus ditolak (422)
        $locked = $this->actingAs($petugas)
            ->putJson("/api/reports/{$reportId}", [
                'notes' => 'Mencoba mengubah setelah submit.',
            ]);
        $locked->assertStatus(422);
    }

    public function test_petugas_cannot_edit_others_report(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $admin = User::where('email', 'admin@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $opt = Opt::firstOrFail();

        // Admin membuat draft sendiri
        $draftResponse = $this->actingAs($admin)
            ->postJson('/api/reports', [
                'report_type' => 'pest',
                'action' => 'draft',
                'district_id' => $district->id,
                'pest_detail' => [
                    'opt_id' => $opt->id,
                    'intensity_level' => 'Ringan',
                    'affected_area_ha' => 0.5,
                ],
            ]);
        $reportId = $draftResponse->json('data.id');

        // Petugas mencoba mengedit laporan admin -> 403
        $forbidden = $this->actingAs($petugas)
            ->putJson("/api/reports/{$reportId}", [
                'notes' => 'Petugas mencoba mengedit.',
            ]);
        $forbidden->assertStatus(403);
    }

    public function test_delete_rules_for_petugas_and_admin(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $admin = User::where('email', 'admin@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $opt = Opt::firstOrFail();

        $draftResponse = $this->actingAs($petugas)
            ->postJson('/api/reports', [
                'report_type' => 'pest',
                'action' => 'draft',
                'district_id' => $district->id,
                'pest_detail' => [
                    'opt_id' => $opt->id,
                    'intensity_level' => 'Ringan',
                    'affected_area_ha' => 0.5,
                ],
            ]);
        $reportId = $draftResponse->json('data.id');

        // Petugas menghapus draf miliknya -> 200
        $deleteOwn = $this->actingAs($petugas)->deleteJson("/api/reports/{$reportId}");
        $deleteOwn->assertStatus(200);

        // Laporan baru (draft) -> submit -> petugas tidak boleh hapus; admin boleh
        $draftResponse2 = $this->actingAs($petugas)
            ->postJson('/api/reports', [
                'report_type' => 'pest',
                'action' => 'draft',
                'district_id' => $district->id,
                'pest_detail' => [
                    'opt_id' => $opt->id,
                    'intensity_level' => 'Sedang',
                    'affected_area_ha' => 1.0,
                ],
            ]);
        $reportId2 = $draftResponse2->json('data.id');

        Storage::fake('public');
        $this->actingAs($petugas)->post("/api/reports/{$reportId2}/photos", [
            'photo' => UploadedFile::fake()->image('b.jpg', 640, 480),
        ]);
        $this->actingAs($petugas)->postJson("/api/reports/{$reportId2}/submit")->assertStatus(200);

        $deleteSubmitted = $this->actingAs($petugas)->deleteJson("/api/reports/{$reportId2}");
        $deleteSubmitted->assertStatus(422);

        $adminDelete = $this->actingAs($admin)->deleteJson("/api/reports/{$reportId2}");
        $adminDelete->assertStatus(200);
    }

    public function test_verifikator_can_verify_and_reject_report(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $statistisi = User::where('email', 'statistisi@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $village = Village::where('district_id', $district->id)->firstOrFail();
        $opt = Opt::firstOrFail();

        $reportId = $this->createSubmittedPestReport($petugas, $district, $village, $opt);

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

    public function test_operator_can_archive_verified_report(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $statistisi = User::where('email', 'statistisi@jagapadi.test')->firstOrFail();
        $operator = User::where('email', 'operator@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $village = Village::where('district_id', $district->id)->firstOrFail();
        $opt = Opt::firstOrFail();

        $reportId = $this->createSubmittedPestReport($petugas, $district, $village, $opt);

        $this->actingAs($statistisi)
            ->postJson("/api/reports/{$reportId}/verify", ['notes' => 'OK.'])
            ->assertStatus(200);

        // Petugas tidak boleh mengarsipkan -> 403
        $petugasArchive = $this->actingAs($petugas)
            ->postJson("/api/reports/{$reportId}/archive");
        $petugasArchive->assertStatus(403);

        // Operator boleh mengarsipkan -> 200 Diarsipkan
        $archiveResponse = $this->actingAs($operator)
            ->postJson("/api/reports/{$reportId}/archive");

        $archiveResponse
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'Diarsipkan');
    }

    public function test_verifikator_can_reject_report_with_mandatory_reason(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $operator = User::where('email', 'operator@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $village = Village::where('district_id', $district->id)->firstOrFail();
        $opt = Opt::firstOrFail();

        $reportId = $this->createSubmittedPestReport($petugas, $district, $village, $opt);

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

    public function test_client_uuid_idempotency_returns_same_report(): void
    {
        Storage::fake('public');

        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $opt = Opt::firstOrFail();

        $clientUuid = (string) Str::uuid();
        $body = [
            'client_uuid' => $clientUuid,
            'report_type' => 'pest',
            'action' => 'submit',
            'district_id' => $district->id,
            'pest_detail' => [
                'opt_id' => $opt->id,
                'intensity_level' => 'Sedang',
                'affected_area_ha' => 1.0,
            ],
            'photos' => [UploadedFile::fake()->image('bukti.jpg', 800, 600)],
        ];

        $first = $this->actingAs($petugas)->post('/api/reports', $body);
        $first->assertStatus(201);
        $firstId = $first->json('data.id');

        // Retry dengan client_uuid yang sama -> 200, laporan yang sama (bukan duplikat)
        $retry = $this->actingAs($petugas)->post('/api/reports', $body);
        $retry->assertStatus(200);
        $this->assertSame($firstId, $retry->json('data.id'));

        // Jumlah laporan dengan client_uuid ini tetap 1
        $this->assertSame(1, Report::where('client_uuid', $clientUuid)->count());
    }

    public function test_offline_payload_field_is_accepted(): void
    {
        Storage::fake('public');

        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $opt = Opt::firstOrFail();

        $form = [
            'report_type' => 'pest',
            'action' => 'submit',
            'report_date' => '2026-11-05',
            'district_id' => $district->id,
            'latitude' => -8.2180000,
            'longitude' => 113.6420000,
            'pest_detail' => [
                'opt_id' => $opt->id,
                'intensity_level' => 'Sedang',
                'affected_area_ha' => 1.0,
            ],
        ];

        $response = $this->actingAs($petugas)->post('/api/reports', [
            'client_uuid' => (string) Str::uuid(),
            'payload' => json_encode($form),
            'photos' => [UploadedFile::fake()->image('p.jpg', 800, 600)],
        ]);

        $response->assertStatus(201);
        $this->assertSame('Submitted', $response->json('data.status'));
        $this->assertStringStartsWith('LH-', (string) $response->json('data.report_number'));
    }

    public function test_petugas_can_create_irrigation_report(): void
    {
        Storage::fake('public');

        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();

        $response = $this->actingAs($petugas)
            ->post('/api/reports', [
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
                'photos' => [
                    UploadedFile::fake()->image('saluran.jpg', 1024, 768),
                ],
            ]);

        $response
            ->assertStatus(201)
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('data.status', 'Submitted');

        $reportNumber = $response->json('data.report_number');
        $this->assertStringStartsWith('LI-', (string) $reportNumber);
    }
}
