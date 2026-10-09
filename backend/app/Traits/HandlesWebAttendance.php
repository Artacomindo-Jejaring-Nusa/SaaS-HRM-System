<?php

namespace App\Traits;

use App\Models\Attendance;
use App\Models\Schedule;
use App\Models\User;
use Carbon\Carbon;
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

        $existingError = $this->validateExistingWebCheckIn($user, $today);
        if ($existingError) {
            return $existingError;
        }

        if (!$request->hasFile('image') && !$request->image && !$request->image_base64) {
            return $this->errorResponse('Foto selfie wajib diunggah sebagai bukti kehadiran.', 422);
        }

        $imageName = $this->saveCompressedAttendanceImage($request, 'web_in');

        $schedule = Schedule::with('shift')
            ->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        $normalStatus = $this->determineCheckInStatus($user, $schedule, $now);
        $anomalyReason = $this->detectWebAttendanceAnomaly($user, $request, $schedule, $now);
        $hasAnomaly = $anomalyReason !== null;
        $isWhitelisted = $user->isWebAttendanceAutoValidated();

        $isAutoValid = $isWhitelisted && !$hasAnomaly;
        $webApprovalStatus = $isAutoValid ? 'valid' : 'pending';
        $finalStatus = $isAutoValid ? $normalStatus : 'pending';

        $attendance = Attendance::create([
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
            'status' => $finalStatus,
            'is_suspicious' => $hasAnomaly,
            'suspicious_reason' => $anomalyReason,
            'attendance_type' => 'office',
        ]);

        $message = $this->dispatchWebAttendanceNotifications($user, $webApprovalStatus, $finalStatus, $now, $anomalyReason);

        return $this->successResponse($attendance->fresh(), $message);
    }

    private function validateExistingWebCheckIn(User $user, string $today): ?\Illuminate\Http\JsonResponse
    {
        $existing = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', $today)
            ->first();

        if (!$existing) {
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

        if ($isOddHour && !$isNightShift) {
            return "Anomali Jam Kerja: Absen web pada pukul {$now->format('H:i')} di luar jam operasional wajar.";
        }

        return null;
    }

    private function checkLocationAnomaly(User $user, Request $request): ?string
    {
        if (!$request->latitude || !$request->longitude || $user->is_wfh || str_contains(strtolower($user->role?->name ?? ''), 'teknisi')) {
            return null;
        }

        $geoCheck = $this->validateGeofencing($user, $request);
        if (!$geoCheck['success']) {
            return "Anomali Lokasi: Koordinat browser berada di luar radius kantor.";
        }

        return null;
    }

    private function dispatchWebAttendanceNotifications(User $user, string $webApprovalStatus, string $finalStatus, Carbon $now, ?string $anomalyReason): string
    {
        if ($webApprovalStatus === 'valid') {
            $this->sendCheckInNotifications($user, $finalStatus, $now);
            return 'Absen Masuk via Web berhasil disahkan secara otomatis (Validasi Otomatis Aktif). Status: ' . strtoupper($finalStatus);
        }

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

        return 'Absen Masuk via Web berhasil dikirim. Menunggu persetujuan Superadmin / HRD.';
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

        if (!$attendance) {
            return $this->errorResponse('Anda belum melakukan Check-in hari ini atau sudah Check-out.', 400);
        }

        $imageName = $this->saveCompressedAttendanceImage($request, 'web_out');

        $attendance->update([
            'check_out' => $now,
            'latitude_out' => $request->latitude ?? $attendance->latitude_out,
            'longitude_out' => $request->longitude ?? $attendance->longitude_out,
            'image_out' => $imageName ?? $attendance->image_out,
        ]);

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

    /**
     * List Pending Web Attendances for Superadmin review.
     */
    public function webPending(Request $request)
    {
        $user = $request->user();
        if (! $this->isSuperAdminUser($user)) {
            return $this->errorResponse('Hanya Super Admin yang berhak mengakses antrean persetujuan absen web.', 403);
        }

        $query = Attendance::with(['user:id,name,email,role_id,office_id,nik,profile_photo_path,auto_validate_web_attendance', 'user.role', 'user.office'])
            ->where('company_id', $user->company_id)
            ->where('channel', 'web')
            ->where('web_approval_status', 'pending');

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

        $attendance = Attendance::with('user')->where('company_id', $admin->company_id)->findOrFail($id);

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
            "Absensi Web Anda pada tanggal " . Carbon::parse($attendance->check_in)->format('d M Y (H:i)') . " telah DISETUJUI oleh Super Admin. Status: " . strtoupper($status),
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

        $attendance = Attendance::with('user')->where('company_id', $admin->company_id)->findOrFail($id);

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
            "Absensi Web Anda pada tanggal " . Carbon::parse($attendance->check_in)->format('d M Y') . " DITOLAK oleh Super Admin. Alasan: " . $reason,
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

        $companyId = $user->company_id;

        $webPendingCount = Attendance::where('company_id', $companyId)
            ->where('channel', 'web')
            ->where('web_approval_status', 'pending')
            ->count();

        $dinasLuarPendingCount = Attendance::where('company_id', $companyId)
            ->where('attendance_type', 'dinas_luar')
            ->whereIn('dinas_luar_status', ['pending', 'approved_spv'])
            ->count();

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
