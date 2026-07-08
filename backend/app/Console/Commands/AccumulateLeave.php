<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\ActivityLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class AccumulateLeave extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'leave:accumulate-annual';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Accumulate remaining annual leave to the next year (triggered at the end of December)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting annual leave accumulation and reset...');
        Log::info('Annual Leave Reset: Job started.');

        $users = User::whereNotNull('company_id')->get();
        $count = 0;

        foreach ($users as $user) {
            $oldBalance = $user->leave_balance ?? 0;
            $newBalance = 12 + $oldBalance; // Accumulate: 12 base + remaining leave

            $user->leave_balance = $newBalance;
            $user->save();

            // Log activity
            ActivityLog::create([
                'company_id' => $user->company_id,
                'user_id' => null, // Run by system
                'action' => 'ANNUAL_LEAVE_ACCUMULATION',
                'description' => "Akumulasi cuti tahunan otomatis untuk {$user->name}. Sisa cuti sebelumnya: {$oldBalance} Hari, Jatah baru: {$newBalance} Hari.",
                'model_type' => User::class,
                'model_id' => $user->id,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'CLI / Scheduler',
                'old_values' => json_encode(['leave_balance' => $oldBalance]),
                'new_values' => json_encode(['leave_balance' => $newBalance]),
                'module' => 'Leave',
            ]);

            $count++;
        }

        $this->info("Successfully accumulated leave for {$count} employees.");
        Log::info("Annual Leave Reset: Job finished. Reset {$count} employees.");
    }
}
