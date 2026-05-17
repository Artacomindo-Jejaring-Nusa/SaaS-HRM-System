<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Company;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\PayrollSetting;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DummyPayrollDataSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();
        if (! $company) {
            $company = Company::create(['name' => 'PT On Time HRMS', 'email' => 'contact@ontime.com']);
        }

        $staffRole = Role::where('name', 'Staff Karyawan')->first();

        // 1. Setup Payroll Settings
        PayrollSetting::updateOrCreate(
            ['company_id' => $company->id],
            [
                'cutoff_day' => 25,
                'bpjs_kesehatan_coy_pct' => 4,
                'bpjs_kesehatan_emp_pct' => 1,
                'bpjs_jht_coy_pct' => 3.7,
                'bpjs_jht_emp_pct' => 2,
                'bpjs_jp_coy_pct' => 2,
                'bpjs_jp_emp_pct' => 1,
                'bpjs_jkm_pct' => 0.3,
                'bpjs_jkk_pct' => 0.24,
                'tax_method' => 'TER (PP 58/2023)',
            ]
        );

        // 2. Create Employees with Varied PTKP & Salary
        $employees = [
            [
                'name' => 'Anto Prasetia',
                'email' => 'anto@example.com',
                'basic_salary' => 5000000,
                'ptkp_status' => 'TK/0',
            ],
            [
                'name' => 'Budi Santoso',
                'email' => 'budi@example.com',
                'basic_salary' => 7500000,
                'ptkp_status' => 'K/1',
            ],
            [
                'name' => 'Citra Lestari',
                'email' => 'citra@example.com',
                'basic_salary' => 10000000,
                'ptkp_status' => 'K/3',
            ],
            [
                'name' => 'Dedi Wijaya',
                'email' => 'dedi@example.com',
                'basic_salary' => 15000000,
                'ptkp_status' => 'TK/2',
            ],
        ];

        $supervisor = User::whereHas('role', function ($q) {
            $q->where('name', 'Supervisor');
        })->first();

        foreach ($employees as $empData) {
            $user = User::updateOrCreate(
                ['email' => $empData['email']],
                [
                    'name' => $empData['name'],
                    'password' => Hash::make('password'),
                    'company_id' => $company->id,
                    'role_id' => $staffRole->id,
                    'supervisor_id' => $supervisor ? $supervisor->id : null,
                    'basic_salary' => $empData['basic_salary'],
                    'fixed_allowance' => $empData['basic_salary'] * 0.1, // 10% allowance
                    'ptkp_status' => $empData['ptkp_status'],
                    'payroll_type' => 'monthly',
                    'bank_name' => 'BCA',
                    'bank_account_no' => '1234567890',
                    'join_date' => '2023-01-01',
                ]
            );

            // 3. Generate Attendance for Current Month (Mock)
            $this->seedAttendance($user);

            // 4. Generate some Overtimes
            $this->seedOvertime($user);

            // 5. Generate a Leave
            $this->seedLeave($user);
        }
    }

    private function seedAttendance($user)
    {
        $start = Carbon::now()->startOfMonth();
        $today = Carbon::now();

        for ($date = $start; $date->lte($today); $date->addDay()) {
            if ($date->isWeekend()) {
                continue;
            }

            Attendance::create([
                'user_id' => $user->id,
                'company_id' => $user->company_id,
                'check_in' => $date->copy()->setTime(8, 0, 0),
                'check_out' => $date->copy()->setTime(17, 0, 0),
                'status' => 'present',
                'latitude_in' => -6.2088,
                'longitude_in' => 106.8456,
            ]);
        }
    }

    private function seedOvertime($user)
    {
        Overtime::create([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'date' => Carbon::now()->subDays(2)->toDateString(),
            'start_time' => '17:00:00',
            'end_time' => '20:00:00',
            'reason' => 'Meeting Akhir Bulan',
            'status' => 'approved',
        ]);
    }

    private function seedLeave($user)
    {
        Leave::create([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'type' => 'annual',
            'start_date' => Carbon::now()->subDays(10)->toDateString(),
            'end_date' => Carbon::now()->subDays(9)->toDateString(),
            'reason' => 'Urusan Keluarga',
            'status' => 'approved',
        ]);
    }
}
