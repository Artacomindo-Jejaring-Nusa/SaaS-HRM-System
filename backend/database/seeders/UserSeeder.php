<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Create a default company for these users (Use ID 1 for consistency)
        $company = Company::firstOrCreate(
            ['id' => 1],
            ['name' => 'Narwasthu Artha Tama', 'email' => 'admin@maincompany.com']
        );

        $superAdminRole = Role::where('name', 'Super Admin')->first();
        $direkturRole = Role::where('name', 'Direktur')->first();
        $managerRole = Role::where('name', 'Manager')->first();
        $supervisorRole = Role::where('name', 'Supervisor')->first();
        $staffRole = Role::where('name', 'Staff Karyawan')->first();

        // 1. Super Admin
        User::updateOrCreate(
            ['email' => 'superadmin@example.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $superAdminRole->id,
                'ktp_no' => '3171234567800001',
                'place_of_birth' => 'Jakarta',
                'date_of_birth' => '1985-05-10',
                'gender' => 'Laki-laki',
                'marital_status' => 'Menikah',
                'religion' => 'Islam',
                'blood_type' => 'O',
            ]
        );

        // 2. Direktur
        $direktur = User::updateOrCreate(
            ['email' => 'direktur@example.com'],
            [
                'name' => 'Direktur Utama',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $direkturRole->id,
                'ktp_no' => '3271234567800002',
                'place_of_birth' => 'Bandung',
                'date_of_birth' => '1975-10-15',
                'gender' => 'Laki-laki',
                'marital_status' => 'Menikah',
                'religion' => 'Kristen',
                'blood_type' => 'A',
            ]
        );

        // 3. Manager
        $manager = User::updateOrCreate(
            ['email' => 'manager@example.com'],
            [
                'name' => 'Manager HR',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $managerRole->id,
                'supervisor_id' => $direktur->id,
                'basic_salary' => 12000000,
                'ptkp_status' => 'K/1',
                'bank_name' => 'BCA',
                'bank_account_no' => '987654321',
                'ktp_no' => '3371234567800003',
                'place_of_birth' => 'Surabaya',
                'date_of_birth' => '1988-02-20',
                'gender' => 'Perempuan',
                'marital_status' => 'Menikah',
                'religion' => 'Katolik',
                'blood_type' => 'B',
            ]
        );

        // 4. Supervisor
        $supervisor = User::updateOrCreate(
            ['email' => 'supervisor@example.com'],
            [
                'name' => 'Supervisor Area',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $supervisorRole->id,
                'supervisor_id' => $manager->id,
                'basic_salary' => 8500000,
                'ptkp_status' => 'TK/1',
                'bank_name' => 'Mandiri',
                'bank_account_no' => '555666777',
                'ktp_no' => '3471234567800004',
                'place_of_birth' => 'Yogyakarta',
                'date_of_birth' => '1992-08-12',
                'gender' => 'Laki-laki',
                'marital_status' => 'Single',
                'religion' => 'Islam',
                'blood_type' => 'AB',
            ]
        );

        // 5. Staff (Bawahan Supervisor)
        User::updateOrCreate(
            ['email' => 'ahmad@ajnusa.com'],
            [
                'name' => 'Ahmad Karyawan',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $staffRole->id,
                'supervisor_id' => $supervisor->id,
                'nik' => '12345678',
                'basic_salary' => 5500000,
                'ptkp_status' => 'TK/0',
                'bank_name' => 'BNI',
                'bank_account_no' => '111222333',
                'ktp_no' => '3171234567800005',
                'place_of_birth' => 'Bekasi',
                'date_of_birth' => '1995-12-05',
                'gender' => 'Laki-laki',
                'marital_status' => 'Single',
                'religion' => 'Islam',
                'blood_type' => 'O',
                'emergency_contact_name' => 'Orang Tua Ahmad',
                'emergency_contact_phone' => '08129876543',
            ]
        );
    }
}
