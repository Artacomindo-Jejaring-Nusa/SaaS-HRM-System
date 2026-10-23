<?php

namespace App\Traits;

use App\Models\Attendance;
use App\Models\Schedule;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

trait HandlesWebAttendance
{
    /**
     * Web Check-In (Simplified: Photo + Server Timestamp + IP + Auto-Validation/Approval)
     */
    public function webCheckIn(Request $request)
    {
        $user = $request->user();
        $now = now();
        $today = Carbon::today()->toDateString();

        $preconditionError = $this->validateWebCheckInPreconditions($user, $request, $today);
        if ($preconditionError) {
            return $preconditionError;
        }

        $imageName = $this->saveCompressedAttendanceImage($request, 'web_in');
        $isDinasLuar = $request->attendance_type === 'dinas_luar';
        $isWfa = $request->attendance_type === 'wfh';
        $dinasDestination = $request->input('dinas_luar_destination');

        $schedule = Schedule::with('shift')
            ->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        $normalStatus = $isDinasLuar ? 'dinas_luar' : $this->determineCheckInStatus($user, $schedule, $now);
        $anomalyReason = ($isDinasLuar || $isWfa) ? null : $this->detectWebAttendanceAnomaly($user, $request, $schedule, $now);
        $isWhitelisted = $user->isWebAttendanceAutoValidated();

        $attendanceData = $this->buildWebAttendanceData($user, $request, $imageName, $normalStatus, $anomalyReason, $isWhitelisted, $now);

        $attendance = Attendance::create($attendanceData);

        $message = $this->dispatchWebAttendanceNotifications(
            $user,
            $attendanceData['web_approval_status'],
            $attendanceData['status'],
            $now,
            $anomalyReason,
            $isDinasLuar,
            $dinasDestination
        );

        return $this->successResponse($attendance->fresh(), $message);
    }

    private function validateWebCheckInPreconditions(User $user, Request $request, string $today): ?JsonResponse
    {
        $existingError = $this->validateExistingWebCheckIn($user, $today);
        if ($existingError) {
            return $existingError;
        }

        if (! $request->hasFile('image') && ! $request->image && ! $request->image_base64) {
            return $this->errorResponse('Foto selfie wajib diunggah sebagai bukti kehadiran.', 422);
        }

        if ($request->attendance_type === 'wfh') {
            $isWfhActive = $user->is_wfh && ($user->wfh_start_date <= $today && $user->wfh_end_date >= $today);
            if (! $isWfhActive) {
                return $this->errorResponse('Anda tidak memiliki izin WFA (Work From Anywhere) aktif untuk hari ini.', 403);
            }
        }

        return null;
    }

    private function resolveWebAttendanceType(Request $request): string
    {
        if ($request->attendance_type === 'dinas_luar') {
            return 'dinas_luar';
        }
        if ($request->attendance_type === 'wfh') {
            return 'wfh';
        }
        return 'office';
    }

    private function buildWebAttendanceData(User $user, Request $request, ?string $imageName, string $normalStatus, ?string $anomalyReason, bool $isWhitelisted, Carbon $now): array
    {
        $resolvedAttendanceType = $this->resolveWebAttendanceType($request);
        $hasAnomaly = $anomalyReason !== null;
        $isAutoValid = $isWhitelisted;
        $webApprovalStatus = $isAutoValid ? 'valid' : 'pending';
        $finalStatus = $isAutoValid ? $normalStatus : 'pending';
        $isSuspicious = $isWhitelisted ? false : $hasAnomaly;

        $suspiciousReason = null;
        if ($hasAnomaly) {
            $suspiciousReason = $isWhitelisted ? "Auto-Validated: {$anomalyReason}" : $anomalyReason;
        }

        $data = [
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'office_id' => $user->office_id,
            'check_in' => $now,
            'latitude_in' => $request->latitude,
            'longitude_in' => $request->longitude,
            'image_in' => $imageName,
            'channel' => 'web',
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 999),
            'web_approval_status' => $webApprovalStatus,
            'web_approved_at' => $isAutoValid ? $now : null,
            'status' => $finalStatus,
            'is_suspicious' => $isSuspicious,
            'suspicious_reason' => $suspiciousReason,
            'attendance_type' => $resolvedAttendanceType,
        ];

        if ($isDinasLuar) {
            $data['dinas_luar_destination'] = $request->input('dinas_luar_destination');
            $data['dinas_luar_notes'] = $request->input('dinas_luar_notes');
            $data['dinas_luar_status'] = $isAutoValid ? 'approved' : 'pending';
            if ($isAutoValid) {
                $data['approved_by_hr'] = $user->id;
                $data['approved_at_hr'] = $now;
                $data['approved_by_spv'] = $user->id;
                $data['approved_at_spv'] = $now;
            }
        }

