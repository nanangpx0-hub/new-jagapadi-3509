<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $defaultPassword = Hash::make('password');

        $users = [
            [
                'name' => 'Super Administrator BPS 3509',
                'email' => 'superadmin@jagapadi.test',
                'phone' => '081234567800',
                'nip' => '198001012005011000',
                'role' => 'superadmin',
            ],
            [
                'name' => 'Administrator Jember',
                'email' => 'admin@jagapadi.test',
                'phone' => '081234567890',
                'nip' => '198501012010011001',
                'role' => 'admin',
            ],
            [
                'name' => 'Operator Data Pertanian',
                'email' => 'operator@jagapadi.test',
                'phone' => '081234567891',
                'nip' => '198702022012021002',
                'role' => 'operator',
            ],
            [
                'name' => 'Statistisi Ahli Pertama',
                'email' => 'statistisi@jagapadi.test',
                'phone' => '081234567892',
                'nip' => '199003032014031003',
                'role' => 'statistisi',
            ],
            [
                'name' => 'Petugas Lapangan (POPT)',
                'email' => 'petugas@jagapadi.test',
                'phone' => '081234567893',
                'nip' => '199204042016041004',
                'role' => 'petugas',
            ],
            [
                'name' => 'Pimpinan Dinas / Eksekutif',
                'email' => 'viewer@jagapadi.test',
                'phone' => '081234567894',
                'nip' => '197505051998031005',
                'role' => 'viewer',
            ],
        ];

        foreach ($users as $data) {
            $role = $data['role'];
            unset($data['role']);

            $user = User::updateOrCreate(
                ['email' => $data['email']],
                array_merge($data, [
                    'password' => $defaultPassword,
                    'is_active' => true,
                    'must_change_password' => false,
                ])
            );

            $user->syncRoles([$role]);
        }
    }
}
