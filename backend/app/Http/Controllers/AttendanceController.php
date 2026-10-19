<?php

namespace App\Http\Controllers;

use App\Events\EmployeeLocationUpdated;
use App\Exports\AttendanceExport;
use App\Http\Requests\StoreAttendanceRequest;
use App\Models\Attendance;
use App\Models\EmployeeTrack;
use App\Models\Office;
use App\Models\Schedule;
use App\Models\User;
use App\Services\EmployeeQueryService;
use App\Traits\Notifiable;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Intervention\Image\Laravel\Facades\Image;
use Maatwebsite\Excel\Facades\Excel;

class AttendanceController extends Controller
{
    use \App\Traits\HandlesAttendanceDinasLuar, \App\Traits\HandlesAttendanceProcessing, \App\Traits\HandlesAttendanceSecurity, \App\Traits\HandlesWebAttendance, Notifiable;

    private const ROUTE_APPROVALS = '/dashboard/approvals';

    public function checkIn(StoreAttendanceRequest $request)
    {
        $user = $request->user();
        $now = now();
        $today = Carbon::today()->toDateString();
        $response = null;
        $isDinasLuar = $request->attendance_type === 'dinas_luar';

        $attendance = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', $today)
            ->first();

        if ($attendance) {
            // Mobile Priority Conflict Resolution (Section 5 Spec)
            if ($attendance->channel === 'web' && $attendance->web_approval_status === 'pending') {
                // Pending web attendance is overwritten by cryptographic on-device ML verified mobile attendance
                $attendance->delete();
                $attendance = null;
            } elseif ($attendance->channel === 'web' && $attendance->web_approval_status === 'valid') {
                // Both entries valid -> flag entry as suspicious for Superadmin audit to prevent duplicated working hours
                $attendance->update([
                    'is_suspicious' => true,
                    'suspicious_reason' => 'Konflik Entri Ganda: Terdeteksi Absen Web Valid dan Absen Mobile Sinkronisasi pada hari yang sama.',
                ]);
                $response = $this->errorResponse('Konflik Sinkronisasi: Anda sudah memiliki catatan Absen Web yang tervalidasi hari ini. Data ditandai untuk ditinjau Superadmin.', 400);
            } else {
                $response = $this->errorResponse('Anda sudah check-in hari ini.', 400);
            }
        }

        if (! $attendance && ! $response) {
            if ($securityError = $this->validateDeviceAndSecurity($user, $request)) {
                $response = $this->errorResponse($securityError['message'], $securityError['code']);
            } elseif ($isDinasLuar) {
                // Dinas Luar: skip geofence, but still requires selfie (validated by request rules)
                $response = $this->processCheckIn($user, $request, null, $now, $today);
            } elseif (! ($geoResult = $this->validateGeofencing($user, $request))['success']) {
                $response = $this->errorResponse($geoResult['message'], $geoResult['status']);
            } else {
                $response = $this->processCheckIn($user, $request, $geoResult['office'], $now, $today);
            }
        }

        return $response;
    }

