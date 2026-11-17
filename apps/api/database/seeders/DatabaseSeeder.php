<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database for JAGAPADI v3.
     */
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            UserSeeder::class,
            DistrictVillageSeeder::class,
            OptSeeder::class,
            KsaMonthlySeeder::class,
        ]);
    }
}
