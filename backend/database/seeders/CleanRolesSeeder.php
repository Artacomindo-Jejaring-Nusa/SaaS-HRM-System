<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class CleanRolesSeeder extends Seeder
{
    public function run(): void
    {
        $map = [
            'CEO / BOC' => 'CEO / Direktur Utama',
            'COO' => 'Direktur',
            'Anggota Direksi' => 'Direktur',
            'Kadiv Direktur' => 'Direktur',
            'Admin VP' => 'Manager',
            'Leader' => 'Supervisor',
            'Staff' => 'Staff Karyawan',
            'Clerk' => 'Staff Karyawan',
            'OB' => 'Staff Karyawan',
        ];

        foreach ($map as $oldName => $newName) {
            $oldRole = Role::where('name', $oldName)->first();
            $newRole = Role::where('name', $newName)->first();

            if ($oldRole && $newRole) {
                User::where('role_id', $oldRole->id)->update(['role_id' => $newRole->id]);
                $oldRole->permissions()->detach();
                $oldRole->delete();
            }
        }
    }
}
