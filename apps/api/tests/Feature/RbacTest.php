<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class RbacTest extends TestCase
{
    use DatabaseTransactions;

    public function test_petugas_cannot_create_opt(): void
    {
        $petugas = User::where('email', 'petugas@jagapadi.test')->firstOrFail();

        $response = $this->actingAs($petugas)
            ->postJson('/api/opts', [
                'code' => 'OPT-TEST-'.uniqid(),
                'name' => 'Hama Uji Coba',
                'category' => 'hama',
            ]);

        $response->assertStatus(403);
    }

    public function test_operator_can_create_opt(): void
    {
        $operator = User::where('email', 'operator@jagapadi.test')->firstOrFail();
        $code = 'OPT-OP-'.uniqid();

        $response = $this->actingAs($operator)
            ->postJson('/api/opts', [
                'code' => $code,
                'name' => 'Hama Tambahan Operator',
                'category' => 'hama',
                'danger_level' => 'Sedang',
            ]);

        $response
            ->assertStatus(201)
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('data.code', $code);
    }

    public function test_public_can_view_districts_and_villages(): void
    {
        $response = $this->getJson('/api/districts');

        $response
            ->assertStatus(200)
            ->assertJsonPath('status', 'ok')
            ->assertJsonCount(31, 'data');
    }
}
