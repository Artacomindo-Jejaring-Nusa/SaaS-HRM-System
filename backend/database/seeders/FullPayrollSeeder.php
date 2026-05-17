<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Company;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\Permit;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class FullPayrollSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Ensure Company Exists
        $company = Company::updateOrCreate(
            ['id' => 1],
            ['name' => 'Narwasthu Artha Tama', 'email' => 'corporate@narwastu.com']
        );

        // 2. Setup Roles
        $roles = ['Super Admin', 'CEO / Direktur Utama', 'HRD Manager', 'Staff Karyawan'];
        $roleObjects = [];
        foreach ($roles as $r) {
            $roleObjects[$r] = Role::firstOrCreate(['name' => $r]);
        }

        // 3. Create Target User: ahmad@ajnusa.com
        $user = User::updateOrCreate(
            ['email' => 'ahmad@ajnusa.com'],
            [
                'name' => 'Ahmad Rizki (CEO)',
                'password' => Hash::make('password'),
                'company_id' => $company->id,
                'role_id' => $roleObjects['CEO / Direktur Utama']->id,
                'nik' => 'CEO-001',
                'join_date' => '2020-01-01',
                'basic_salary' => 15000000,
                'bank_name' => 'BCA',
                'bank_account_no' => '1234567890',
                'cost_center' => 'Pusat',
                'ptkp_status' => 'K/0',
                'employment_status' => 'Permanent',
            ]
        );

        // 4. Generate Attendances for April 2026 (Working Days)
        $month = 4;
        $year = 2026;
        $startDate = Carbon::create($year, $month, 1);
        $endDate = Carbon::create($year, $month, 30);

        echo "Generating attendance for {$user->name}...\n";

        for ($date = $startDate->copy(); $date->lte($endDate); $date->addDay()) {
            // Skip weekends
            if ($date->isWeekend()) {
                continue;
            }

            // Skip some specific dates for Leave/Permit later
            if ($date->day == 15 || $date->day == 16) {
                continue;
            }

            $checkIn = $date->copy()->setTime(8, 0, 0);

            // Simulation: 3 days late (Late after 09:00)
            if ($date->day == 5) {
                $checkIn->setTime(9, 30, 0);
            } // 30 mins late
            if ($date->day == 10) {
                $checkIn->setTime(10, 0, 0);
            } // 1 hour late
            if ($date->day == 20) {
                $checkIn->setTime(11, 0, 0);
            } // 2 hours late

            // Use whereDate on check_in since 'date' column doesn't exist
            $exists = Attendance::where('user_id', $user->id)
                ->whereDate('check_in', $date->format('Y-m-d'))
                ->exists();

            if (! $exists) {
                Attendance::create([
                    'user_id' => $user->id,
                    'company_id' => $company->id,
                    'check_in' => $checkIn->format('Y-m-d H:i:s'),
                    'check_out' => $date->copy()->setTime(17, 0, 0)->format('Y-m-d H:i:s'),
                    'status' => 'present',
                    'latitude_in' => -6.2477,
                    'longitude_in' => 106.9493,
                ]);
            }
        }

        // 5. Generate Overtime (Lembur)
        echo "Generating overtime...\n";
        $overtimeDates = [7, 14, 21];
        foreach ($overtimeDates as $d) {
            Overtime::updateOrCreate(
                ['user_id' => $user->id, 'date' => Carbon::create($year, $month, $d)->format('Y-m-d')],
                [
                    'company_id' => $company->id,
                    'start_time' => Carbon::create($year, $month, $d, 17, 0, 0)->format('H:i:s'),
                    'end_time' => Carbon::create($year, $month, $d, 20, 0, 0)->format('H:i:s'), // 3 hours
                    'reason' => 'Meeting Akhir Hari',
                    'status' => 'approved',
                    'approved_by' => $user->id,
                ]
            );
        }

        // 6. Generate Leave (Cuti)
        echo "Generating leave...\n";
        Leave::updateOrCreate(
            ['user_id' => $user->id, 'start_date' => Carbon::create($year, $month, 15)->format('Y-m-d')],
            [
                'company_id' => $company->id,
                'end_date' => Carbon::create($year, $month, 15)->format('Y-m-d'),
                'type' => 'Cuti Tahunan',
                'reason' => 'Urusan Keluarga',
                'status' => 'approved',
                'approved_by' => $user->id,
            ]
        );

        // 7. Generate Permit (Izin/Sakit)
        echo "Generating permit...\n";
        Permit::updateOrCreate(
            ['user_id' => $user->id, 'start_date' => Carbon::create($year, $month, 16)->format('Y-m-d')],
            [
                'company_id' => $company->id,
                'end_date' => Carbon::create($year, $month, 16)->format('Y-m-d'),
                'type' => 'Sakit',
                'reason' => 'Demam',
                'status' => 'approved',
                'approved_by' => $user->id,
            ]
        );

        echo "Seeding completed! You can now generate payroll for April 2026.\n";
    }
}
