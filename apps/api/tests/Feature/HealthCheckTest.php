<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

final class HealthCheckTest extends TestCase
{
    public function test_health_endpoint_returns_ok_for_all_infrastructure_services(): void
    {
        $response = $this->getJson('/api/health');

        $driver = (string) config('database.default');

        $response
            ->assertStatus(200)
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('service', 'jagapadi-v3-api')
            ->assertJsonPath('checks.database.status', 'ok')
            ->assertJsonPath('checks.database.driver', $driver)
            ->assertJsonPath('checks.postgis.status', 'ok')
            ->assertJsonPath('checks.redis.status', 'ok')
            ->assertJsonPath('checks.storage.status', 'ok')
            ->assertJsonPath('checks.storage.writable', true);

        if ($driver === 'pgsql') {
            $response->assertJsonPath('checks.database.driver', 'pgsql');
        }
    }
}