    private function processCheckIn(User $user, StoreAttendanceRequest $request, $matchedOffice, Carbon $now, string $today)
    {
        $isDinasLuar = $request->attendance_type === 'dinas_luar';
        $isBypass = $request->boolean('bypass_face_recognition');

        $schedule = Schedule::with('shift')
            ->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        $status = $isDinasLuar ? 'dinas_luar' : $this->determineCheckInStatus($user, $schedule, $now);

        // Handle Image & Compression
        $imageName = $this->saveCompressedAttendanceImage($request, 'in');

        $attendanceData = [
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'check_in' => $now,
            'latitude_in' => $request->latitude,
            'longitude_in' => $request->longitude,
            'image_in' => $imageName,
            'face_similarity_score_in' => $request->attributes->get('face_similarity_score_in'),
            'is_face_verified_in' => (bool) $request->attributes->get('is_face_verified_in', false),
            'status' => $status,
            'office_id' => $matchedOffice ? $matchedOffice->id : null,
            'attendance_type' => $isDinasLuar ? 'dinas_luar' : 'office',
            'channel' => 'mobile',
        ];

        if ($isBypass) {
            $bypassReason = $request->input('bypass_reason', 'Verifikasi wajah gagal');
            $attendanceData['is_suspicious'] = true;
            $attendanceData['suspicious_reason'] = "Tanpa verifikasi wajah: {$bypassReason}";
            $attendanceData['web_approval_status'] = 'pending';
        }

        // Add dinas luar specific fields
        if ($isDinasLuar) {
            $attendanceData['dinas_luar_destination'] = $request->dinas_luar_destination;
            $attendanceData['dinas_luar_notes'] = $request->dinas_luar_notes;
            $attendanceData['dinas_luar_status'] = 'pending';
        }

        $attendance = Attendance::create($attendanceData);

        if ($isBypass) {
            $this->notifySuperAdmins(
                $user->company_id,
                'ABSENSI MANUAL BUTUH VALIDASI SUPER ADMIN',
                "Karyawan {$user->name} melakukan absen masuk manual (wajah gagal) pada pukul {$now->format('H:i')} WIB. Catatan: \"{$bypassReason}\". Menunggu validasi Super Admin.",
                'warning',
                self::ROUTE_APPROVALS,
                $user->id
            );
        }

        // Auto-record initial position into employee_tracks & broadcast live location to Superadmin
        try {
            $track = EmployeeTrack::create([
                'user_id' => $user->id,
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'accuracy' => 10.0,
                'battery_level' => 100,
                'recorded_at' => $now,
            ]);
            broadcast(new EmployeeLocationUpdated($track))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('Auto track on checkIn failed: '.$e->getMessage());
        }

        if ($isDinasLuar) {
            $this->sendDinasLuarNotifications($user, $attendance);
        } else {
            $this->sendCheckInNotifications($user, $status, $now);
        }

        $score = $request->attributes->get('face_similarity_score_in');
        $scorePercent = $score !== null ? round($score * 100, 1) : null;
        $scoreText = $scorePercent !== null ? " (Kemiripan Wajah: {$scorePercent}%)" : '';

        $message = $isDinasLuar
            ? "Absen Dinas Luar berhasil tercatat{$scoreText}. Menunggu persetujuan Supervisor."
            : "Check-in berhasil{$scoreText}. Status: {$status}";

        return $this->successResponse($attendance, $message);
    }

    public function checkOut(StoreAttendanceRequest $request)
    {
        $user = $request->user();
        $response = null;

        $attendance = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', Carbon::today())
            ->whereNull('check_out')
            ->first();

        // Check minimum clock-out time (Shift End Time or Company/Office Work End Time)
        $now = now();
        $today = Carbon::today()->toDateString();

        $schedule = Schedule::with('shift')
            ->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        if ($schedule && $schedule->shift && $schedule->shift->end_time) {
            $minCheckOutTime = Carbon::parse($today.' '.$schedule->shift->end_time);
        } else {
            $workEndTime = $user->office?->work_end_time ?? $user->company?->work_end_time ?? '17:00:00';
            $minCheckOutTime = Carbon::parse($today.' '.$workEndTime);
        }

        $isEarly = $now->lt($minCheckOutTime);
        $earlyOutReason = $request->input('early_out_reason') ?: $request->input('bypass_reason');

        if (! $attendance) {
            $response = $this->errorResponse('Anda belum check-in atau sudah check-out.', 400);
        } elseif ($isEarly && empty($earlyOutReason)) {
            $diffMinutes = $now->diffInMinutes($minCheckOutTime);
            $hours = floor($diffMinutes / 60);
            $mins = $diffMinutes % 60;
            $timeRemaining = ($hours > 0 ? $hours.' jam ' : '').$mins.' menit';
            $response = response()->json([
                'status' => 'error',
                'can_bypass' => true,
                'requires_early_out_reason' => true,
                'min_checkout_time' => $minCheckOutTime->format('H:i'),
                'time_remaining' => $timeRemaining,
                'message' => "Belum saatnya pulang! Jam pulang Anda adalah pukul {$minCheckOutTime->format('H:i')} WIB (Kurang {$timeRemaining} lagi). Silakan ajukan izin pulang awal dan sertakan alasan jika Anda harus pulang lebih awal.",
            ], 400);
        } elseif ($securityError = $this->validateDeviceAndSecurity($user, $request, 'out')) {
            $response = $this->errorResponse($securityError['message'], $securityError['code']);
        } else {
            $response = $this->processCheckOut($attendance, $user, $request, $isEarly, $earlyOutReason, $minCheckOutTime);
        }

        return $response;
    }

