<?php

namespace Database\Seeders;

use App\Models\Overtime;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class OvertimeSeeder extends Seeder
{
    public function run(): void
    {
        $users = User::whereHas('role', function ($q) {
            $q->where('name', '!=', 'Super Admin');
        })->get();

        foreach ($users as $user) {
            // 2-3 random approved overtimes
            for ($i = 0; $i < rand(2, 3); $i++) {
                $date = Carbon::now()->subDays(rand(1, 15));

                Overtime::create([
                    'user_id' => $user->id,
                    'company_id' => $user->company_id,
                    'date' => $date->toDateString(),
                    'start_time' => '17:00:00',
                    'end_time' => '20:00:00',
                    'reason' => 'Penyelesaian Deadline Proyek',
                    'status' => 'approved',
                    'approved_by' => User::where('role_id', 1)->first()->id,
                ]);
            }
        }
    }
}
