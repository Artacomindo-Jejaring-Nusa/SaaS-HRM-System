<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\AttendanceDevice;
use App\Models\Schedule;
use App\Models\User;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Facades\Log;

class AttendanceDeviceSyncService
{
    public function __construct(
        protected ZKTecoService $zkService
    ) {}

    /**
     * Test connection to device and update status.
     */
    public function testDevice(AttendanceDevice $device): array
    {
        try {
            $info = $this->zkService->testConnection(
                $device->ip_address,
                $device->port,
                4,
                (int) ($device->comm_key ?? 0)
            );

            $device->update([
                'status' => 'online',
                'serial_number' => $info['serial_number'] ?? $device->serial_number,
                'last_error' => null,
            ]);

            return [
                'success' => true,
                'message' => 'Berhasil terhubung ke mesin presensi.',
                'data' => $info,
            ];
        } catch (Exception $e) {
            $device->update([
                'status' => 'error',
                'last_error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => $e->getMessage(),
                'data' => null,
            ];
        }
    }

    /**
     * Pull attendance logs from device and record into database.
     */
    /**
     * Pull attendance logs from device and record into database.
     */
    public function syncDeviceLogs(AttendanceDevice $device): array
    {
        try {
            $logs = $this->zkService->getAttendanceLogs(
                $device->ip_address,
                $device->port,
                6,
                (int) ($device->comm_key ?? 0)
            );
            return $this->ingestLogs($device, $logs);
        } catch (Exception $e) {
            $device->update([
                'status' => 'error',
                'last_error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Gagal sinkronisasi mesin: ' . $e->getMessage(),
                'processed' => 0,
                'unmapped' => [],
            ];
        }
    }

    /**
     * Ingest an array of attendance logs into database (from agent or file upload).
     */
    public function ingestLogs(AttendanceDevice $device, array $logs): array
    {
        $device->update([
            'status' => 'online',
            'last_sync_at' => now(),
            'last_error' => null,
        ]);

        if (empty($logs)) {
            return [
                'success' => true,
                'message' => 'Tidak ada log presensi baru yang diproses.',
                'processed' => 0,
                'unmapped' => [],
            ];
        }

        $processedCount = 0;
        $unmappedPins = [];

        // Sort logs chronologically
        usort($logs, fn($a, $b) => strcmp($a['timestamp'] ?? '', $b['timestamp'] ?? ''));

        foreach ($logs as $log) {
            if ($this->processSingleLog($log, $device, $unmappedPins)) {
                $processedCount++;
            }
        }

        return [
            'success' => true,
            'message' => "Berhasil memproses {$processedCount} log presensi dari mesin.",
            'processed' => $processedCount,
            'unmapped' => array_keys($unmappedPins),
        ];
    }

    /**
     * Parse raw text/dat/csv content exported from Solution X100-C USB flashdisk.
     */
    public function parseLogFile(string $content): array
    {
        $lines = preg_split('/\r\n|\r|\n/', trim($content));
        $logs = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || str_starts_with($line, '#')) {
                continue;
            }

            // Match PIN and DateTime in standard formats:
            // e.g. "101\t2026-10-23 08:00:15\t1\t0" or "101,2026-10-23 08:00:15"
            if (preg_match('/^([0-9a-zA-Z_-]+)[\s,;]+(\d{4}[-\/]\d{2}[-\/]\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/', $line, $matches)) {
                $logs[] = [
                    'pin' => $matches[1],
                    'timestamp' => str_replace('/', '-', $matches[2]),
                ];
            }
        }

        return $logs;
    }

    private function processSingleLog(array $log, AttendanceDevice $device, array &$unmappedPins): bool
    {
        $user = $this->resolveLogUser($log, $device, $unmappedPins);
        if (!$user) {
            return false;
        }

        $logTime = Carbon::parse($log['timestamp']);

        return $this->recordAttendanceCheck($user, $logTime);
    }

    private function resolveLogUser(array $log, AttendanceDevice $device, array &$unmappedPins): ?User
    {
        $pin = (string) ($log['pin'] ?? '');
        $timestampStr = $log['timestamp'] ?? '';

        if (empty($pin) || empty($timestampStr)) {
            return null;
        }

        $user = User::where('company_id', $device->company_id)
            ->where(function ($q) use ($pin) {
                $q->where('fingerprint_pin', $pin)
                  ->orWhere('nik', $pin);
            })
            ->first();

        if (!$user) {
            $unmappedPins[$pin] = true;
            return null;
        }

        return $user;
    }

    private function recordAttendanceCheck(User $user, Carbon $logTime): bool
    {
        $attendance = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', $logTime->toDateString())
            ->first();

        if (!$attendance) {
            $status = $this->resolveCheckInStatus($user, $logTime);
            Attendance::create([
                'user_id' => $user->id,
                'company_id' => $user->company_id,
                'office_id' => $user->office_id,
                'check_in' => $logTime,
                'status' => $status,
                'attendance_type' => 'fingerprint',
                'channel' => 'fingerprint',
            ]);
            return true;
        }

        if ($logTime->diffInMinutes($attendance->check_in) >= 15 && (!$attendance->check_out || $logTime->gt($attendance->check_out))) {
            $attendance->update([
                'check_out' => $logTime,
            ]);
            return true;
        }

        return false;
    }

    private function resolveCheckInStatus(User $user, Carbon $now): string
    {
        if ($user->attendance_type === 'flexible') {
            return 'present';
        }

        $dateKey = $now->toDateString();
        $schedule = Schedule::with('shift')
            ->where('user_id', $user->id)
            ->where('date', $dateKey)
            ->first();

        if ($user->attendance_type === 'shift' && ! ($schedule && $schedule->shift)) {
            return 'no_schedule';
        }

        $lateToleranceMinutes = (int) ($user->company?->late_tolerance_minutes ?? 0);
        $startTime = ($schedule && $schedule->shift)
            ? $schedule->shift->start_time
            : ($user->office?->work_start_time ?? $user->company?->work_start_time ?? '08:30:00');

        $threshold = Carbon::parse($dateKey . ' ' . $startTime)->addMinutes($lateToleranceMinutes);

        return $now->gt($threshold) ? 'late' : 'present';
    }
}
