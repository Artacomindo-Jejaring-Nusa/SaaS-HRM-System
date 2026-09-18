<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            // Pegawai
            ['name' => 'Lihat Pegawai', 'slug' => 'view-employees', 'group' => 'Pegawai'],
            ['name' => 'Tambah Pegawai', 'slug' => 'create-employees', 'group' => 'Pegawai'],
            ['name' => 'Ubah Pegawai', 'slug' => 'edit-employees', 'group' => 'Pegawai'],
            ['name' => 'Hapus Pegawai', 'slug' => 'delete-employees', 'group' => 'Pegawai'],
            ['name' => 'Lihat Direktori', 'slug' => 'view-directory', 'group' => 'Pegawai'],
            ['name' => 'Lihat Organisasi', 'slug' => 'view-organization', 'group' => 'Pegawai'],

            // Cuti
            ['name' => 'Lihat Cuti', 'slug' => 'view-leaves', 'group' => 'Cuti'],
            ['name' => 'Ajukan Cuti', 'slug' => 'apply-leaves', 'group' => 'Cuti'],
            ['name' => 'Setujui Cuti', 'slug' => 'approve-leaves', 'group' => 'Cuti'],
            ['name' => 'Hapus Cuti', 'slug' => 'delete-leaves', 'group' => 'Cuti'],

            // Perizinan
            ['name' => 'Lihat Perizinan', 'slug' => 'view-permits', 'group' => 'Perizinan'],
            ['name' => 'Ajukan Perizinan', 'slug' => 'apply-permits', 'group' => 'Perizinan'],
            ['name' => 'Setujui Perizinan', 'slug' => 'approve-permits', 'group' => 'Perizinan'],
            ['name' => 'Hapus Perizinan', 'slug' => 'delete-permits', 'group' => 'Perizinan'],

            // Reimbursement
            ['name' => 'Lihat Klaim', 'slug' => 'view-reimbursements', 'group' => 'Reimbursement'],
            ['name' => 'Ajukan Klaim', 'slug' => 'apply-reimbursements', 'group' => 'Reimbursement'],
            ['name' => 'Setujui Klaim', 'slug' => 'approve-reimbursements', 'group' => 'Reimbursement'],
            ['name' => 'Hapus Klaim', 'slug' => 'delete-reimbursements', 'group' => 'Reimbursement'],

            // Lembur
            ['name' => 'Lihat Lembur', 'slug' => 'view-overtimes', 'group' => 'Lembur'],
            ['name' => 'Ajukan Lembur', 'slug' => 'apply-overtimes', 'group' => 'Lembur'],
            ['name' => 'Setujui Lembur', 'slug' => 'approve-overtimes', 'group' => 'Lembur'],
            ['name' => 'Hapus Lembur', 'slug' => 'delete-overtimes', 'group' => 'Lembur'],

            // Operational
            ['name' => 'Akses Portal Manager', 'slug' => 'view-manager-portal', 'group' => 'Operasional'],
            ['name' => 'Kelola Shift', 'slug' => 'manage-shifts', 'group' => 'Operasional'],
            ['name' => 'Kelola Jadwal', 'slug' => 'manage-schedules', 'group' => 'Operasional'],
            ['name' => 'Kelola Hari Libur', 'slug' => 'manage-holidays', 'group' => 'Operasional'],
            ['name' => 'Kelola Pengumuman', 'slug' => 'manage-announcements', 'group' => 'Operasional'],
            ['name' => 'Lihat Pengumuman', 'slug' => 'view-announcements', 'group' => 'Operasional'],
            ['name' => 'Kelola Approval Pusat', 'slug' => 'manage-approvals', 'group' => 'Operasional'],

            // KPI & Performa
            ['name' => 'Lihat KPI', 'slug' => 'view-kpis', 'group' => 'Performa'],
            ['name' => 'Kelola KPI', 'slug' => 'manage-kpis', 'group' => 'Performa'],

            // Peta Kehadiran & Laporan
            ['name' => 'Lakukan Absensi', 'slug' => 'apply-attendances', 'group' => 'Kehadiran'],
            ['name' => 'Lihat Absensi', 'slug' => 'view-attendances', 'group' => 'Kehadiran'],
            ['name' => 'Lihat Map Absensi', 'slug' => 'view-attendance-map', 'group' => 'Kehadiran'],
            ['name' => 'Lihat Live Tracking Teknisi', 'slug' => 'view-live-tracking', 'group' => 'Kehadiran'],
            ['name' => 'Lihat Laporan Absensi', 'slug' => 'view-attendance-reports', 'group' => 'Kehadiran'],
            ['name' => 'Export Laporan Absensi', 'slug' => 'export-attendance', 'group' => 'Kehadiran'],
            ['name' => 'Kelola Koreksi Absen', 'slug' => 'manage-attendance-corrections', 'group' => 'Kehadiran'],
            ['name' => 'Lihat Semua Laporan', 'slug' => 'view-reports', 'group' => 'Kehadiran'],

            // Tukar Shift
            ['name' => 'Lihat Tukar Shift', 'slug' => 'view-shift-swaps', 'group' => 'Tukar Shift'],
            ['name' => 'Ajukan Tukar Shift', 'slug' => 'apply-shift-swaps', 'group' => 'Tukar Shift'],
            ['name' => 'Setujui Tukar Shift', 'slug' => 'approve-shift-swaps', 'group' => 'Tukar Shift'],
            ['name' => 'Lihat Laporan Tukar Shift', 'slug' => 'view-shift-swap-reports', 'group' => 'Tukar Shift'],
            ['name' => 'Export Laporan Tukar Shift', 'slug' => 'export-shift-swaps', 'group' => 'Tukar Shift'],

            // Proyek & Konstruksi
            ['name' => 'Lihat Proyek', 'slug' => 'view-projects', 'group' => 'Proyek'],
            ['name' => 'Buat Proyek', 'slug' => 'create-projects', 'group' => 'Proyek'],
            ['name' => 'Ubah Proyek', 'slug' => 'edit-projects', 'group' => 'Proyek'],
            ['name' => 'Hapus Proyek', 'slug' => 'delete-projects', 'group' => 'Proyek'],
            ['name' => 'Kelola Anggaran Proyek', 'slug' => 'manage-project-budgets', 'group' => 'Proyek'],
            ['name' => 'Kelola Kontrak Proyek', 'slug' => 'manage-project-contracts', 'group' => 'Proyek'],
            ['name' => 'Setujui Biaya Proyek', 'slug' => 'approve-project-costs', 'group' => 'Proyek'],

            // Fleet Logging (Manajemen Kendaraan)
            ['name' => 'Lihat Log Kendaraan', 'slug' => 'view-vehicle-logs', 'group' => 'Kendaraan'],
            ['name' => 'Catat Penggunaan Kendaraan', 'slug' => 'apply-vehicle-logs', 'group' => 'Kendaraan'],
            ['name' => 'Validasi Log Kendaraan', 'slug' => 'approve-vehicle-logs', 'group' => 'Kendaraan'],
            ['name' => 'Lihat Laporan Mileage', 'slug' => 'view-vehicle-reports', 'group' => 'Kendaraan'],

            // Pengaturan
            ['name' => 'Pengaturan Perusahaan', 'slug' => 'manage-company', 'group' => 'Pengaturan'],
            ['name' => 'Manajemen Role', 'slug' => 'manage-roles', 'group' => 'Pengaturan'],
            ['name' => 'Lihat Log Aktivitas', 'slug' => 'view-activity-logs', 'group' => 'Pengaturan'],
            ['name' => 'Kelola WFA (Dinas Luar)', 'slug' => 'manage-wfh', 'group' => 'Pengaturan'],
            ['name' => 'Kelola Kantor Cabang', 'slug' => 'manage-offices', 'group' => 'Pengaturan'],

            // Tugas (Tasks)
            ['name' => 'Lihat Tugas', 'slug' => 'view-tasks', 'group' => 'Tugas'],
            ['name' => 'Kelola Tugas', 'slug' => 'manage-tasks', 'group' => 'Tugas'],

            // Payroll
            ['name' => 'Lihat Payroll', 'slug' => 'view-salaries', 'group' => 'Payroll'],
            ['name' => 'Kelola Payroll', 'slug' => 'manage-payroll', 'group' => 'Payroll'],
            ['name' => 'Lihat Laporan Payroll', 'slug' => 'view-payroll-reports', 'group' => 'Payroll'],

            // Dokumen (SK & Regulasi)
            ['name' => 'Lihat Dokumen', 'slug' => 'view-documents', 'group' => 'Dokumen'],
            ['name' => 'Kelola Dokumen', 'slug' => 'manage-documents', 'group' => 'Dokumen'],

            // Pengajuan Dana (Cash Advance)
            ['name' => 'Lihat Pengajuan Dana', 'slug' => 'view-fund-requests', 'group' => 'Keuangan'],
            ['name' => 'Ajukan Pengajuan Dana', 'slug' => 'apply-fund-requests', 'group' => 'Keuangan'],
            ['name' => 'Setujui Pengajuan Dana', 'slug' => 'approve-fund-requests', 'group' => 'Keuangan'],
        ];

        foreach ($permissions as $p) {
            Permission::updateOrCreate(['slug' => $p['slug']], $p);
        }

        // 1. Super Admin
        $admin = Role::updateOrCreate(['name' => 'Super Admin']);
        // 2. HRD Manager
        $hrdManager = Role::updateOrCreate(['name' => 'HRD Manager']);
        // 3. Staff Karyawan
        $staffKaryawan = Role::updateOrCreate(['name' => 'Staff Karyawan']);
        // 4. Direktur
        $direktur = Role::updateOrCreate(['name' => 'Direktur']);
        // 5. Manager
        $manager = Role::updateOrCreate(['name' => 'Manager']);
        // 6. Supervisor
        $supervisor = Role::updateOrCreate(['name' => 'Supervisor']);
        // 7. CEO / Direktur Utama
        $ceo = Role::updateOrCreate(['name' => 'CEO / Direktur Utama']);
        // 8. HRD
        $hrd = Role::updateOrCreate(['name' => 'HRD']);
        // 9. Finance Manager
        $financeManager = Role::updateOrCreate(['name' => 'Finance Manager']);
        // 10. Supervisor Operational
        $spvOps = Role::updateOrCreate(['name' => 'Supervisor Operational']);
        // 11. Staff Teknisi
        $staffTeknisi = Role::updateOrCreate(['name' => 'Staff Teknisi']);
        // 12. Supervisor Engineer
        $spvEng = Role::updateOrCreate(['name' => 'Supervisor Engineer']);
        // 13. Specific Supervisors
        $spvFinance = Role::updateOrCreate(['name' => 'Supervisor Finance']);
        $spvIT = Role::updateOrCreate(['name' => 'Supervisor IT']);
        $spvAdmin = Role::updateOrCreate(['name' => 'Supervisor Admin']);
        $spvSales = Role::updateOrCreate(['name' => 'Supervisor Sales']);
        $spvNOC = Role::updateOrCreate(['name' => 'Supervisor NOC']);

        $allPermissions = Permission::all()->pluck('id');
        // Only Super Admin has all permissions including live tracking & attendance map
        $admin->permissions()->sync($allPermissions);

        // Direktur & CEO (All except Super Admin exclusive tracking / map / system settings)
        $executivePermissions = Permission::whereNotIn('slug', [
            'view-attendance-map', 'view-live-tracking', 'manage-roles', 'manage-company',
        ])->pluck('id');
        $direktur->permissions()->sync($executivePermissions);
        $ceo->permissions()->sync($executivePermissions);

        // HRD Manager Permissions (All except super admin exclusive & system settings)
        $hrdManagerPermissions = Permission::whereNotIn('slug', [
            'manage-roles', 'manage-company', 'view-attendance-map', 'view-live-tracking',
        ])->pluck('id');
        $hrdManager->permissions()->sync($hrdManagerPermissions);

        // HRD Permissions
        $hrdPermissions = Permission::whereIn('group', [
            'Pegawai', 'Cuti', 'Perizinan', 'Reimbursement', 'Lembur', 'Operasional', 'Performa', 'Kehadiran', 'Tukar Shift', 'Payroll', 'Dokumen', 'Keuangan',
        ])->whereNotIn('slug', ['manage-roles', 'manage-company', 'view-attendance-map', 'view-live-tracking'])->pluck('id');
        $hrd->permissions()->sync($hrdPermissions);

        // Manager Permissions
        $managerPermissions = Permission::whereIn('group', [
            'Pegawai', 'Cuti', 'Perizinan', 'Reimbursement', 'Lembur', 'Operasional', 'Performa', 'Kehadiran', 'Tukar Shift', 'Proyek', 'Kendaraan', 'Tugas', 'Dokumen', 'Keuangan',
        ])->whereNotIn('slug', ['delete-employees', 'manage-roles', 'manage-company', 'view-attendance-map', 'view-live-tracking'])->pluck('id');
        $manager->permissions()->sync($managerPermissions);

        // Finance Manager Permissions
        $financePermissions = Permission::whereIn('slug', [
            'view-manager-portal',
            'view-employees', 'view-directory', 'view-organization',
            'view-leaves', 'apply-leaves', 'approve-leaves',
            'view-permits', 'apply-permits', 'approve-permits',
            'view-reimbursements', 'apply-reimbursements', 'approve-reimbursements',
            'view-overtimes', 'apply-overtimes', 'approve-overtimes',
            'view-salaries', 'manage-payroll', 'view-payroll-reports',
            'view-fund-requests', 'apply-fund-requests', 'approve-fund-requests',
            'view-projects', 'manage-project-budgets', 'approve-project-costs',
            'view-reports', 'view-documents', 'manage-documents', 'view-announcements',
        ])->pluck('id');
        $financeManager->permissions()->sync($financePermissions);

        // Supervisor Permissions (General)
        $supervisorPermissions = Permission::whereIn('slug', [
            'view-manager-portal',
            'view-employees', 'view-directory', 'view-organization',
            'view-leaves', 'apply-leaves', 'approve-leaves',
            'view-permits', 'apply-permits', 'approve-permits',
            'view-reimbursements', 'apply-reimbursements', 'approve-reimbursements',
            'view-overtimes', 'apply-overtimes', 'approve-overtimes',
            'view-kpis', 'view-attendance-reports', 'view-attendances', 'view-reports',
            'manage-shifts', 'manage-schedules', 'manage-approvals', 'view-announcements',
            'view-shift-swaps', 'apply-shift-swaps', 'approve-shift-swaps', 'view-shift-swap-reports', 'export-shift-swaps',
            'view-projects', 'approve-project-costs',
            'view-vehicle-logs', 'apply-vehicle-logs', 'approve-vehicle-logs', 'view-vehicle-reports',
            'view-tasks', 'manage-tasks', 'view-documents',
            'view-fund-requests', 'apply-fund-requests', 'approve-fund-requests', 'view-salaries',
        ])->pluck('id');
        $supervisor->permissions()->sync($supervisorPermissions);
        $spvOps->permissions()->sync($supervisorPermissions);
        $spvFinance->permissions()->sync($supervisorPermissions);
        $spvIT->permissions()->sync($supervisorPermissions);
        $spvAdmin->permissions()->sync($supervisorPermissions);
        $spvSales->permissions()->sync($supervisorPermissions);
        $spvNOC->permissions()->sync($supervisorPermissions);

        // Supervisor Engineer Permissions
        $spvEngPermissions = Permission::whereIn('slug', [
            'view-manager-portal',
            'view-employees', 'view-directory', 'view-organization',
            'view-leaves', 'apply-leaves', 'approve-leaves',
            'view-permits', 'apply-permits', 'approve-permits',
            'view-reimbursements', 'apply-reimbursements', 'approve-reimbursements',
            'view-overtimes', 'apply-overtimes', 'approve-overtimes',
            'view-kpis', 'view-attendances', 'view-reports',
            'view-projects', 'create-projects', 'edit-projects', 'manage-project-budgets', 'approve-project-costs',
            'view-vehicle-logs', 'apply-vehicle-logs', 'approve-vehicle-logs',
            'view-tasks', 'manage-tasks', 'view-documents', 'manage-documents',
            'view-fund-requests', 'apply-fund-requests', 'approve-fund-requests', 'view-salaries',
        ])->pluck('id');
        $spvEng->permissions()->sync($spvEngPermissions);

        // Staff Karyawan & Staff Teknisi (Self-Service)
        $staffPermissions = Permission::whereIn('slug', [
            'view-directory', 'view-organization', 'view-announcements',
            'view-leaves', 'apply-leaves',
            'view-permits', 'apply-permits',
            'view-reimbursements', 'apply-reimbursements',
            'view-overtimes', 'apply-overtimes',
            'view-kpis',
            'apply-attendances', 'view-attendances',
            'view-shift-swaps', 'apply-shift-swaps',
            'view-projects',
            'view-vehicle-logs', 'apply-vehicle-logs',
            'view-tasks', 'view-salaries', 'view-documents',
            'view-fund-requests', 'apply-fund-requests',
        ])->pluck('id');
        $staffKaryawan->permissions()->sync($staffPermissions);
        $staffTeknisi->permissions()->sync($staffPermissions);

        // Extra executive roles (CEO/BOC, COO, etc.)
        $extraExecutiveRoles = Role::whereIn('name', ['CEO / BOC', 'COO', 'Anggota Direksi', 'Kadiv Direktur', 'Leader', 'Admin VP'])->get();
        foreach ($extraExecutiveRoles as $extraRole) {
            $extraRole->permissions()->sync($executivePermissions);
        }
    }
}