        return $data;
    }

    private function validateExistingWebCheckIn(User $user, string $today): ?JsonResponse
    {
        $existing = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', $today)
            ->first();

        if (! $existing) {
            return null;
        }

        if ($existing->channel === 'web' && $existing->web_approval_status === 'pending') {
            return $this->errorResponse('Anda sudah melakukan Absen Masuk via Web hari ini (Status: Menunggu Persetujuan).', 400);
        }

        return $this->errorResponse('Anda sudah tercatat check-in hari ini.', 400);
    }

    private function detectWebAttendanceAnomaly(User $user, Request $request, ?Schedule $schedule, Carbon $now): ?string
    {
        $anomaly = $this->checkOddHoursAnomaly($schedule, $now);
        $locationAnomaly = $this->checkLocationAnomaly($user, $request);

        if ($locationAnomaly) {
            return $anomaly ? "{$anomaly} {$locationAnomaly}" : $locationAnomaly;
        }

        return $anomaly;
    }

    private function checkOddHoursAnomaly(?Schedule $schedule, Carbon $now): ?string
    {
        $currentHour = (int) $now->format('H');
        $isOddHour = ($currentHour >= 23 || $currentHour < 5);
        $isNightShift = $schedule && $schedule->shift && str_contains(strtolower($schedule->shift->name ?? ''), 'malam');

        if ($isOddHour && ! $isNightShift) {
            return "Anomali Jam Kerja: Absen web pada pukul {$now->format('H:i')} di luar jam operasional wajar.";
        }

        return null;
    }

    private function checkLocationAnomaly(User $user, Request $request): ?string
    {
        if (! $request->latitude || ! $request->longitude || $request->attendance_type === 'wfh' || $user->is_wfh || str_contains(strtolower($user->role?->name ?? ''), 'teknisi')) {
            return null;
        }

        $geoCheck = $this->validateGeofencing($user, $request);
        if (! $geoCheck['success']) {
            return 'Anomali Lokasi: Koordinat browser berada di luar radius kantor.';
        }

        return null;
    }

    private function dispatchWebAttendanceNotifications(User $user, string $webApprovalStatus, string $finalStatus, Carbon $now, ?string $anomalyReason, bool $isDinasLuar = false, ?string $destination = null): string
    {
        if ($webApprovalStatus === 'valid') {
            if ($isDinasLuar) {
                $this->notify(
                    $user,
                    'DINAS LUAR WEB DISETUJUI (AUTO-VALIDASI)',
                    "Absen dinas luar via web Anda ke {$destination} pada pukul {$now->format('H:i')} WIB telah disahkan secara otomatis (Validasi Otomatis Aktif).",
                    'success',
                    null,
                    'notif',
                    false
                );

                $message = 'Absen Masuk Dinas Luar via Web berhasil disahkan secara otomatis (Validasi Otomatis Aktif).';
            } else {
                $this->sendCheckInNotifications($user, $finalStatus, $now);

                $message = 'Absen Masuk via Web berhasil disahkan secara otomatis (Validasi Otomatis Aktif). Status: '.strtoupper($finalStatus);
            }
        } else {
            if ($isDinasLuar) {
                $this->notifyAdminsAboutPendingWebAttendance($user, $now, "Dinas Luar ke {$destination}: ".$anomalyReason);
                $this->notify(
                    $user,
                    'ABSEN DINAS LUAR WEB TERCATAT (MENUNGGU PERSETUJUAN)',
                    "Absen masuk dinas luar via web Anda ke {$destination} pada pukul {$now->format('H:i')} WIB telah dicatat dan sedang menunggu persetujuan Superadmin / HRD.",
                    'info',
                    null,
                    'notif',
                    false
                );
            } else {
                $this->notifyAdminsAboutPendingWebAttendance($user, $now, $anomalyReason);
                $this->notify(
                    $user,
                    'ABSEN WEB TERCATAT (MENUNGGU PERSETUJUAN)',
                    "Absen masuk via web Anda pada pukul {$now->format('H:i')} WIB telah dicatat dan sedang menunggu persetujuan Superadmin / HRD.",
                    'info',
                    null,
                    'notif',
                    false
                );
            }

            $message = 'Absen Masuk via Web berhasil dikirim. Menunggu persetujuan Superadmin / HRD.';
        }

        return $message;
    }

    /**
     * Web Check-Out (Simplified: Photo + Server Timestamp)
     */
    public function webCheckOut(Request $request)
    {
        $user = $request->user();
        $now = now();
        $today = Carbon::today()->toDateString();

        $attendance = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', $today)
            ->whereNull('check_out')
            ->first();

        if (! $attendance) {
            return $this->errorResponse('Anda belum melakukan Check-in hari ini atau sudah Check-out.', 400);
        }

        $minCheckOutTime = $this->resolveWebMinCheckOutTime($user, $today);
        $isEarly = $now->lt($minCheckOutTime);
        $earlyOutReason = $request->input('early_out_reason') ?: $request->input('bypass_reason');

        if ($isEarly && empty($earlyOutReason)) {
            return $this->buildEarlyOutPromptResponse($minCheckOutTime, $now);
        }

        return $this->processWebCheckOutExecution($attendance, $user, $request, $now, $isEarly, $earlyOutReason, $minCheckOutTime);
    }

    private function resolveWebMinCheckOutTime(User $user, string $today): Carbon
    {
        $schedule = Schedule::with('shift')
            ->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        if ($schedule?->shift?->end_time) {
            return Carbon::parse($today.' '.$schedule->shift->end_time);
        }

        $workEndTime = $user->office?->work_end_time ?? $user->company?->work_end_time ?? '17:00:00';

        return Carbon::parse($today.' '.$workEndTime);
    }

    private function buildEarlyOutPromptResponse(Carbon $minCheckOutTime, Carbon $now)
    {
        $diffMinutes = $now->diffInMinutes($minCheckOutTime);
        $hours = floor($diffMinutes / 60);
        $mins = $diffMinutes % 60;
        $timeRemaining = ($hours > 0 ? $hours.' jam ' : '').$mins.' menit';

        return response()->json([
            'status' => 'error',
            'can_bypass' => true,
            'requires_early_out_reason' => true,
            'min_checkout_time' => $minCheckOutTime->format('H:i'),
            'time_remaining' => $timeRemaining,
            'message' => "Belum saatnya pulang! Jam pulang Anda adalah pukul {$minCheckOutTime->format('H:i')} WIB (Kurang {$timeRemaining} lagi). Silakan sertakan alasan jika Anda harus pulang lebih awal.",
        ], 400);
    }

    private function processWebCheckOutExecution(Attendance $attendance, User $user, Request $request, Carbon $now, bool $isEarly, ?string $earlyOutReason, Carbon $minCheckOutTime)
    {
        $imageName = $this->saveCompressedAttendanceImage($request, 'web_out');
        $isAutoValidated = $user->isWebAttendanceAutoValidated();

        $updateData = [
            'check_out' => $now,
            'latitude_out' => $request->latitude ?? $attendance->latitude_out,
            'longitude_out' => $request->longitude ?? $attendance->longitude_out,
            'image_out' => $imageName ?? $attendance->image_out,
        ];

        if ($isEarly && ! empty($earlyOutReason)) {
            $this->applyWebEarlyOutData($updateData, $attendance, $earlyOutReason, $isAutoValidated, $minCheckOutTime);
        }

        $attendance->update($updateData);

        if ($isEarly && ! empty($earlyOutReason)) {
            return $this->handleWebEarlyOutNotifications($attendance, $user, $now, $earlyOutReason, $isAutoValidated);
        }

        $this->notify(
            $user,
            'ABSEN KELUAR WEB BERHASIL',
            "Anda telah berhasil melakukan absen keluar via web pada pukul {$now->format('H:i')} WIB.",
            'info',
            null,
            'notif',
            false
        );

        return $this->successResponse($attendance->fresh(), 'Absen keluar via Web berhasil dicatat.');
    }

    private function applyWebEarlyOutData(array &$updateData, Attendance $attendance, string $earlyOutReason, bool $isAutoValidated, Carbon $minCheckOutTime): void
    {
        $updateData['is_early_out'] = true;
        $updateData['early_out_reason'] = $earlyOutReason;

        if ($isAutoValidated) {
            $updateData['early_out_status'] = 'approved';
            $updateData['early_out_approved_at'] = now();
        } else {
            $updateData['early_out_status'] = 'pending';
            $updateData['is_suspicious'] = true;
            $schedEndTimeStr = " ({$minCheckOutTime->format('H:i')} WIB)";
            $updateData['suspicious_reason'] = trim(($attendance->suspicious_reason ?? '')." | Pulang Awal Web{$schedEndTimeStr}: {$earlyOutReason}", ' |');
        }
    }

    private function handleWebEarlyOutNotifications(Attendance $attendance, User $user, Carbon $now, string $earlyOutReason, bool $isAutoValidated)
    {
        if ($isAutoValidated) {
            $this->notify(
                $user,
                'ABSEN PULANG AWAL WEB DISETUJUI (AUTO-VALIDASI)',
                "Absen keluar web lebih awal Anda pada pukul {$now->format('H:i')} WIB telah disetujui otomatis. Alasan: {$earlyOutReason}",
                'success',
                null,
                'notif',
                false
            );

            return $this->successResponse($attendance->fresh(), 'Absen keluar via Web (Pulang Awal) berhasil divalidasi otomatis.');
        }

        // Notify Super Admin
        $this->notifySuperAdmins(
            $user->company_id,
            'PERMOHONAN PULANG AWAL WEB BUTUH PERSETUJUAN',
            "Karyawan {$user->name} melakukan absen keluar web lebih awal pada pukul {$now->format('H:i')} WIB. Alasan: \"{$earlyOutReason}\". Butuh persetujuan Anda.",
            'warning',
            '/dashboard/approvals',
            $user->id
        );

        $hrds = User::where('company_id', $user->company_id)
            ->where('id', '!=', $user->id)
            ->whereHas('role', fn ($r) => $r->where('name', 'like', '%hrd%'))
            ->get();

        foreach ($hrds as $hrd) {
            $this->notify(
                $hrd,
                'PERMOHONAN PULANG AWAL WEB BUTUH PERSETUJUAN',
                "Karyawan {$user->name} melakukan absen keluar web lebih awal pada pukul {$now->format('H:i')} WIB. Alasan: \"{$earlyOutReason}\". Butuh persetujuan Anda.",
                'warning',
                '/dashboard/approvals',
                'notif',
                false
            );
        }

        $this->notify(
            $user,
            'ABSEN PULANG AWAL WEB TERCATAT (MENUNGGU PERSETUJUAN)',
            "Absen keluar web lebih awal Anda pada pukul {$now->format('H:i')} WIB telah dicatat dan sedang menunggu persetujuan Super Admin.",
            'info',
            null,
            'notif',
            false
        );

        return $this->successResponse($attendance->fresh(), 'Absen keluar via Web berhasil dikirim. Menunggu persetujuan Super Admin.');
    }

    /**
     * List Pending Web Attendances for Superadmin review.
     */
    public function webPending(Request $request)
    {
        $user = $request->user();
        if (! $this->isSuperAdminUser($user)) {
            return $this->errorResponse('Hanya Super Admin yang berhak mengakses antrean persetujuan absen web.', 403);
        }

        $query = Attendance::with(['user:id,name,email,role_id,office_id,nik,profile_photo_path,auto_validate_web_attendance,attendance_type', 'user.role', 'user.office'])
            ->where('web_approval_status', 'pending');

        if ($request->company_id && $request->company_id !== 'all') {
            $query->where('company_id', $request->company_id);
        } elseif ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        }

        if ($request->search) {
            $search = $request->search;
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('nik', 'like', "%{$search}%");
            });
        }

        if ($request->start_date && $request->end_date) {
            $query->whereDate('check_in', '>=', $request->start_date)
                ->whereDate('check_in', '<=', $request->end_date);
        }

        $pendings = $query->orderBy('check_in', 'desc')->paginate($request->per_page ?? 15);

        return $this->successResponse($pendings, 'Daftar absensi web menunggu persetujuan berhasil diambil.');
    }

    /**
     * Approve Pending Web Attendance
     */
    public function webApprove(Request $request, $id)
    {
        $admin = $request->user();
        if (! $this->isSuperAdminUser($admin)) {
            return $this->errorResponse('Hanya Super Admin yang berhak menyetujui absensi web.', 403);
        }

        $query = Attendance::with('user');
        if ($request->company_id && $request->company_id !== 'all') {
            $query->where('company_id', $request->company_id);
        } elseif ($admin->company_id && ! $admin->canAccessAllCompanies()) {
            $query->where('company_id', $admin->company_id);
        }
        $attendance = $query->findOrFail($id);

        if ($attendance->web_approval_status === 'valid') {
            return $this->errorResponse('Absensi ini sudah disetujui sebelumnya.', 400);
        }

        $schedule = Schedule::with('shift')
            ->where('user_id', $attendance->user_id)
            ->whereDate('date', Carbon::parse($attendance->check_in)->toDateString())
            ->first();

        $status = $this->determineCheckInStatus($attendance->user, $schedule, Carbon::parse($attendance->check_in));

        $attendance->update([
            'web_approval_status' => 'valid',
            'status' => $status,
            'web_approved_by' => $admin->id,
            'web_approved_at' => now(),
            'is_suspicious' => false,
        ]);

        $this->notify(
            $attendance->user,
            'ABSEN WEB DISETUJUI',
            'Absensi Web Anda pada tanggal '.Carbon::parse($attendance->check_in)->format('d M Y (H:i)').' telah DISETUJUI oleh Super Admin. Status: '.strtoupper($status),
            'success',
            '/dashboard/attendance'
        );

        return $this->successResponse($attendance->fresh(), 'Absensi web berhasil disetujui.');
    }

    /**
     * Reject Pending Web Attendance
     */
    public function webReject(Request $request, $id)
    {
        $admin = $request->user();
        if (! $this->isSuperAdminUser($admin)) {
            return $this->errorResponse('Hanya Super Admin yang berhak menolak absensi web.', 403);
        }

        $query = Attendance::with('user');
        if ($request->company_id && $request->company_id !== 'all') {
            $query->where('company_id', $request->company_id);
        } elseif ($admin->company_id && ! $admin->canAccessAllCompanies()) {
            $query->where('company_id', $admin->company_id);
        }
        $attendance = $query->findOrFail($id);

        $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $reason = $request->reason ?? 'Foto tidak jelas atau tidak memenuhi syarat kehadiran.';

        $attendance->update([
            'web_approval_status' => 'rejected',
            'status' => 'alfa',
            'web_rejection_reason' => $reason,
            'web_approved_by' => $admin->id,
            'web_approved_at' => now(),
        ]);

        $this->notify(
            $attendance->user,
            'ABSEN WEB DITOLAK',
            'Absensi Web Anda pada tanggal '.Carbon::parse($attendance->check_in)->format('d M Y').' DITOLAK oleh Super Admin. Alasan: '.$reason,
            'danger',
            '/dashboard/attendance'
        );

        return $this->successResponse($attendance->fresh(), 'Absensi web berhasil ditolak.');
    }

    /**
     * Get Pending Approvals Summary for Superadmin Notifications
     */
    public function pendingSummary(Request $request)
    {
        $user = $request->user();
        if (! $this->isSuperAdminUser($user)) {
            return $this->successResponse([
                'web_pending_count' => 0,
                'dinas_luar_pending_count' => 0,
                'total_pending' => 0,
            ], 'Ringkasan persetujuan kehadiran berhasil diambil.');
        }

        $webQuery = Attendance::where('channel', 'web')
            ->where('web_approval_status', 'pending');

        $dinasQuery = Attendance::where('attendance_type', 'dinas_luar')
            ->whereIn('dinas_luar_status', ['pending', 'waiting_approval', 'approved_spv']);

        if ($request->company_id && $request->company_id !== 'all') {
            $webQuery->where('company_id', $request->company_id);
            $dinasQuery->where('company_id', $request->company_id);
        } elseif ($user->company_id && ! $user->canAccessAllCompanies()) {
            $webQuery->where('company_id', $user->company_id);
            $dinasQuery->where('company_id', $user->company_id);
        }

        $webPendingCount = $webQuery->count();
        $dinasLuarPendingCount = $dinasQuery->count();

        return $this->successResponse([
            'web_pending_count' => $webPendingCount,
            'dinas_luar_pending_count' => $dinasLuarPendingCount,
            'total_pending' => $webPendingCount + $dinasLuarPendingCount,
        ], 'Ringkasan persetujuan kehadiran berhasil diambil.');
    }

    private function isSuperAdminUser(User $user): bool
    {
        return $user->role_id === 1
            || $user->canAccessAllCompanies()
            || str_contains(strtolower($user->role?->name ?? ''), 'super admin')
            || (method_exists($user, 'hasRole') && $user->hasRole('Super Admin'));
    }

    private function notifyAdminsAboutPendingWebAttendance(User $user, Carbon $now, ?string $anomalyReason = null): void
    {
        $admins = User::where('company_id', $user->company_id)
            ->where(function ($q) {
                $q->where('role_id', 1)
                    ->orWhereHas('role', function ($r) {
                        $r->where('name', 'like', '%Super Admin%');
                    });
            })
            ->get();

        $title = $anomalyReason ? 'PERINGATAN: ABSEN WEB ANOMALI' : 'PERSETUJUAN ABSEN WEB BARU';
        $desc = "Karyawan {$user->name} baru saja melakukan Absen Masuk via Web pada pukul {$now->format('H:i')} WIB dan memerlukan persetujuan Super Admin.";
        if ($anomalyReason) {
            $desc .= " (Catatan: {$anomalyReason})";
        }

        foreach ($admins as $admin) {
            $this->notify(
                $admin,
                $title,
                $desc,
                $anomalyReason ? 'danger' : 'warning',
                '/dashboard/attendance?tab=web_pending',
                'notif',
                false
            );
        }
    }
}
