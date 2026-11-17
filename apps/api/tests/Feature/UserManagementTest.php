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

    public function test_admin_biasa_tidak_bisa_membuat_atau_mengubah_superadmin_tetapi_superadmin_bisa(): void
    {
        $admin = User::where('email', 'admin@jagapadi.test')->firstOrFail();
        $superadmin = User::where('email', 'superadmin@jagapadi.test')->firstOrFail();
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();

        // Admin biasa tidak bisa membuat akun superadmin
        $this->actingAs($admin)->postJson('/api/users', [
            'name' => 'Calon Superadmin',
            'email' => 'illegal.sa.'.uniqid().'@jagapadi.test',
            'password' => 'rahasia123',
            'role' => 'superadmin',
        ])->assertStatus(403);

        // Admin biasa tidak bisa memodifikasi/menonaktifkan/reset/hapus akun superadmin
        $this->actingAs($admin)->putJson("/api/users/{$superadmin->id}", ['name' => 'Diubah Admin'])->assertStatus(403);
        $this->actingAs($admin)->patchJson("/api/users/{$superadmin->id}/toggle-active")->assertStatus(403);
        $this->actingAs($admin)->postJson("/api/users/{$superadmin->id}/reset-password")->assertStatus(403);
        $this->actingAs($admin)->deleteJson("/api/users/{$superadmin->id}")->assertStatus(403);

        // Admin biasa tidak bisa mempromosikan akun lain menjadi superadmin
        $this->actingAs($admin)->putJson("/api/users/{$petugas->id}", ['role' => 'superadmin'])->assertStatus(403);

        // Superadmin dapat membuat, mengubah, menonaktifkan, dan menghapus sesama akun superadmin baru
        $email = 'sa.'.uniqid().'@jagapadi.test';
        $created = $this->actingAs($superadmin)->postJson('/api/users', [
            'name' => 'Superadmin Baru',
            'email' => $email,
            'password' => 'rahasia123',
            'role' => 'superadmin',
        ])->assertStatus(201);

        $createdId = (int) $created->json('data.id');
        $this->actingAs($superadmin)->putJson("/api/users/{$createdId}", ['name' => 'Superadmin Diperbarui'])->assertStatus(200);
        $this->actingAs($superadmin)->patchJson("/api/users/{$createdId}/toggle-active")->assertStatus(200);
        $this->actingAs($superadmin)->deleteJson("/api/users/{$createdId}")->assertStatus(200);

        $this->assertTrue($superadmin->can('system.manage'));
        $this->assertFalse($admin->can('system.manage'));
    }
}
