<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class UserManagementTest extends TestCase
{
    use DatabaseTransactions;

    public function test_admin_can_list_users(): void
    {
        $admin = User::where('email', 'admin@jagapadi.test')->firstOrFail();

        $response = $this->actingAs($admin)->getJson('/api/users');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'ok')
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'total']]);
    }

    public function test_non_admin_cannot_list_users(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();

        $this->actingAs($petugas)->getJson('/api/users')->assertStatus(403);
    }

    public function test_admin_can_create_and_deactivate_user(): void
    {
        $admin = User::where('email', 'admin@jagapadi.test')->firstOrFail();
        $email = 'dummy.'.uniqid().'@jagapadi.test';

        $create = $this->actingAs($admin)->postJson('/api/users', [
            'name' => 'Petugas Uji Coba',
            'email' => $email,
            'password' => 'rahasia123',
            'role' => 'petugas',
            'nip' => '199001012024011001',
        ]);

        $create->assertStatus(201)->assertJsonPath('data.email', $email);
        $userId = $create->json('data.id');

        // Nonaktifkan -> login harus ditolak 403
        $this->actingAs($admin)->patchJson("/api/users/{$userId}/toggle-active")->assertStatus(200);

        $login = $this->postJson('/api/auth/login', [
            'email' => $email,
            'password' => 'rahasia123',
        ]);
        $login->assertStatus(403);

        // Aktifkan kembali
        $this->actingAs($admin)->patchJson("/api/users/{$userId}/toggle-active")->assertStatus(200);
    }

    public function test_admin_cannot_delete_own_account(): void
    {
        $admin = User::where('email', 'admin@jagapadi.test')->firstOrFail();

        $this->actingAs($admin)->deleteJson("/api/users/{$admin->id}")->assertStatus(422);
    }
}
