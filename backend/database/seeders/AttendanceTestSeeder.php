<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Company;
use App\Models\Overtime;
use App\Models\Permit;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class AttendanceTestSeeder extends Seeder
{
    public function run()
    {
        $company = Company::first();
        if (! $company) {
            return;
        }

        $users = User::where('company_id', $company->id)->get();

        // Target: April 2026
        $month = 4;
        $year = 2026;
        $startDate = Carbon::createFromDate($year, $month, 1);
        $endDate = $startDate->copy()->endOfMonth();

        // Clear existing test data for this period to avoid duplicates
        Attendance::whereMonth('check_in', $month)->whereYear('check_in', $year)->delete();
        Permit::whereMonth('start_date', $month)->whereYear('start_date', $year)->delete();
        Overtime::whereMonth('date', $month)->whereYear('date', $year)->delete();

        foreach ($users as $user) {
            $this->command->info("Seeding attendance for: {$user->name}");

            for ($date = $startDate->copy(); $date->lte($endDate); $date->addDay()) {
                $isWeekend = $date->isWeekend();

                if (! $isWeekend) {
                    $rand = rand(1, 100);

                    if ($rand <= 85) {
                        // Regular Attendance
                        Attendance::create([
                            'user_id' => $user->id,
                            'company_id' => $company->id,
                            'check_in' => $date->copy()->setHour(8)->setMinute(rand(0, 30)),
                            'check_out' => $date->copy()->setHour(17)->setMinute(rand(0, 15)),
                            'status' => 'present',
                        ]);
                    } elseif ($rand <= 90) {
                        // Lupa Absen Pulang (Missing Checkout)
                        Attendance::create([
                            'user_id' => $user->id,
                            'company_id' => $company->id,
                            'check_in' => $date->copy()->setHour(8)->setMinute(rand(0, 30)),
                            'check_out' => null,
                            'status' => 'present',
                        ]);
                    } elseif ($rand <= 95) {
                        // Sakit (Permit)
                        Permit::create([
                            'user_id' => $user->id,
                            'company_id' => $company->id,
                            'start_date' => $date->format('Y-m-d'),
                            'end_date' => $date->format('Y-m-d'),
                            'type' => 'Sakit',
                            'reason' => 'Demam tinggi',
                            'status' => 'approved',
                            'approved_by' => 1,
                        ]);
                    } else {
                        // Alpha (No record)
                    }

                    // Occasional Overtime on weekdays
                    if (rand(1, 10) > 8) {
                        Overtime::create([
                            'user_id' => $user->id,
                            'company_id' => $company->id,
                            'date' => $date->format('Y-m-d'),
                            'start_time' => '17:30',
                            'end_time' => '20:00',
                            'reason' => 'Kejar deadline project',
                            'status' => 'approved',
                            'approved_by' => 1,
                        ]);
                    }
                } else {
                    // Weekend Overtime (Rare)
                    if (rand(1, 20) === 1) {
                        Overtime::create([
                            'user_id' => $user->id,
                            'company_id' => $company->id,
                            'date' => $date->format('Y-m-d'),
                            'start_time' => '09:00',
                            'end_time' => '15:00',
                            'reason' => 'Lembur akhir pekan',
                            'status' => 'approved',
                            'approved_by' => 1,
                        ]);
                    }
                }
            }
        }

        $this->command->info('Seeder Absensi Berhasil! Data April 2026 siap diuji.');
    }
}
