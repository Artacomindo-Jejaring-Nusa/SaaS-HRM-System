<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            'Karyawan',
            'HRD',
            'Management',
            'Manager',
            'Direktur',
            'Supervisor',
            'Supervisor Finance',
            'Supervisor IT',
            'Supervisor Admin',
            'Supervisor Sales',
            'Supervisor NOC',
            'Supervisor Operational',
            'Super Admin',
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(['name' => $role]);
        }
    }
}
