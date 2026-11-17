<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class AuditLogTest extends TestCase
{
    use DatabaseTransactions;

    public function test_audit_log_mencatat_login_dan_dapat_dilihat_admin(): void
    {
        $admin = User::where('email', 'admin@jagapadi.test')->firstOrFail();

        $this->actingAs($admin)->postJson('/api/auth/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])->assertOk();

        $response = $this->actingAs($admin)
            ->getJson('/api/audit-logs?log_name=auth')
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $this->assertNotEmpty($response->json('data'));
        $this->assertSame('login', $response->json('data.0.event'));
        $this->assertIsArray($response->json('data.0.causer'));
    }

    public function test_petugas_tidak_dapat_melihat_audit_log(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();

        $this->actingAs($petugas)->getJson('/api/audit-logs')->assertForbidden();
    }
}