    private function processCheckOut(Attendance $attendance, User $user, StoreAttendanceRequest $request, bool $isEarly = false, ?string $earlyOutReason = null, ?Carbon $minCheckOutTime = null)
    {
        $imageName = $this->saveCompressedAttendanceImage($request, 'out');
        $isFaceBypass = $request->boolean('bypass_face_recognition');
        $isAutoValidated = $user->isWebAttendanceAutoValidated();

        $updateData = [
            'check_out' => now(),
            'latitude_out' => $request->latitude,
            'longitude_out' => $request->longitude,
            'image_out' => $imageName,
            'face_similarity_score_out' => $request->attributes->get('face_similarity_score_out'),
            'is_face_verified_out' => (bool) $request->attributes->get('is_face_verified_out', false),
        ];

        if ($isFaceBypass) {
            $bypassFaceReason = $request->input('bypass_reason', 'Verifikasi wajah gagal');
            $updateData['is_suspicious'] = true;
            $updateData['suspicious_reason'] = trim(($attendance->suspicious_reason ?? '')." | Tanpa verifikasi wajah saat pulang: {$bypassFaceReason}", ' |');
            $updateData['web_approval_status'] = 'pending';

            $this->notifySuperAdmins(
                $user->company_id,
                'ABSEN KELUAR MANUAL BUTUH VALIDASI SUPER ADMIN',
                "Karyawan {$user->name} melakukan absen keluar manual (wajah gagal) pada pukul ".now()->format('H:i')." WIB. Catatan: \"{$bypassFaceReason}\". Menunggu validasi Super Admin.",
                'warning',
                self::ROUTE_APPROVALS,
                $user->id
            );
        }

        if ($isEarly && ! empty($earlyOutReason)) {
            $this->applyEarlyOutData($updateData, $attendance, $earlyOutReason, $isAutoValidated, $minCheckOutTime);
        }

        $attendance->update($updateData);
        $this->recordCheckOutTrack($user, $request);

        $score = $request->attributes->get('face_similarity_score_out');
        $scorePercent = $score !== null ? round($score * 100, 1) : null;
        $scoreText = $scorePercent !== null ? " (Kemiripan Wajah: {$scorePercent}%)" : '';

        if ($isEarly && ! empty($earlyOutReason)) {
            return $this->handleEarlyOutNotifications($attendance, $user, $earlyOutReason, $isAutoValidated, $scoreText);
        }

        $this->notify(
            $user,
            'BERHASIL ABSEN KELUAR',
            'Anda telah berhasil absen keluar pada pukul '.now()->format('H:i').' WIB. Terima kasih atas kerja keras Anda!',
            'success',
            null,
            'notif',
            false
        );

        return $this->successResponse($attendance->fresh(), "Check-out berhasil{$scoreText}.");
    }

    private function applyEarlyOutData(array &$updateData, Attendance $attendance, string $earlyOutReason, bool $isAutoValidated, ?Carbon $minCheckOutTime): void
    {
        $updateData['is_early_out'] = true;
        $updateData['early_out_reason'] = $earlyOutReason;

        if ($isAutoValidated) {
            $updateData['early_out_status'] = 'approved';
            $updateData['early_out_approved_at'] = now();
        } else {
            $updateData['early_out_status'] = 'pending';
            $updateData['is_suspicious'] = true;
            $schedEndTimeStr = $minCheckOutTime ? " ({$minCheckOutTime->format('H:i')} WIB)" : '';
            $updateData['suspicious_reason'] = trim(($updateData['suspicious_reason'] ?? $attendance->suspicious_reason)." | Pulang Awal{$schedEndTimeStr}: {$earlyOutReason}", ' |');
        }
    }

    private function recordCheckOutTrack(User $user, StoreAttendanceRequest $request): void
    {
        try {
            $track = EmployeeTrack::create([
                'user_id' => $user->id,
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'accuracy' => 10.0,
                'battery_level' => 100,
                'recorded_at' => now(),
            ]);
            broadcast(new EmployeeLocationUpdated($track))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('Auto track on checkOut failed: '.$e->getMessage());
        }
    }

