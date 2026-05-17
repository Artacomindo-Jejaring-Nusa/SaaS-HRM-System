<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\PayrollSetting;
use App\Models\Permit;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Faker\Factory as Faker;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $faker = Faker::create('id_ID');

        $ahmad = User::where('email', 'ahmad@ajnusa.com')->first();

        if (! $ahmad) {
            $this->command->error('User ahmad@ajnusa.com not found!');

            return;
        }

        $companyId = $ahmad->company_id;
        $supervisorId = $ahmad->supervisor_id;
        $staffRole = Role::where('name', 'Staff Karyawan')->first();

        // 1. Setup Payroll Settings for Demo
        PayrollSetting::updateOrCreate(
            ['company_id' => $companyId],
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

        // 2. Clear old data to prevent duplication (safe fallback)
        Attendance::query()->delete();
        Leave::query()->delete();
        Overtime::query()->delete();
        Permit::query()->delete();

        // Remove other generated staffs if any, to keep it clean (only Ahmad and new ones)
        User::where('email', 'like', 'demo_staff_%')->delete();

        $users = [$ahmad];

        // 3. Create 9 additional users
        for ($i = 1; $i <= 9; $i++) {
            $users[] = User::create([
                'name' => $faker->name,
                'email' => "demo_staff_{$i}@ajnusa.com",
                'password' => Hash::make('password'),
                'company_id' => $companyId,
                'role_id' => $staffRole->id,
                'supervisor_id' => $supervisorId,
                'nik' => '2026'.str_pad($i, 4, '0', STR_PAD_LEFT),
                'basic_salary' => $faker->numberBetween(4500000, 8000000),
                'ptkp_status' => 'TK/0',
                'bank_name' => 'BCA',
                'bank_account_no' => $faker->bankAccountNumber,
            ]);
        }

        $startOfMonth = Carbon::now()->startOfMonth();
        $today = Carbon::now()->startOfDay();

        // 4. Generate data for each user
        foreach ($users as $user) {

            // Assign random days for leave (1-2 days)
            $leaveCount = rand(1, 2);
            $leaveDays = [];
            for ($l = 0; $l < $leaveCount; $l++) {
                $leaveDay = rand(2, 28);
                $leaveDays[] = $leaveDay;

                Leave::create([
                    'user_id' => $user->id,
                    'company_id' => $companyId,
                    'type' => 'annual',
                    'start_date' => (clone $startOfMonth)->addDays($leaveDay - 1)->toDateString(),
                    'end_date' => (clone $startOfMonth)->addDays($leaveDay - 1)->toDateString(),
                    'reason' => 'Cuti Tahunan',
                    'status' => 'approved',
                ]);
            }

            // Assign random days for permit (1-2 days)
            $permitCount = rand(1, 2);
            $permitDays = [];
            for ($p = 0; $p < $permitCount; $p++) {
                $permitDay = rand(2, 28);
                // Make sure it doesn't overlap with leave
                while (in_array($permitDay, $leaveDays)) {
                    $permitDay = rand(2, 28);
                }
                $permitDays[] = $permitDay;

                Permit::create([
                    'user_id' => $user->id,
                    'company_id' => $companyId,
                    'type' => 'sick',
                    'start_date' => (clone $startOfMonth)->addDays($permitDay - 1)->toDateString(),
                    'end_date' => (clone $startOfMonth)->addDays($permitDay - 1)->toDateString(),
                    'reason' => 'Izin Sakit',
                    'status' => 'approved',
                ]);
            }

            // Loop through each day of the month
            for ($date = clone $startOfMonth; $date->lte($today); $date->addDay()) {
                if ($date->isWeekend()) {
                    continue;
                }
                if (in_array($date->day, $leaveDays)) {
                    continue;
                }
                if (in_array($date->day, $permitDays)) {
                    continue;
                }

                // Skip today for Ahmad so user can demonstrate Live Attendance
                if ($user->id === $ahmad->id && $date->isSameDay($today)) {
                    continue;
                }

                // Determine Late vs On Time (30% chance late)
                $isLate = rand(1, 100) <= 30;

                if ($isLate) {
                    $checkIn = (clone $date)->setTime(rand(8, 9), rand(15, 59), 0);
                    $status = 'late';
                } else {
                    $checkIn = (clone $date)->setTime(7, rand(30, 59), 0);
                    $status = 'present';
                }

                $checkOut = (clone $date)->setTime(17, rand(0, 30), 0);

                Attendance::create([
                    'user_id' => $user->id,
                    'company_id' => $companyId,
                    'check_in' => $checkIn,
                    'check_out' => $checkOut,
                    'status' => $status,
                    'latitude_in' => -6.2088,
                    'longitude_in' => 106.8456,
                    'latitude_out' => -6.2088,
                    'longitude_out' => 106.8456,
                ]);

                // Determine Overtime (20% chance on a present day)
                if (rand(1, 100) <= 20 && $date->notEqualTo($today)) {
                    $otStart = (clone $checkOut);
                    $otEnd = (clone $checkOut)->addHours(rand(2, 4));

                    Overtime::create([
                        'user_id' => $user->id,
                        'company_id' => $companyId,
                        'date' => $date->toDateString(),
                        'start_time' => $otStart->toTimeString(),
                        'end_time' => $otEnd->toTimeString(),
                        'reason' => 'Lembur Pekerjaan Tambahan',
                        'status' => 'approved',
                    ]);
                }
            }
        }

        $this->command->info('Massive Demo data generated successfully for 10 users!');
    }
}
