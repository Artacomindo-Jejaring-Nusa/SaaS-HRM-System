<?php

namespace Database\Seeders;

use App\Models\ApprovalWorkflow;
use App\Models\Company;
use App\Models\Office;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\WorkflowStep;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RealCompanySeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Seed based on actual company hierarchy from "Spend of Layer-Signature.xlsx"
     * dated 10 Ags 2026.
     */
    public function run(): void
    {
        // ═══════════════════════════════════════════════════════
        // 1. Create Main Company
        // ═══════════════════════════════════════════════════════
        $company = Company::updateOrCreate(
            ['id' => 1],
            [
                'name' => 'Narwasthu Artha Tama (Artacomindo Group)',
                'email' => 'corporate@narwastu-group.com',
                'address' => 'Jakarta, Indonesia',
                'latitude' => '-6.220034690809037',
                'longitude' => '106.95406518358962',
            ]
        );

        // ═══════════════════════════════════════════════════════
        // 2. Create Office (Kantor Pusat) for Geofence
        // ═══════════════════════════════════════════════════════
        $office = Office::updateOrCreate(
            ['company_id' => $company->id, 'name' => 'Kantor Pusat Jakarta'],
            [
                'address' => 'Jakarta, Indonesia',
                'latitude' => '-6.220034690809037',
                'longitude' => '106.95406518358962',
                'radius' => 200, // 200 meter radius
                'is_active' => true,
            ]
        );

        // ═══════════════════════════════════════════════════════
        // 3. Define All Core Permissions
        // ═══════════════════════════════════════════════════════
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
            ['name' => 'Kelola Kantor Cabang', 'slug' => 'manage-offices', 'group' => 'Pengaturan'],
            ['name' => 'Lihat Absensi', 'slug' => 'view-attendances', 'group' => 'Kehadiran'],
            ['name' => 'Absensi', 'slug' => 'apply-attendances', 'group' => 'Kehadiran'],
            ['name' => 'Kelola Koreksi Absen', 'slug' => 'manage-attendance-corrections', 'group' => 'Kehadiran'],
            ['name' => 'Export Absensi', 'slug' => 'export-attendance', 'group' => 'Kehadiran'],
        ];

        foreach ($permissions as $p) {
            Permission::updateOrCreate(['slug' => $p['slug']], $p);
        }

        // ═══════════════════════════════════════════════════════
        // 4. Define Roles Matching Real Company Structure
        // ═══════════════════════════════════════════════════════
        $allPermIds = Permission::all()->pluck('id');

        $rolesData = [
            // Super Admin → ALL permissions (system administrator)
            'Super Admin' => $allPermIds,

            // CEO (Board of Commissioners) → ALL permissions
            'CEO / BOC' => $allPermIds,

            // COO → ALL permissions
            'COO' => $allPermIds,

            // Anggota Direksi (Board Member) → ALL except system config
            'Anggota Direksi' => $allPermIds,

            // Admin VP → Can view, approve, manage within their division
            'Admin VP' => Permission::whereIn('group', [
                'Pegawai', 'Cuti', 'Perizinan', 'Pengaturan', 'Payroll',
                'Reimbursement', 'Lembur', 'Tugas', 'Kehadiran', 'Kendaraan',
            ])->pluck('id'),

            // Kadiv / Direktur → Can view, approve within their scope
            'Kadiv Direktur' => Permission::whereIn('slug', [
                'view-employees', 'view-leaves', 'approve-leaves', 'view-reimbursements',
                'approve-reimbursements', 'view-overtimes', 'approve-overtimes',
                'approve-permits', 'manage-tasks', 'view-vehicle-logs',
                'view-attendances', 'apply-attendances', 'manage-attendance-corrections',
            ])->pluck('id'),

            // Supervisor / Head → Can view team, approve basic requests
            'Supervisor' => Permission::whereIn('slug', [
                'view-employees', 'view-leaves', 'approve-leaves', 'view-overtimes',
                'approve-overtimes', 'approve-permits', 'manage-tasks',
                'view-attendances', 'apply-attendances',
            ])->pluck('id'),

            // Leader → Same as Supervisor but for NOC/Tech
            'Leader' => Permission::whereIn('slug', [
                'view-employees', 'view-leaves', 'approve-leaves', 'approve-permits',
                'manage-tasks', 'view-attendances', 'apply-attendances',
            ])->pluck('id'),

            // Staff → Basic employee (can view self, apply attendance/leave)
            'Staff' => Permission::whereIn('slug', [
                'view-leaves', 'view-overtimes', 'view-reimbursements',
                'view-attendances', 'apply-attendances',
            ])->pluck('id'),

            // Clerk → Junior staff
            'Clerk' => Permission::whereIn('slug', [
                'view-leaves', 'view-attendances', 'apply-attendances',
            ])->pluck('id'),

            // OB (Office Boy) → Minimal permissions
            'OB' => Permission::whereIn('slug', [
                'view-leaves', 'view-attendances', 'apply-attendances',
            ])->pluck('id'),

            // Finance Manager → Financial focus
            'Finance Manager' => Permission::whereIn('group', [
                'Reimbursement', 'Payroll', 'Kehadiran',
            ])->pluck('id'),

            // HRD Manager (Full HR Authority)
            'HRD Manager' => Permission::whereIn('group', [
                'Pegawai', 'Cuti', 'Perizinan', 'Pengaturan', 'Payroll',
                'Reimbursement', 'Lembur', 'Tugas', 'Kehadiran', 'Kendaraan',
            ])->pluck('id'),

            // HRD (Staff level)
            'HRD' => Permission::whereIn('slug', [
                'view-employees', 'view-leaves', 'view-reimbursements',
                'view-overtimes', 'approve-permits', 'view-vehicle-logs',
                'view-attendances', 'apply-attendances',
            ])->pluck('id'),
        ];

        $roles = [];
        foreach ($rolesData as $roleName => $permissionIds) {
            $role = Role::updateOrCreate(['name' => $roleName]);
            $role->permissions()->sync($permissionIds);
            $roles[$roleName] = $role;
        }

        // ═══════════════════════════════════════════════════════
        // 5. Helper to create users
        // ═══════════════════════════════════════════════════════
        $defaultPassword = Hash::make('password');
        $createUser = function ($email, $name, $roleName, $supervisorId, $nik, $bagian = null, $extra = []) use ($company, $office, $roles, $defaultPassword) {
            // Generate deterministic date_of_birth per NIK across all 12 months
            $hash = md5($nik);
            $dobDay = (hexdec(substr($hash, 0, 2)) % 28) + 1;
            $dobMonth = (hexdec(substr($hash, 2, 2)) % 12) + 1;
            $dobYear = 1985 + (hexdec(substr($hash, 4, 2)) % 15);
            $generatedDob = sprintf('%04d-%02d-%02d', $dobYear, $dobMonth, $dobDay);

            return User::updateOrCreate(
                ['email' => $email],
                array_merge([
                    'name' => $name,
                    'password' => $defaultPassword,
                    'company_id' => $company->id,
                    'office_id' => $office->id,
                    'role_id' => $roles[$roleName]->id,
                    'supervisor_id' => $supervisorId,
                    'nik' => $nik,
                    'date_of_birth' => $generatedDob,
                    'join_date' => '2024-01-01',
                    'leave_balance' => 12,
                    'basic_salary' => 5000000,
                    'fixed_allowance' => 500000,
                    'ptkp_status' => 'TK/0',
                    'bank_name' => 'BCA',
                    'bank_account_no' => '00000' . $nik,
                    'cost_center' => 'PT. Artacomindotama',
                    'payroll_type' => 'monthly',
                ], $extra)
            );
        };

        // ═══════════════════════════════════════════════════════
        // 6. Create Users per Hierarchy (from Excel "Layer utk ttd")
        // ═══════════════════════════════════════════════════════

        // ------- TOP LEVEL -------
        // #1 CEO (BOC) - No supervisor
        $ardhito = $createUser(
            'ardhito@artacomindo.com', 'Ardhito Rizky Syaputra', 'CEO / BOC', null, 'CEO001',
            'CEO-New(BOC)', ['basic_salary' => 25000000, 'fixed_allowance' => 2500000]
        );

        // #2 COO - Reports to CEO
        $yulhan = $createUser(
            'yulhan@artacomindo.com', 'Ir M Ridha Yulhan M Infsc', 'COO', $ardhito->id, 'COO001',
            'COO', ['basic_salary' => 20000000, 'fixed_allowance' => 2000000]
        );

        // #3 Anggota Direksi - Reports to CEO
        $zenHelmi = $createUser(
            'zenhelmi@artacomindo.com', 'Zen Helmi', 'Anggota Direksi', $ardhito->id, 'DIR001',
            'Anggota Direksi', ['basic_salary' => 18000000, 'fixed_allowance' => 1800000]
        );

        // ------- DIVISION HEADS / VP -------
        // #6 Admin VP HRGA&FA - Reports to CEO
        $nazirin = $createUser(
            'nazirin@artacomindo.com', 'Nazirin Nawawi', 'Admin VP', $ardhito->id, 'AVP001',
            'Admin VP-HRGA&FA', ['basic_salary' => 15000000, 'fixed_allowance' => 1500000]
        );

        // #11 Admin VP Procurement - Reports to Kadiv (ZH/Yulhan) + CEO
        $diwan = $createUser(
            'diwan@artacomindo.com', 'Diwan Permantara', 'Admin VP', $zenHelmi->id, 'AVP002',
            'Admin VP-Procurement', ['basic_salary' => 12000000, 'fixed_allowance' => 1200000]
        );

        // ------- SALES & BUSINESS -------
        // #4 Bisdev - Reports to Kadiv (ZH) → CEO
        $azie = $createUser(
            'azie@artacomindo.com', 'Azie Fauzie', 'Staff', $zenHelmi->id, 'BIZ001',
            'Bisdev', ['basic_salary' => 8000000, 'fixed_allowance' => 800000]
        );

        // #5 Sales&Marketing - Reports to Kadiv (ZH) → CEO
        $etang = $createUser(
            'etang@artacomindo.com', 'Etang Agung Apriyanto', 'Supervisor', $zenHelmi->id, 'SAL001',
            'Sales&Marketing', ['basic_salary' => 9000000, 'fixed_allowance' => 900000]
        );

        // ------- FINANCE & ADMIN -------
        // #7 Finance&Admin - Reports to Spv(NN) → CEO
        $haris = $createUser(
            'haris@artacomindo.com', 'E Haris Ambiyana', 'Supervisor', $nazirin->id, 'FIN001',
            'Finance&Admin', ['basic_salary' => 8000000, 'fixed_allowance' => 800000]
        );

        // #8 Risk Mgt - Reports to Spv(NN) → CEO
        $erzen = $createUser(
            'erzen@artacomindo.com', 'Erzen Effendi', 'Staff', $nazirin->id, 'RSK001',
            'Risk Mgt', ['basic_salary' => 7500000, 'fixed_allowance' => 750000]
        );

        // #9 Tax Konsultan - Reports to Spv(NN) → CEO
        $fakhruddin = $createUser(
            'fakhruddin@artacomindo.com', 'M. Fakhruddin Lubis', 'Staff', $nazirin->id, 'TAX001',
            'Tax-Konsultan', ['basic_salary' => 7500000, 'fixed_allowance' => 750000]
        );

        // #10 CC-EOS (under NN) - Reports to Spv(NN) → CEO
        $fachri = $createUser(
            'fachri@artacomindo.com', 'Raden Muhammad Fachri Alyubu', 'Staff', $nazirin->id, 'EOS001',
            'CC-EOS', ['basic_salary' => 6000000, 'fixed_allowance' => 600000]
        );

        // ------- NOC / OPERATIONAL (under Yulhan) -------
        // #14 Hub-Engineer - Reports to Kadiv-Direktur(Yulhan) → CEO
        $abas = $createUser(
            'abas@artacomindo.com', 'Agung Basuki Manto', 'Supervisor', $yulhan->id, 'ENG001',
            'Hub-Engineer', ['basic_salary' => 9000000, 'fixed_allowance' => 900000]
        );

        // #17 NOC Spv - Reports to Kadiv-Direktur(Yulhan) → CEO
        $ratno = $createUser(
            'ratno@artacomindo.com', 'Henratno Satiawan Karo En', 'Supervisor', $yulhan->id, 'NOC001',
            'NOC Spv.', ['basic_salary' => 9000000, 'fixed_allowance' => 900000]
        );

        // #18 Operasional Head - Reports to Kadiv-Direktur(Yulhan) → CEO
        $sigit = $createUser(
            'sigit@artacomindo.com', 'Sigit Purnomo Sejati', 'Supervisor', $yulhan->id, 'OPS001',
            'Operasional Head', ['basic_salary' => 9000000, 'fixed_allowance' => 900000]
        );

        // #32 Staff QC - Reports to Kadiv-Direktur(Yulhan) → CEO
        $fahri = $createUser(
            'fahri@artacomindo.com', 'Fahri Ismaun', 'Staff', $yulhan->id, 'QC001',
            'Staff QC', ['basic_salary' => 6000000, 'fixed_allowance' => 600000]
        );

        // ------- ENGINEERS (under Abas → Yulhan) -------
        // #15 Jr.Engineer - Reports to Spv(Abas) → Kadiv(Yulhan) → CEO
        $adolf = $createUser(
            'adolf@artacomindo.com', 'Adolf Renaldy', 'Staff', $abas->id, 'ENG002',
            'Jr.Engineer', ['basic_salary' => 5500000, 'fixed_allowance' => 550000]
        );

        // #16 Developer/Programer - Reports to Spv(Abas) → CEO (special path)
        $ahmadRizki = $createUser(
            'ahmad.rizki@artacomindo.com', 'Ahmad Rizki', 'Staff', $abas->id, 'DEV001',
            'Developer/Programer', ['basic_salary' => 6000000, 'fixed_allowance' => 600000]
        );

        // ------- NOC STAFF (under Ratno → Yulhan) -------
        // #12 Leader-NOC - Reports to Admin VP Proc(Diwan) → Kadiv → CEO
        $adeIrwan = $createUser(
            'ade.irwansyah@artacomindo.com', 'Ade Irwansyah', 'Leader', $diwan->id, 'NOC002',
            'Leader-NOC', ['basic_salary' => 7000000, 'fixed_allowance' => 700000]
        );

        // #13 Admin-Opjar - Reports to Kadiv(ZH) → Kadiv(Yulhan) → CEO
        $dwiWaluyo = $createUser(
            'dwi.waluyo@artacomindo.com', 'Dwi Waluyo', 'Staff', $zenHelmi->id, 'OPJ001',
            'Admin-Opjar', ['basic_salary' => 6000000, 'fixed_allowance' => 600000]
        );

        // #19 CC-EOS - Reports to Spv(Ratno) → Kadiv(Yulhan) → CEO
        $rizkiAris = $createUser(
            'rizki.arismansyah@artacomindo.com', 'Rizki Arismansyah', 'Staff', $ratno->id, 'EOS002',
            'CC-EOS', ['basic_salary' => 5500000, 'fixed_allowance' => 550000]
        );

        // #20 CC-EOS
        $ramdhani = $createUser(
            'ramdhani@artacomindo.com', 'Ramdhani Irchadi', 'Staff', $ratno->id, 'EOS003',
            'CC-EOS', ['basic_salary' => 5500000, 'fixed_allowance' => 550000]
        );

        // #21 NOC
        $koko = $createUser(
            'koko@artacomindo.com', 'Koko Aldi Renggani', 'Staff', $ratno->id, 'NOC003',
            'NOC', ['basic_salary' => 5500000, 'fixed_allowance' => 550000]
        );

        // #22 NOC
        $baihaqi = $createUser(
            'baihaqi@artacomindo.com', 'Baihaqi Alfatih', 'Staff', $ratno->id, 'NOC004',
            'NOC', ['basic_salary' => 5500000, 'fixed_allowance' => 550000]
        );

        // #23a NOC
        $irsyad = $createUser(
            'irsyad@artacomindo.com', 'Irsyad Maulana Adzmi', 'Staff', $ratno->id, 'NOC005',
            'NOC', ['basic_salary' => 5500000, 'fixed_allowance' => 550000]
        );

        // #23b NOC
        $raihans = $createUser(
            'raihans@artacomindo.com', 'Raihans Rivansyah', 'Staff', $ratno->id, 'NOC006',
            'NOC', ['basic_salary' => 5500000, 'fixed_allowance' => 550000]
        );

        // ------- FIELD ENGINEERS (under Etang → Yulhan) -------
        // #24 Field Engineer - Reports to Spv(Etang) → Kadiv(Yulhan) → CEO
        $yohan = $createUser(
            'yohan@artacomindo.com', 'Yohan Budiyanto', 'Supervisor', $etang->id, 'FLD001',
            'Field Engineer', ['basic_salary' => 7000000, 'fixed_allowance' => 700000]
        );

        // #25 FTTH-Clerk - Reports to Spv(Yohan) → Spv(Etang) → Kadiv(Yulhan) → CEO
        $aryan = $createUser(
            'aryan@artacomindo.com', 'Aryan Sulaiman', 'Clerk', $yohan->id, 'FTH001',
            'FTTH-Clerk', ['basic_salary' => 4500000, 'fixed_allowance' => 450000]
        );

        // #26 FTTH-Clerk
        $haytami = $createUser(
            'haytami@artacomindo.com', 'Muhamad Al Haytami', 'Clerk', $yohan->id, 'FTH002',
            'FTTH-Clerk', ['basic_salary' => 4500000, 'fixed_allowance' => 450000]
        );

        // #27 FTTH-Parama Serang
        $andriYusup = $createUser(
            'andri.yusup@artacomindo.com', 'Andri Yusup', 'Clerk', $yohan->id, 'FTH003',
            'FTTH-Parama Serang', ['basic_salary' => 4500000, 'fixed_allowance' => 450000]
        );

        // ------- FINANCE & ADMIN STAFF (under Haris → NN) -------
        // #28 Finance&Admin - Reports to Spv(Haris) → Admin VP(NN) → CEO
        $humairo = $createUser(
            'humairo@artacomindo.com', 'Humairo', 'Staff', $haris->id, 'FIN002',
            'Finance&Admin', ['basic_salary' => 5000000, 'fixed_allowance' => 500000]
        );

        // #29 Clerk-Administrasi - Reports to Haris → Kadiv(Yulhan) → CEO
        // Note: Excel says "pastikan lagi", using Haris as supervisor for now
        $fatimah = $createUser(
            'fatimah@artacomindo.com', 'Fatimah Azahra', 'Clerk', $haris->id, 'ADM001',
            'Clerk-Administrasi', ['basic_salary' => 4500000, 'fixed_allowance' => 450000]
        );

        // #30 OB - Reports to Spv(Haris) → Admin VP(NN) → CEO
        $adeDwiharjo = $createUser(
            'ade.dwiharjo@artacomindo.com', 'Ade Dwiharjo', 'OB', $haris->id, 'OB001',
            'OB', ['basic_salary' => 4000000, 'fixed_allowance' => 400000]
        );

        // #31 OB-CS - Reports to Spv(Haris) → Admin VP(NN) → CEO
        $andiSopandi = $createUser(
            'andi.sopandi@artacomindo.com', 'Andi Sopandi', 'OB', $haris->id, 'OB002',
            'OB-CS', ['basic_salary' => 4000000, 'fixed_allowance' => 400000]
        );

        // ------- NOC-BSI (under ZH) -------
        // #33 Teknisi - Reports to Sigit/Henratno → Kadiv(Yulhan) → CEO
        // Note: Excel says "pastikan lagi", using Sigit as supervisor for now
        $indra = $createUser(
            'indra@artacomindo.com', 'Indra Hasian Siregar', 'Staff', $sigit->id, 'TEK001',
            'Teknisi', ['basic_salary' => 5500000, 'fixed_allowance' => 550000]
        );

        // #34 NOC-BSI - Reports to Kadiv-Direktur(ZH) → CEO
        $tegar = $createUser(
            'tegar@artacomindo.com', 'Tegar Maulana Yusuf', 'Staff', $zenHelmi->id, 'BSI001',
            'NOC-BSI', ['basic_salary' => 5500000, 'fixed_allowance' => 550000]
        );

        // #35 NOC-BSI
        $ibrahim = $createUser(
            'ibrahim@artacomindo.com', 'Ibrahim Rajab Kurnia', 'Staff', $zenHelmi->id, 'BSI002',
            'NOC-BSI', ['basic_salary' => 5500000, 'fixed_allowance' => 550000]
        );

        // ═══════════════════════════════════════════════════════
        // 7. System Administrator (Super Admin)
        // ═══════════════════════════════════════════════════════
        User::updateOrCreate(
            ['email' => 'superadmin@example.com'],
            [
                'name' => 'System Administrator',
                'password' => $defaultPassword,
                'company_id' => $company->id,
                'office_id' => $office->id,
                'role_id' => $roles['Super Admin']->id,
                'nik' => 'ADMIN01',
                'join_date' => '2024-01-01',
                'basic_salary' => 6000000,
                'fixed_allowance' => 600000,
                'ptkp_status' => 'TK/0',
                'bank_name' => 'BCA',
                'bank_account_no' => '0000ADMIN01',
                'cost_center' => 'PT. Artacomindotama',
                'payroll_type' => 'monthly',
            ]
        );

        // ═══════════════════════════════════════════════════════
        // 6. Create Default Multi-Layer Approval Workflows
        // ═══════════════════════════════════════════════════════
        $workflowsData = [
            'leave' => [
                'name' => 'Alur Cuti Karyawan',
                'steps' => [
                    ['step_number' => 1, 'approver_type' => 'supervisor', 'sla_hours' => 24],
                    ['step_number' => 2, 'approver_type' => 'role', 'approver_role_id' => $roles['HRD']->id, 'sla_hours' => 24],
                    ['step_number' => 3, 'approver_type' => 'role', 'approver_role_id' => $roles['CEO / BOC']->id, 'sla_hours' => 24],
                ],
            ],
            'fund_request' => [
                'name' => 'Alur Permintaan Uang Muka / Kasbon',
                'steps' => [
                    ['step_number' => 1, 'approver_type' => 'supervisor', 'sla_hours' => 24],
                    ['step_number' => 2, 'approver_type' => 'role', 'approver_role_id' => $roles['Admin VP']->id, 'sla_hours' => 24],
                    ['step_number' => 3, 'approver_type' => 'role', 'approver_role_id' => $roles['Kadiv Direktur']->id, 'sla_hours' => 24],
                    ['step_number' => 4, 'approver_type' => 'role', 'approver_role_id' => $roles['CEO / BOC']->id, 'sla_hours' => 24],
                ],
            ],
            'reimbursement' => [
                'name' => 'Alur Klaim Reimbursement',
                'steps' => [
                    ['step_number' => 1, 'approver_type' => 'supervisor', 'sla_hours' => 24],
                    ['step_number' => 2, 'approver_type' => 'role', 'approver_role_id' => $roles['Admin VP']->id, 'sla_hours' => 24],
                    ['step_number' => 3, 'approver_type' => 'role', 'approver_role_id' => $roles['CEO / BOC']->id, 'sla_hours' => 24],
                ],
            ],
            'overtime' => [
                'name' => 'Alur Lembur Karyawan',
                'steps' => [
                    ['step_number' => 1, 'approver_type' => 'supervisor', 'sla_hours' => 24],
                    ['step_number' => 2, 'approver_type' => 'role', 'approver_role_id' => $roles['HRD']->id, 'sla_hours' => 24],
                ],
            ],
            'permit' => [
                'name' => 'Alur Izin Karyawan',
                'steps' => [
                    ['step_number' => 1, 'approver_type' => 'supervisor', 'sla_hours' => 24],
                    ['step_number' => 2, 'approver_type' => 'role', 'approver_role_id' => $roles['HRD']->id, 'sla_hours' => 24],
                ],
            ],
            'attendance_correction' => [
                'name' => 'Alur Koreksi Absen',
                'steps' => [
                    ['step_number' => 1, 'approver_type' => 'supervisor', 'sla_hours' => 24],
                    ['step_number' => 2, 'approver_type' => 'role', 'approver_role_id' => $roles['HRD']->id, 'sla_hours' => 24],
                ],
            ],
        ];

        foreach ($workflowsData as $moduleKey => $wfData) {
            $wf = ApprovalWorkflow::updateOrCreate(
                ['company_id' => $company->id, 'module_key' => $moduleKey],
                ['name' => $wfData['name'], 'is_active' => true]
            );

            $wf->steps()->delete();
            foreach ($wfData['steps'] as $s) {
                $wf->steps()->create([
                    'step_number' => $s['step_number'],
                    'approver_type' => $s['approver_type'],
                    'approver_role_id' => $s['approver_role_id'] ?? null,
                    'sla_hours' => $s['sla_hours'],
                ]);
            }
        }

        $this->command->info('✅ RealCompanySeeder: Created company, office, ' . User::count() . ' users, ' . Role::count() . ' roles, ' . ApprovalWorkflow::count() . ' workflows.');
    }
}
