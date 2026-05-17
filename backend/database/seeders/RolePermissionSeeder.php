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

        $admin = Role::updateOrCreate(['name' => 'Super Admin']);
        $hrd = Role::updateOrCreate(['name' => 'HRD Manager']);
        $staff = Role::updateOrCreate(['name' => 'Staff Karyawan']);
        $direktur = Role::updateOrCreate(['name' => 'Direktur']);
        $manager = Role::updateOrCreate(['name' => 'Manager']);
        $supervisor = Role::updateOrCreate(['name' => 'Supervisor']);

        $allPermissions = Permission::all()->pluck('id');
        $admin->permissions()->sync($allPermissions);
        $direktur->permissions()->sync($allPermissions);

        $managerPermissions = Permission::whereIn('group', [
            'Pegawai', 'Cuti', 'Perizinan', 'Reimbursement', 'Lembur', 'Operasional', 'Performa', 'Kehadiran', 'Tukar Shift', 'Proyek', 'Kendaraan', 'Tugas', 'Dokumen',
        ])->whereNotIn('slug', ['delete-employees', 'manage-roles', 'manage-company'])->pluck('id');
        $manager->permissions()->sync($managerPermissions);

        $supervisorPermissions = Permission::whereIn('slug', [
            'view-employees', 'view-directory', 'view-organization',
            'view-leaves', 'approve-leaves',
            'view-permits', 'approve-permits',
            'view-reimbursements', 'approve-reimbursements',
            'view-overtimes', 'approve-overtimes',
            'view-kpis', 'view-attendance-map', 'view-attendance-reports', 'view-attendances', 'view-reports',
            'manage-shifts', 'manage-schedules', 'manage-approvals', 'view-announcements',
            'view-shift-swaps', 'approve-shift-swaps', 'view-shift-swap-reports', 'export-shift-swaps',
            'view-projects', 'approve-project-costs',
            'view-vehicle-logs', 'approve-vehicle-logs', 'view-vehicle-reports',
            'view-tasks', 'manage-tasks', 'view-documents',
            'view-fund-requests', 'apply-fund-requests', 'approve-fund-requests',
        ])->pluck('id');
        $supervisor->permissions()->sync($supervisorPermissions);

        $hrdPermissions = Permission::whereIn('group', [
            'Pegawai', 'Cuti', 'Perizinan', 'Reimbursement', 'Lembur', 'Operasional', 'Performa', 'Kehadiran', 'Tukar Shift', 'Proyek', 'Kendaraan', 'Tugas', 'Payroll', 'Dokumen',
        ])->pluck('id');
        $hrd->permissions()->sync($hrdPermissions);

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
        $staff->permissions()->sync($staffPermissions);
    }
}
