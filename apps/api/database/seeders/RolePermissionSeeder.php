<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Daftar Permission sesuai docs/PRD.md §3.2
        $permissions = [
            'users.manage',
            'audit.view',
            'regions.view',
            'regions.manage',
            'opts.view',
            'opts.manage',
            'opt-proposals.create',
            'opt-proposals.review',
            'reports.create',
            'reports.view',
            'reports.update',
            'reports.submit',
            'reports.verify',
            'reports.archive',
            'reports.delete',
            'dashboard.view',
            'reference-data.view',
            'reference-data.manage',
            'exports.generate',
        ];

        foreach ($permissions as $permissionName) {
            Permission::firstOrCreate(['name' => $permissionName, 'guard_name' => 'web']);
        }

        // Definisi 5 Role & Matriks Permission
        $rolePermissions = [
            'admin' => $permissions, // Admin memiliki semua permission
            'operator' => [
                'regions.view',
                'opts.view',
                'opts.manage',
                'opt-proposals.create',
                'opt-proposals.review',
                'reports.create',
                'reports.view',
                'reports.submit',
                'reports.verify',
                'reports.archive',
                'dashboard.view',
                'reference-data.view',
                'reference-data.manage',
                'exports.generate',
            ],
            'statistisi' => [
                'regions.view',
                'opts.view',
                'reports.view',
                'reports.verify',
                'dashboard.view',
                'reference-data.view',
                'reference-data.manage',
                'exports.generate',
            ],
            'petugas' => [
                'regions.view',
                'opts.view',
                'opt-proposals.create',
                'reports.create',
                'reports.view',
                'reports.update',
                'reports.submit',
                'reports.delete',
                'dashboard.view',
                'reference-data.view',
                'exports.generate',
            ],
            'viewer' => [
                'regions.view',
                'opts.view',
                'reports.view',
                'dashboard.view',
                'reference-data.view',
                'exports.generate',
            ],
        ];

        foreach ($rolePermissions as $roleName => $perms) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            $role->syncPermissions($perms);
        }
    }
}
