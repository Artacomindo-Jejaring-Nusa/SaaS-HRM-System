<?php

namespace Database\Seeders;

use App\Models\Leave;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class LeaveSeeder extends Seeder
{
    public function run(): void
    {
        $users = User::whereHas('role', function ($q) {
            $q->where('name', '!=', 'Super Admin');
        })->get();

        foreach ($users as $user) {
            // Give 1-2 random leaves in the last 2 months
            for ($i = 0; $i < rand(1, 2); $i++) {
                $start = Carbon::now()->subDays(rand(5, 45));
                $end = (clone $start)->addDays(rand(1, 3));

                Leave::create([
                    'user_id' => $user->id,
                    'company_id' => $user->company_id,
                    'type' => 'annual',
                    'start_date' => $start->toDateString(),
                    'end_date' => $end->toDateString(),
                    'reason' => 'Keperluan Keluarga',
                    'status' => 'approved',
                    'approved_by' => User::where('role_id', 1)->first()->id, // Super Admin/Manager
                ]);
            }
        }
    }
}
