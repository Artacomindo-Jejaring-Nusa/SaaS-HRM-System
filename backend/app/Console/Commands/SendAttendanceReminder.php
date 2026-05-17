<?php

namespace App\Console\Commands;

use App\Models\Attendance;
use App\Services\WhatsAppService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendAttendanceReminder extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'attendance:remind-checkout';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send WhatsApp reminder to employees who forget to check-out';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $today = Carbon::today();
        $this->info("Checking for employees who haven't checked out today ({$today->toDateString()})...");

        // Find users who checked in today but have NULL check_out
        $attendances = Attendance::whereDate('check_in', $today)
            ->whereNull('check_out')
            ->with('user.company')
            ->get();

        if ($attendances->isEmpty()) {
            $this->info('All employees have checked out or no check-ins found.');

            return;
        }

        $count = 0;

        foreach ($attendances as $attendance) {
            $user = $attendance->user;

            if (! $user || ! $user->phone) {
                continue;
            }

            $waService = new WhatsAppService($user->company);

            $message = "Halo *{$user->name}*,\n\nKami melihat Anda sudah melakukan Absen Masuk, namun *belum melakukan Absen Keluar* hari ini.\n\nJangan lupa untuk melakukan Absen Keluar di aplikasi HRMS sebelum pulang agar data kehadiran Anda tercatat dengan lengkap. Terima kasih!";

            if ($waService->sendMessage($user->phone, $message)) {
                $count++;
                $this->info("Reminder sent to {$user->name} ({$user->phone})");
            } else {
                $this->error("Failed to send reminder to {$user->name}");
            }
        }

        $this->info("Total reminders sent: {$count}");
        Log::info("Attendance Reminder: Sent {$count} WhatsApp reminders for checkout.");
    }
}
