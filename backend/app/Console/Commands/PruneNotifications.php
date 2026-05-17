<?php

namespace App\Console\Commands;

use App\Models\Notification;
use Carbon\Carbon;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('notifications:prune')]
#[Description('Prune old notifications to optimize database performance')]
class PruneNotifications extends Command
{
    /**
     * Execute the console command.
     */
    public function handle()
    {
        $days = 30;
        $date = Carbon::now()->subDays($days);

        $count = Notification::where('created_at', '<', $date)->delete();

        $this->info("Successfully pruned {$count} old notifications (older than {$days} days).");
    }
}
