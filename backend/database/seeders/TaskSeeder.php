<?php

namespace Database\Seeders;

use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class TaskSeeder extends Seeder
{
    public function run()
    {
        $superAdmin = User::whereHas('role', function ($q) {
            $q->where('name', 'Super Admin');
        })->first();
        if (! $superAdmin) {
            return;
        }

        $staff = User::whereHas('role', function ($q) {
            $q->where('name', 'Karyawan');
        })->first();
        if (! $staff) {
            return;
        }

        $tasks = [
            [
                'company_id' => $superAdmin->company_id,
                'assigned_by' => $superAdmin->id,
                'user_id' => $staff->id,
                'title' => 'Laporan Mingguan Maret',
                'description' => 'Segera kumpulkan laporan mingguan untuk bulan Maret sebelum hari Jumat.',
                'status' => 'pending',
                'priority' => 3, // High
                'deadline' => Carbon::now()->addDays(2),
            ],
            [
                'company_id' => $superAdmin->company_id,
                'assigned_by' => $superAdmin->id,
                'user_id' => $staff->id,
                'title' => 'Update Dokumentasi API',
                'description' => 'Perbarui dokumentasi API untuk modul Tasks yang baru saja kita kerjakan.',
                'status' => 'ongoing',
                'priority' => 2, // Medium
                'deadline' => Carbon::now()->addDays(5),
            ],
            [
                'company_id' => $superAdmin->company_id,
                'assigned_by' => $staff->id,
                'user_id' => $superAdmin->id,
                'title' => 'Request Review Performa',
                'description' => 'Mohon review performa saya untuk kuartal ini.',
                'status' => 'pending',
                'priority' => 1, // Low
                'deadline' => Carbon::now()->addDays(7),
            ],
        ];

        foreach ($tasks as $task) {
            Task::create($task);
        }
    }
}
