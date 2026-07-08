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
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $ahmad = User::where('email', 'ahmad@narwastu.com')->first();

        if (! $ahmad) {
            $this->command->error('User ahmad@narwastu.com not found!');

            return;
        }

        $companyId = $ahmad->company_id;
        $staffRole = Role::where('name', 'Staff Karyawan')->first();

        // Fetch real supervisors to map demo staff realistically
        $dedi = User::where('email', 'dedi@narwastu.com')->first();
        $johan = User::where('email', 'johan@narwastu.com')->first();
        $dediId = $dedi ? $dedi->id : $ahmad->id;
        $johanId = $johan ? $johan->id : $ahmad->id;

        // 1. Setup Payroll Settings for Demo
        PayrollSetting::updateOrCreate(
            ['company_id' => $companyId],
            [
                'cutoff_day' => 20,
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

        $users = User::where('company_id', $companyId)
            ->where('email', '!=', 'superadmin@example.com')
            ->get()
            ->all();

        $names = [
            'Bambang Wijaya',
            'Rian Hidayat',
            'Eko Susanto',
            'Sri Wahyuni',
            'Dewi Lestari',
            'Adi Kurniawan',
            'Taufik Hidayat',
            'Rina Wijaya',
            'Hendra Saputra'
        ];

        // 3. Create 9 additional users
        for ($i = 1; $i <= 9; $i++) {
            // Distribute supervisors: 1-5 under Dedi, 6-9 under Johan
            $empSupervisorId = ($i <= 5) ? $dediId : $johanId;
            $costCenters = ['PT. Artacomindotama', 'PT. Narwastu', 'AJNusa'];
            $ptkpList = ['TK/0', 'TK/1', 'TK/2'];

            $users[] = User::create([
                'name' => $names[$i - 1],
                'email' => "demo_staff_{$i}@narwastu.com",
                'password' => Hash::make('password'),
                'company_id' => $companyId,
                'role_id' => $staffRole->id,
                'supervisor_id' => $empSupervisorId,
                'nik' => '2026' . str_pad($i, 4, '0', STR_PAD_LEFT),
                'basic_salary' => rand(4500000, 8000000),
                'ptkp_status' => $ptkpList[($i - 1) % 3],
                'bank_name' => 'BCA',
                'bank_account_no' => '1090128' . rand(100, 999),
                'cost_center' => $costCenters[($i - 1) % 3],
            ]);
        }

        $today = Carbon::now()->startOfDay();
        $startOfPeriod = Carbon::create(2026, 6, 21)->startOfDay();
        $endOfPeriod = Carbon::create(2026, 7, 20)->startOfDay();

        // 4. Generate data for each user
        foreach ($users as $user) {

            // Assign random days for leave (1-2 days) in late June
            $leaveCount = rand(1, 2);
            $leaveDays = [];
            for ($l = 0; $l < $leaveCount; $l++) {
                $leaveDay = rand(22, 28);
                $leaveDays[] = $leaveDay;

                Leave::create([
                    'user_id' => $user->id,
                    'company_id' => $companyId,
                    'type' => 'annual',
                    'start_date' => Carbon::create(2026, 6, $leaveDay)->toDateString(),
                    'end_date' => Carbon::create(2026, 6, $leaveDay)->toDateString(),
                    'reason' => 'Cuti Tahunan',
                    'status' => 'approved',
                ]);
            }

            // Assign random days for permit (1-2 days) in late June
            $permitCount = rand(1, 2);
            $permitDays = [];
            for ($p = 0; $p < $permitCount; $p++) {
                $permitDay = rand(22, 28);
                // Make sure it doesn't overlap with leave
                while (in_array($permitDay, $leaveDays)) {
                    $permitDay = rand(22, 28);
                }
                $permitDays[] = $permitDay;

                Permit::create([
                    'user_id' => $user->id,
                    'company_id' => $companyId,
                    'type' => 'sick',
                    'start_date' => Carbon::create(2026, 6, $permitDay)->toDateString(),
                    'end_date' => Carbon::create(2026, 6, $permitDay)->toDateString(),
                    'reason' => 'Izin Sakit',
                    'status' => 'approved',
                ]);
            }

            // Loop through each day of the period (June 21 - July 20)
            for ($date = clone $startOfPeriod; $date->lte($endOfPeriod); $date->addDay()) {
                if ($date->isWeekend()) {
                    continue;
                }
                if ($date->month == 6) {
                    if (in_array($date->day, $leaveDays)) {
                        continue;
                    }
                    if (in_array($date->day, $permitDays)) {
                        continue;
                    }
                }

                // Skip today for Ahmad so user can demonstrate Live Attendance
                if ($user->id === $ahmad->id && $date->isSameDay($today)) {
                    continue;
                }

                // Realistic Check-In before 09:00 AM (e.g. 08:00 - 08:15) so there is 0 late deduction
                $checkIn = (clone $date)->setTime(8, rand(0, 15), rand(0, 59));
                $checkOut = (clone $date)->setTime(17, rand(0, 15), rand(0, 59));
                $status = 'present';

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