    private function handleEarlyOutNotifications(Attendance $attendance, User $user, string $earlyOutReason, bool $isAutoValidated, string $scoreText)
    {
        if ($isAutoValidated) {
            $this->notify(
                $user,
                'ABSEN PULANG AWAL DISETUJUI (AUTO-VALIDASI)',
                'Anda telah berhasil absen keluar lebih awal pada pukul '.now()->format('H:i')." WIB dengan Validasi Otomatis Aktif. Alasan: {$earlyOutReason}",
                'success',
                null,
                'notif',
                false
            );

            return $this->successResponse($attendance->fresh(), "Absen pulang awal berhasil dicatat & divalidasi otomatis (Fitur Auto-Validasi Aktif).{$scoreText}");
        }

        // Notify Admins
        $this->notifySuperAdmins(
            $user->company_id,
            'PERMOHONAN PULANG AWAL BUTUH PERSETUJUAN',
            "Karyawan {$user->name} melakukan absen pulang lebih awal pada pukul ".now()->format('H:i')." WIB. Alasan: \"{$earlyOutReason}\". Membutuhkan persetujuan Anda.",
            'warning',
            self::ROUTE_APPROVALS,
            $user->id
        );

        $hrds = User::where('company_id', $user->company_id)
            ->where('id', '!=', $user->id)
            ->whereHas('role', fn ($r) => $r->where('name', 'like', '%hrd%'))
            ->get();

        foreach ($hrds as $hrd) {
            $this->notify(
                $hrd,
                'PERMOHONAN PULANG AWAL BUTUH PERSETUJUAN',
                "Karyawan {$user->name} melakukan absen pulang lebih awal pada pukul ".now()->format('H:i')." WIB. Alasan: \"{$earlyOutReason}\". Membutuhkan persetujuan Anda.",
                'warning',
                self::ROUTE_APPROVALS,
                'notif',
                false
            );
        }

        $this->notify(
            $user,
            'ABSEN PULANG AWAL TERCATAT (MENUNGGU PERSETUJUAN)',
            'Absen keluar lebih awal Anda pada pukul '.now()->format('H:i').' WIB telah dicatat dan sedang menunggu persetujuan Super Admin.',
            'info',
            null,
            'notif',
            false
        );

        return $this->successResponse($attendance->fresh(), "Absen pulang awal berhasil dicatat. Menunggu persetujuan Super Admin.{$scoreText}");
    }

    public function today(Request $request)
    {
        $user = $request->user();
        $attendance = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', Carbon::today())
            ->first();

        return $this->successResponse($attendance, 'Status absensi hari ini.');
    }

    public function history(Request $request)
    {
        $user = $request->user();
        $query = Attendance::with(['user.role', 'user.office']);

        $this->scopeHistoryAccess($query, $user, $request);
        $this->applyHistoryFilters($query, $request);

        $perPage = min((int) ($request->per_page ?? 15), 1000);
        $history = $query->orderBy('check_in', 'desc')->paginate($perPage);

        return $this->successResponse($history, 'Riwayat absensi berhasil diambil.');
    }

    private function scopeHistoryAccess($query, User $user, Request $request): void
    {
        $isSuperAdmin = $user->canAccessAllCompanies() || $user->isSuperAdmin() || $user->role_id === 1;
        $canViewReports = $isSuperAdmin || $user->hasPermission('view-reports');
        $scope = $request->input('scope');

        if (($scope === 'company' || $scope === 'all') && $canViewReports) {
            $this->applyCompanyScopeFilter($query, $user, $request, $isSuperAdmin);
            return;
        }

        if ($scope === 'team') {
            $this->applyTeamScopeFilter($query, $user);
            return;
        }

        if ($request->filled('user_id') && $canViewReports) {
            $query->where('user_id', $request->user_id);
            $this->applyUserCompanyConstraint($query, $user);
            return;
        }

        // DEFAULT: Strictly isolate to the logged-in user's OWN attendance records
        $query->where('user_id', $user->id);
        $this->applyUserCompanyConstraint($query, $user);
    }

