<?php

namespace App\Console\Commands;

use App\Models\Leave;
use App\Models\Permit;
use App\Models\User;
use App\Services\WhatsAppService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendApprovalReminder extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'approvals:remind-pending';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send WhatsApp reminder to supervisors for pending approval requests';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Checking for pending approval requests...');

        $pendingLeaves = $this->getPendingLeaves();
        $pendingPermits = $this->getPendingPermits();

        $supervisorIds = $pendingLeaves->keys()->concat($pendingPermits->keys())->unique()->filter();

        if ($supervisorIds->isEmpty()) {
            $this->info('No pending approvals found.');
            return;
        }

        $count = $this->notifySupervisors($supervisorIds, $pendingLeaves, $pendingPermits);

        $this->info("Total reminders sent to supervisors: {$count}");
        Log::info("Approval Reminder: Sent {$count} WhatsApp reminders to supervisors.");
    }

    private function getPendingLeaves()
    {
        return Leave::whereIn('status', ['pending_supervisor', 'pending_hr'])
            ->get()
            ->groupBy(function ($item) {
                return $item->user->supervisor_id;
            });
    }

    private function getPendingPermits()
    {
        return Permit::whereIn('status', ['pending', 'pending_supervisor', 'pending_hr'])
            ->get()
            ->groupBy(function ($item) {
                return $item->user->supervisor_id;
            });
    }

    private function notifySupervisors($supervisorIds, $pendingLeaves, $pendingPermits): int
    {
        $count = 0;
        foreach ($supervisorIds as $supervisorId) {
            if ($this->notifySupervisor($supervisorId, $pendingLeaves, $pendingPermits)) {
                $count++;
            }
        }
        return $count;
    }

    private function notifySupervisor($supervisorId, $pendingLeaves, $pendingPermits): bool
    {
        $supervisor = User::with('company')->find($supervisorId);
        if (! $supervisor || ! $supervisor->phone) {
            return false;
        }

        $leafCount = isset($pendingLeaves[$supervisorId]) ? $pendingLeaves[$supervisorId]->count() : 0;
        $permitCount = isset($pendingPermits[$supervisorId]) ? $pendingPermits[$supervisorId]->count() : 0;

        $total = $leafCount + $permitCount;
        if ($total === 0) {
            return false;
        }

        $message = $this->buildMessage($supervisor->name, $total, $leafCount, $permitCount);

        $waService = new WhatsAppService($supervisor->company);
        $isSent = $waService->sendMessage($supervisor->phone, $message);
        
        if ($isSent) {
            $this->info("Reminder sent to Supervisor: {$supervisor->name}");
        }

        return $isSent;
    }

    private function buildMessage(string $name, int $total, int $leafCount, int $permitCount): string
    {
        $message = "Halo *{$name}*,\n\nAda *{$total} permohonan baru* yang membutuhkan persetujuan Anda:\n";
        
        if ($leafCount > 0) {
            $message .= "- Cuti: {$leafCount} pengajuan\n";
        }
        if ($permitCount > 0) {
            $message .= "- Izin/Sakit: {$permitCount} pengajuan\n";
        }
        
        $message .= "\nMohon segera tinjau melalui Dashboard HRMS. Terima kasih!";

        return $message;
    }
}
