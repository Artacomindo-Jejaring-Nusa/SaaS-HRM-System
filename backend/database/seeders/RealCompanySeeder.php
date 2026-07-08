<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RealCompanySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Create Main Company
        $company = Company::firstOrCreate(
            ['id' => 1],
            [
                'name' => 'Narwasthu Artha Tama',
                'email' => 'corporate@narwastu-group.com',
                'address' => 'Gedung Narwastu Lt. 12, Jakarta Selatan',
            ]
        );

        // 2. Define All Core Permissions
        $permissions = [
            ['name' => 'Lihat Pegawai', 'slug' => 'view-employees', 'group' => 'Pegawai'],
            ['name' => 'Tambah Pegawai', 'slug' => 'create-employees', 'group' => 'Pegawai'],
            ['name' => 'Ubah Pegawai', 'slug' => 'edit-employees', 'group' => 'Pegawai'],
            ['name' => 'Hapus Pegawai', 'slug' => 'delete-employees', 'group' => 'Pegawai'],
            ['name' => 'Lihat Cuti', 'slug' => 'view-leaves', 'group' => 'Cuti'],
            ['name' => 'Setujui Cuti', 'slug' => 'approve-leaves', 'group' => 'Cuti'],
            ['name' => 'Lihat Klaim', 'slug' => 'view-reimbursements', 'group' => 'Reimbursement'],
            ['name' => 'Setujui Klaim', 'slug' => 'approve-reimbursements', 'group' => 'Reimbursement'],
            ['name' => 'Lihat Lembur', 'slug' => 'view-overtimes', 'group' => 'Lembur'],
            ['name' => 'Setujui Lembur', 'slug' => 'approve-overtimes', 'group' => 'Lembur'],
            ['name' => 'Kelola Tugas', 'slug' => 'manage-tasks', 'group' => 'Tugas'],
            ['name' => 'Kelola Payroll', 'slug' => 'manage-payroll', 'group' => 'Payroll'],
            ['name' => 'Kelola Perusahaan', 'slug' => 'manage-company', 'group' => 'Pengaturan'],
            ['name' => 'Setujui Perizinan', 'slug' => 'approve-permits', 'group' => 'Perizinan'],
            ['name' => 'Lihat Log Kendaraan', 'slug' => 'view-vehicle-logs', 'group' => 'Kendaraan'],
        ];

        foreach ($permissions as $p) {
            Permission::updateOrCreate(['slug' => $p['slug']], $p);
        }

        // 3. Define Real World Roles and Permission Mapping
        $rolesData = [
            'Super Admin' => Permission::all()->pluck('id'),
            'CEO / Direktur Utama' => Permission::all()->pluck('id'),

            // HRD Manager (Full HR Authority)
            'HRD Manager' => Permission::whereIn('group', [
                'Pegawai', 'Cuti', 'Perizinan', 'Pengaturan', 'Payroll', 'Reimbursement', 
                'Lembur', 'Operasional', 'Performa', 'Kehadiran', 'Tukar Shift', 'Tugas', 
                'Dokumen', 'Keuangan'
            ])->pluck('id'),

            // HRD (Staff level - Can view & entry but limited approval/deletion)
            'HRD' => Permission::whereIn('slug', [
                'view-employees', 'view-leaves', 'view-permits', 'view-reimbursements', 'view-overtimes',
                'approve-permits', 'view-vehicle-logs',
            ])->pluck('id'),

            'Finance Manager' => Permission::whereIn('group', ['Reimbursement', 'Payroll', 'Keuangan'])->pluck('id'),
            'IT Manager' => Permission::whereIn('group', ['Tugas', 'Pengaturan'])->pluck('id'),
            'Supervisor Operational' => Permission::whereIn('slug', ['approve-leaves', 'approve-overtimes', 'view-employees', 'manage-tasks'])->pluck('id'),
            'Staff Karyawan' => Permission::whereIn('slug', ['view-directory', 'view-announcements'])->pluck('id'),
        ];

        $roleObjects = [];
        foreach ($rolesData as $roleName => $permissionIds) {
            $role = Role::updateOrCreate(['name' => $roleName]);
            $role->permissions()->sync($permissionIds);
            $roleObjects[$roleName] = $role;
        }

        // 4. Create Users for Hierarchy
        $ceo = User::updateOrCreate(
            ['email' => 'ahmad@narwastu.com'],
            [
                'name' => 'Ahmad Rizki',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $roleObjects['CEO / Direktur Utama']->id,
                'nik' => 'CEO001',
                'join_date' => '2020-01-01',
                'basic_salary' => 15000000,
                'fixed_allowance' => 1500000,
                'ptkp_status' => 'K/0',
                'bank_name' => 'BCA',
                'bank_account_no' => '1234567890',
                'cost_center' => 'PT. Artacomindotama',
                'payroll_type' => 'monthly',
            ]
        );

        // HRD Manager (Johan)
        $hrManager = User::updateOrCreate(
            ['email' => 'johan@narwastu.com'],
            [
                'name' => 'Johan Saputra (HR Manager)',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $roleObjects['HRD Manager']->id,
                'supervisor_id' => $ceo->id,
                'nik' => 'HRM001',
                'join_date' => '2021-02-15',
                'basic_salary' => 9500000,
                'fixed_allowance' => 950000,
                'ptkp_status' => 'TK/0',
                'bank_name' => 'BCA',
                'bank_account_no' => '1234567891',
                'cost_center' => 'PT. Narwastu',
                'payroll_type' => 'monthly',
            ]
        );

        // HRD Staff (Maya) - Now using HRD Role
        $hrStaff = User::updateOrCreate(
            ['email' => 'maya@narwastu.com'],
            [
                'name' => 'Maya Indah (HR Staff)',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $roleObjects['HRD']->id,
                'supervisor_id' => $hrManager->id,
                'nik' => 'STF002',
                'join_date' => '2022-03-10',
                'leave_balance' => 12,
                'basic_salary' => 5500000,
                'fixed_allowance' => 550000,
                'ptkp_status' => 'TK/0',
                'bank_name' => 'BCA',
                'bank_account_no' => '1234567892',
                'cost_center' => 'AJNusa',
                'payroll_type' => 'monthly',
            ]
        );

        $financeManager = User::updateOrCreate(
            ['email' => 'siti@narwastu.com'],
            [
                'name' => 'Siti Aminah (Finance Manager)',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $roleObjects['Finance Manager']->id,
                'supervisor_id' => $ceo->id,
                'nik' => 'FIN001',
                'basic_salary' => 10000000,
                'fixed_allowance' => 1000000,
                'ptkp_status' => 'TK/0',
                'bank_name' => 'BCA',
                'bank_account_no' => '1234567893',
                'cost_center' => 'PT. Artacomindotama',
                'payroll_type' => 'monthly',
            ]
        );

        $supervisor = User::updateOrCreate(
            ['email' => 'dedi@narwastu.com'],
            [
                'name' => 'Dedi Gunawan (Supervisor Ops)',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $roleObjects['Supervisor Operational']->id,
                'supervisor_id' => $ceo->id,
                'nik' => 'SUP001',
                'basic_salary' => 7500000,
                'fixed_allowance' => 750000,
                'ptkp_status' => 'K/1',
                'bank_name' => 'BCA',
                'bank_account_no' => '1234567894',
                'cost_center' => 'PT. Narwastu',
                'payroll_type' => 'monthly',
            ]
        );

        User::updateOrCreate(
            ['email' => 'anto@narwastu.com'],
            [
                'name' => 'Anto Prasetia (Staff Ops)',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $roleObjects['Staff Karyawan']->id,
                'supervisor_id' => $supervisor->id,
                'nik' => 'STF001',
                'leave_balance' => 12,
                'basic_salary' => 5000000,
                'fixed_allowance' => 500000,
                'ptkp_status' => 'TK/0',
                'bank_name' => 'BCA',
                'bank_account_no' => '1234567895',
                'cost_center' => 'AJNusa',
                'payroll_type' => 'monthly',
            ]
        );

        User::updateOrCreate(
            ['email' => 'superadmin@example.com'],
            [
                'name' => 'System Administrator',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $roleObjects['Super Admin']->id,
                'nik' => 'ADMIN01',
                'basic_salary' => 6000000,
                'fixed_allowance' => 600000,
                'ptkp_status' => 'TK/0',
                'bank_name' => 'BCA',
                'bank_account_no' => '1234567896',
                'cost_center' => 'PT. Artacomindotama',
                'payroll_type' => 'monthly',
            ]
        );
    }
}