    private function applyCompanyScopeFilter($query, User $user, Request $request, bool $isSuperAdmin): void
    {
        if ($request->company_id && $request->company_id !== 'all' && $isSuperAdmin) {
            $query->where('company_id', $request->company_id);
        } elseif ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }
    }

    private function applyTeamScopeFilter($query, User $user): void
    {
        $subordinateIds = EmployeeQueryService::resolveSubordinateIds($user->id);
        $query->whereIn('user_id', $subordinateIds);
        $this->applyUserCompanyConstraint($query, $user);
    }

    private function applyUserCompanyConstraint($query, User $user): void
    {
        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        }
    }

    private function applyHistoryFilters($query, Request $request): void
    {
        if ($request->start_date && $request->end_date) {
            $query->whereDate('check_in', '>=', $request->start_date)
                ->whereDate('check_in', '<=', $request->end_date);
        } elseif ($request->date) {
            $query->whereDate('check_in', $request->date);
        }

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->channel && $request->channel !== 'all') {
            $query->where('channel', $request->channel);
        }

        if ($request->status && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->attendance_type && $request->attendance_type !== 'all') {
            $query->where('attendance_type', $request->attendance_type);
        }

        if ($request->search) {
            $search = $request->search;
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }
    }

    public function heatmap(Request $request)
    {
        /** @var User $user */
        $user = Auth::user();

        // Security check: Only Super Admin can access the attendance map
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');
        if (! $isSuperAdmin && ! $user->hasPermission('view-attendance-map')) {
            return $this->errorResponse('Akses ditolak. Fitur Peta Kehadiran hanya untuk Super Admin.', 403);
        }

        $query = Attendance::with('user')
            ->whereDate('check_in', Carbon::today());

        if (! $user->canAccessAllCompanies() && $user->company_id) {
            $query->where('company_id', $user->company_id);
        }

        $attendances = $query->get();

        return $this->successResponse($attendances, 'Data heatmap absensi hari ini berhasil diambil.');
    }

    public function suspiciousRecords(Request $request)
    {
        $user = $request->user();
        if (! $user->is_manager && ! str_contains(strtolower($user->role->name), 'admin')) {
            return $this->errorResponse('Akses ditolak.', 403);
        }

        $query = Attendance::with('user')->where('company_id', $user->company_id);

        // Filters
        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->start_date && $request->end_date) {
            $query->whereDate('check_in', '>=', $request->start_date)
                ->whereDate('check_in', '<=', $request->end_date);
        }

        // Show ALL for now or just the marked ones?
        // Usually, the report shows ALL with a status of "Suspicious" if any flag caught it.
        // For the sake of this task, I'll return records where is_suspicious is true
        // OR simply return all with suspicious reason.

        $records = $query->where('is_suspicious', true)
            ->orderBy('id', 'desc')
            ->paginate(20);

        return $this->successResponse($records, 'Data kecurigaan berhasil diambil.');
    }

    public function summaryRecords(Request $request)
    {
        $user = $request->user();
        $startDate = $request->start_date ?? Carbon::now()->startOfMonth()->toDateString();
        $endDate = $request->end_date ?? Carbon::now()->toDateString();

        $query = User::where('company_id', $user->company_id);

        if ($request->user_id) {
            $query->where('id', $request->user_id);
        }

        $summary = $query->with(['attendances' => function ($q) use ($startDate, $endDate) {
            $q->whereBetween('check_in', [$startDate.' 00:00:00', $endDate.' 23:59:59']);
        }])->get()->map(function ($emp) {
            $atts = $emp->attendances;

            return [
                'user_id' => $emp->id,
                'name' => $emp->name,
                'total_present' => $atts->count(),
                'total_late' => $atts->where('status', 'late')->count(),
                'total_on_time' => $atts->where('status', 'present')->count(),
                'total_suspicious' => $atts->where('is_suspicious', true)->count(),
                // Placeholder for alphabetic/absent logic if needed
            ];
        });

        return $this->successResponse($summary, 'Ringkasan kehadiran berhasil diambil.');
    }

    public function export(Request $request)
    {
        $user = $request->user();
        $fileName = 'attendance_'.now()->format('Y_m_d_His').'.xlsx';

        return Excel::download(
            new AttendanceExport(
                $user->company_id,
                $request->user_id, // optional: filter per karyawan
                $request->start_date,
                $request->end_date
            ),
            $fileName
        );
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $attendance = Attendance::where('company_id', $user->company_id)->findOrFail($id);

        $request->validate([
            'check_in' => 'nullable|date',
            'check_out' => 'nullable|date',
            'status' => 'nullable|string',
        ]);

        if ($request->has('check_in')) {
            $attendance->check_in = $request->check_in;
        }

        if ($request->has('check_out')) {
            $attendance->check_out = $request->check_out;
        }

        if ($request->has('status')) {
            $attendance->status = $request->status;
        }

        $attendance->save();

        return $this->successResponse($attendance, 'Data absensi berhasil dikoreksi.');
    }
}
