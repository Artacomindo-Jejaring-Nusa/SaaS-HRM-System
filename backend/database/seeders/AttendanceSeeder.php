<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class AttendanceSeeder extends Seeder
{
    public function run(): void
    {
        $users = User::all();
        $start = Carbon::now()->startOfMonth();
        $today = Carbon::now();

        foreach ($users as $user) {
            for ($date = clone $start; $date->lte($today); $date->addDay()) {
                if ($date->isWeekend()) {
                    continue;
                }

                // Randomize slightly the check-in time around 08:00
                $checkIn = clone $date;
                $checkIn->setTime(7, rand(45, 59), rand(0, 59));

                // Randomize check-out around 17:00
                $checkOut = clone $date;
                $checkOut->setTime(17, rand(0, 30), rand(0, 59));

                Attendance::updateOrCreate(
                    ['user_id' => $user->id, 'created_at' => $date->toDateString()],
                    [
                        'company_id' => $user->company_id,
                        'check_in' => $checkIn,
                        'check_out' => $checkOut,
                        'status' => 'present',
                        'latitude_in' => -6.2088,
                        'longitude_in' => 106.8456,
                        'created_at' => $date, // To ensure reports find them in the right month
                        'updated_at' => $date,
                    ]
                );
            }
        }
    }
}
