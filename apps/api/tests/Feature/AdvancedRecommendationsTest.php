<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\District;
use App\Models\KsaMonthly;
use App\Models\Opt;
use App\Models\OptProposal;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class AdvancedRecommendationsTest extends TestCase
{
    use DatabaseTransactions;

    public function test_audit_log_hanya_untuk_pemegang_permission(): void
    {
        $admin = User::where('email', 'admin@jagapadi.test')->firstOrFail();
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();

        $this->actingAs($petugas)->getJson('/api/audit-logs')->assertForbidden();
        $this->actingAs($admin)->getJson('/api/audit-logs')
            ->assertOk()
            ->assertJsonPath('status', 'ok');
    }

    public function test_notifikasi_otomatis_siklus_laporan_dan_endpoint(): void
    {
        Storage::fake('public');
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $admin = User::where('email', 'admin@jagapadi.test')->firstOrFail();
        $operator = User::where('email', 'operator@jagapadi.test')->firstOrFail();
        $opt = Opt::firstOrFail();

        $payload = [
            'report_type' => 'pest',
            'action' => 'submit',
            'report_date' => '2026-11-04',
            'district_id' => District::firstOrFail()->id,
            'pest_detail' => [
                'opt_id' => $opt->id,
                'intensity_level' => 'Berat',
                'affected_area_ha' => 2.0,
            ],
            'photos' => [UploadedFile::fake()->image('bukti.jpg', 800, 600)],
        ];

        $created = $this->actingAs($petugas)->post('/api/reports', $payload)->assertCreated();
        $reportId = (int) $created->json('data.id');

        // Submit → notifikasi ke operator & statistisi.
        $this->assertTrue(AppNotification::where('user_id', $operator->id)
            ->where('type', 'report_submitted')->exists());
        $this->assertStringContainsString(
            'Menunggu Verifikasi',
            (string) AppNotification::where('user_id', $operator->id)->where('type', 'report_submitted')->value('title')
        );

        // Verify → notifikasi ke pelapor.
        $this->actingAs($admin)->postJson('/api/reports/'.$reportId.'/verify', [
            'notes' => 'Data valid.',
        ])->assertOk();
        $this->assertTrue(AppNotification::where('user_id', $petugas->id)
            ->where('type', 'report_verified')->exists());

        // Endpoint notifikasi & read-all.
        $list = $this->actingAs($petugas)->getJson('/api/notifications')->assertOk();
        $this->assertGreaterThanOrEqual(1, (int) $list->json('unread_count'));
        $this->actingAs($petugas)->postJson('/api/notifications/read-all')->assertOk();
        $this->assertSame(0, (int) $this->actingAs($petugas)->getJson('/api/notifications')->json('unread_count'));

        // Reject → notifikasi ke pelapor (laporan baru karena yang lama sudah diverifikasi).
        $created2 = $this->actingAs($petugas)->post('/api/reports', $payload)->assertCreated();
        $reportId2 = (int) $created2->json('data.id');
        $this->actingAs($admin)->postJson('/api/reports/'.$reportId2.'/reject', [
            'reason' => 'Foto kurang jelas, mohon diunggah ulang.',
        ])->assertOk();
        $this->assertTrue(AppNotification::where('user_id', $petugas->id)
            ->where('type', 'report_rejected')->exists());
    }

    public function test_usulan_opt_dibuat_petugas_dan_disetujui_operator(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();
        $operator = User::where('email', 'operator@jagapadi.test')->firstOrFail();

        $proposalResponse = $this->actingAs($petugas)->postJson('/api/opt-proposals', [
            'name' => 'Kutu Beras Lapangan Uji',
            'scientific_name' => 'Sitophilus oryzae',
            'category' => 'hama',
            'target_crop' => 'padi',
        ])->assertCreated()->assertJsonPath('data.status', 'Menunggu');

        $proposalId = (int) $proposalResponse->json('data.id');

        $before = Opt::count();
        $this->actingAs($operator)->postJson('/api/opt-proposals/'.$proposalId.'/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'Disetujui');

        $this->assertSame($before + 1, Opt::count());
        $proposal = OptProposal::findOrFail($proposalId);
        $this->assertNotNull($proposal->created_opt_id);
        $this->assertSame('OPT-U'.str_pad((string) $proposalId, 3, '0', STR_PAD_LEFT), $proposal->createdOpt->code);
    }

    public function test_summary_memiliki_agregat_dan_anomali_ksa(): void
    {
        $this->assertGreaterThan(0, KsaMonthly::count());

        $admin = User::where('email', 'admin@jagapadi.test')->firstOrFail();
        $response = $this->actingAs($admin)
            ->getJson('/api/phenomena/summary?year=2026')
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $this->assertArrayHasKey('ksa_harvest_ha', $response->json('data.matrix.0'));
        $this->assertArrayHasKey('ksa_puso_ha', $response->json('data.matrix.0'));
        $this->assertArrayHasKey('ksa_anomalies', $response->json('data'));
        $this->assertGreaterThan(0, count($response->json('data.ksa_anomalies')));
        $this->assertGreaterThan(0, (float) $response->json('data.ksa_anomalies.0.ksa_puso_ha'));
    }
}
