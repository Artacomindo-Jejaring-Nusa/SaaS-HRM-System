<?php

namespace App\Console\Commands;

use App\Models\AttendanceDevice;
use App\Services\AttendanceDeviceSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class PollAttendanceDevices extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'attendance:poll-devices';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Poll active fingerprint attendance devices and sync attendance records';

    /**
     * Execute the console command.
     */
    public function handle(AttendanceDeviceSyncService $syncService): int
    {
        $devices = AttendanceDevice::where('is_active', true)->get();

        if ($devices->isEmpty()) {
            $this->info('No active attendance devices found.');
            return self::SUCCESS;
        }

        $this->info("Found {$devices->count()} active device(s). Starting sync...");

        foreach ($devices as $device) {
            $this->line("Syncing device [ID: {$device->id}] {$device->name} ({$device->ip_address}:{$device->port})...");
            $result = $syncService->syncDeviceLogs($device);

            if ($result['success']) {
                $this->info("✓ Success: {$result['message']}");
            } else {
                $this->error("✗ Failed: {$result['message']}");
            }
        }

        $this->info('All active devices polled successfully.');
        return self::SUCCESS;
    }
}
