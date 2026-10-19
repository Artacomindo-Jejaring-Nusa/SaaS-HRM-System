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
            $info = $this->zkService->testConnection($device->ip_address, $device->port, 4);

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
    public function syncDeviceLogs(AttendanceDevice $device): array
    {
        try {
            $logs = $this->zkService->getAttendanceLogs($device->ip_address, $device->port, 6);
            $device->update([
                'status' => 'online',
                'last_sync_at' => now(),
                'last_error' => null,
            ]);

            if (empty($logs)) {
                return [
                    'success' => true,
                    'message' => 'Tidak ada log presensi baru di mesin.',
                    'processed' => 0,
                    'unmapped' => 0,
                ];
            }

            $processedCount = 0;
            $unmappedPins = [];

            // Sort logs chronologically
            usort($logs, fn($a, $b) => strcmp($a['timestamp'], $b['timestamp']));

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

    private function processSingleLog(array $log, AttendanceDevice $device, array &$unmappedPins): bool
    {
        $pin = (string) ($log['pin'] ?? '');
        $timestampStr = $log['timestamp'] ?? '';

        if (empty($pin) || empty($timestampStr)) {
            return false;
        }

        $logTime = Carbon::parse($timestampStr);
        $dateKey = $logTime->toDateString();

        // Find user by fingerprint_pin or nik
        $user = User::where('company_id', $device->company_id)
            ->where(function ($q) use ($pin) {
                $q->where('fingerprint_pin', $pin)
                  ->orWhere('nik', $pin);
            })
            ->first();

        if (!$user) {
            $unmappedPins[$pin] = true;
            return false;
        }

        // Check existing attendance on this date
        $attendance = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', $dateKey)
            ->first();

        if (!$attendance) {
            // Record Check-In
            $status = $this->resolveCheckInStatus($user, $logTime);
            Attendance::create([
                'user_id' => $user->id,
                'company_id' => $user->company_id,
                'office_id' => $user->office_id,
                'check_in' => $logTime,
                'status' => $status,
                'attendance_type' => 'fingerprint',
            ]);
            return true;
        }

        // Record Check-Out if tap is at least 15 minutes after check-in and newer than current checkout
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
