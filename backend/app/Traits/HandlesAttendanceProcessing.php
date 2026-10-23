<?php

namespace App\Traits;

use App\Events\EmployeeLocationUpdated;
use App\Http\Requests\StoreAttendanceRequest;
use App\Models\Attendance;
use App\Models\EmployeeTrack;
use App\Models\Office;
use App\Models\Schedule;
use App\Models\User;
use App\Services\EmployeeQueryService;
use App\Support\SelfieImage;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\File\UploadedFile;

trait HandlesAttendanceProcessing
{
    protected const DEFAULT_FACE_BYPASS_REASON = 'Verifikasi wajah gagal';
    protected const ROUTE_APPROVALS = '/dashboard/approvals';

    private function resolveExistingAttendanceConflict(?Attendance &$attendance): ?JsonResponse
    {
        if (! $attendance) {
            return null;
        }

        if ($attendance->channel === 'web' && $attendance->web_approval_status === 'pending') {
            $attendance->delete();
            $attendance = null;
            return null;
        }

        $isDualConflict = $attendance->channel === 'web' && $attendance->web_approval_status === 'valid';
        if ($isDualConflict) {
            $attendance->update([
                'is_suspicious' => true,
                'suspicious_reason' => 'Konflik Entri Ganda: Terdeteksi Absen Web Valid dan Absen Mobile Sinkronisasi pada hari yang sama.',
            ]);
        }

        $errorMessage = $isDualConflict
            ? 'Konflik Sinkronisasi: Anda sudah memiliki catatan Absen Web yang tervalidasi hari ini. Data ditandai untuk ditinjau Superadmin.'
            : 'Anda sudah check-in hari ini.';

        return $this->errorResponse($errorMessage, 400);
    }

    private function executeCheckInFlow(User $user, StoreAttendanceRequest $request, Carbon $now, string $today): JsonResponse
    {
        if ($securityError = $this->validateDeviceAndSecurity($user, $request)) {
            return $this->errorResponse($securityError['message'], $securityError['code']);
        }

        if (in_array($request->attendance_type, ['dinas_luar', 'wfh'], true)) {
            return $this->processCheckIn($user, $request, null, $now, $today);
        }

        $geoResult = $this->validateGeofencing($user, $request);
        return $geoResult['success']
            ? $this->processCheckIn($user, $request, $geoResult['office'], $now, $today)
            : $this->errorResponse($geoResult['message'], $geoResult['status']);
    }

    private function processCheckIn(User $user, StoreAttendanceRequest $request, $matchedOffice, Carbon $now, string $today)
    {
        $isDinasLuar = $request->attendance_type === 'dinas_luar';

        $schedule = Schedule::with('shift')
            ->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        $status = $isDinasLuar ? 'dinas_luar' : $this->determineCheckInStatus($user, $schedule, $now);
        $imageName = $this->saveCompressedAttendanceImage($request, 'in');
        $isAutoValidated = $user->isWebAttendanceAutoValidated();

        $attendanceData = $this->buildMobileAttendanceData($user, $request, $matchedOffice, $status, $imageName, $now);
        $attendance = Attendance::create($attendanceData);

        $this->recordCheckInEmployeeTrack($user, $request, $now);
        $this->dispatchCheckInNotifications($user, $attendance, $request, $status, $now);

        $message = $this->buildCheckInSuccessMessage($isDinasLuar, $isAutoValidated, $status, $request);

        return $this->successResponse($attendance, $message);
    }

    private function resolveAttendanceType(StoreAttendanceRequest $request): string
    {
        if ($request->attendance_type === 'dinas_luar') {
            return 'dinas_luar';
        }
        if ($request->attendance_type === 'wfh') {
            return 'wfh';
        }
        return 'office';
    }

    private function buildMobileAttendanceData(User $user, StoreAttendanceRequest $request, $matchedOffice, string $status, ?string $imageName, Carbon $now): array
    {
        $isDinasLuar = $request->attendance_type === 'dinas_luar';
        $resolvedAttendanceType = $this->resolveAttendanceType($request);
        $isBypass = $request->boolean('bypass_face_recognition');
        $isAutoValidated = $user->isWebAttendanceAutoValidated();

        $data = [
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
            'attendance_type' => $resolvedAttendanceType,
            'channel' => 'mobile',
        ];

        if ($isBypass) {
            $this->applyFaceBypassData($data, $request, $isAutoValidated, $now);
        }

        if ($isDinasLuar) {
            $data['dinas_luar_destination'] = $request->dinas_luar_destination;
            $data['dinas_luar_notes'] = $request->dinas_luar_notes;
            $data['dinas_luar_status'] = $isAutoValidated ? 'approved' : 'pending';
            if ($isAutoValidated) {
                $data['approved_by_hr'] = $user->id;
                $data['approved_at_hr'] = $now;
                $data['approved_by_spv'] = $user->id;
                $data['approved_at_spv'] = $now;
            }
        }

        return $data;
    }

    private function applyFaceBypassData(array &$data, StoreAttendanceRequest $request, bool $isAutoValidated, Carbon $now): void
    {
        $bypassReason = $request->input('bypass_reason', self::DEFAULT_FACE_BYPASS_REASON);
        $data['is_suspicious'] = ! $isAutoValidated;
        $data['suspicious_reason'] = $isAutoValidated
            ? "Auto-Validated: Tanpa verifikasi wajah ({$bypassReason})"
            : "Tanpa verifikasi wajah: {$bypassReason}";
        $data['web_approval_status'] = $isAutoValidated ? 'valid' : 'pending';
        $data['web_approved_at'] = $isAutoValidated ? $now : null;
    }

    private function recordCheckInEmployeeTrack(User $user, StoreAttendanceRequest $request, Carbon $now): void
    {
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
    }

    private function dispatchCheckInNotifications(User $user, Attendance $attendance, StoreAttendanceRequest $request, string $status, Carbon $now): void
    {
        $isDinasLuar = $attendance->attendance_type === 'dinas_luar';
        $isBypass = $request->boolean('bypass_face_recognition');
        $isAutoValidated = $user->isWebAttendanceAutoValidated();

        if ($isBypass && ! $isAutoValidated) {
            $bypassReason = $request->input('bypass_reason', self::DEFAULT_FACE_BYPASS_REASON);
            $this->notifySuperAdmins(
                $user->company_id,
                'ABSENSI MANUAL BUTUH VALIDASI SUPER ADMIN',
                "Karyawan {$user->name} melakukan absen masuk manual (wajah gagal) pada pukul {$now->format('H:i')} WIB. Catatan: \"{$bypassReason}\". Menunggu validasi Super Admin.",
                'warning',
                self::ROUTE_APPROVALS,
                $user->id
            );
        }

        if ($isDinasLuar) {
            if ($isAutoValidated) {
                $this->notify(
                    $user,
                    'DINAS LUAR DISETUJUI OTOMATIS',
                    "Absen dinas luar Anda ke {$attendance->dinas_luar_destination} berhasil disahkan secara otomatis (Validasi Otomatis Aktif).",
                    'success',
                    null,
                    'notif',
                    false
                );
            } else {
                $this->sendDinasLuarNotifications($user, $attendance);
            }
        } else {
            $this->sendCheckInNotifications($user, $status, $now);
        }
    }

    private function buildCheckInSuccessMessage(bool $isDinasLuar, bool $isAutoValidated, string $status, StoreAttendanceRequest $request): string
    {
        $score = $request->attributes->get('face_similarity_score_in');
        $scorePercent = $score !== null ? round($score * 100, 1) : null;
        $scoreText = $scorePercent !== null ? " (Kemiripan Wajah: {$scorePercent}%)" : '';

        if ($isDinasLuar) {
            return $isAutoValidated
                ? "Absen Dinas Luar berhasil disahkan secara otomatis{$scoreText} (Validasi Otomatis Aktif)."
                : "Absen Dinas Luar berhasil tercatat{$scoreText}. Menunggu persetujuan Supervisor.";
        }

        return "Check-in berhasil{$scoreText}. Status: {$status}";
    }
    private function determineCheckInStatus(User $user, ?Schedule $schedule, Carbon $now): string
    {
        // Pola kehadiran fleksibel khusus atasan/pimpinan: tidak ada batasan jam & bebas status terlambat
        if ($user->attendance_type === 'flexible') {
            return 'present';
        }

        if ($user->attendance_type === 'shift' && ! ($schedule && $schedule->shift)) {
            return 'no_schedule';
        }

        $lateToleranceMinutes = (int) ($user->company?->late_tolerance_minutes ?? 0);
        $dateKey = $now->toDateString();
        $startTime = ($schedule && $schedule->shift)
            ? $schedule->shift->start_time
            : ($user->office?->work_start_time ?? $user->company?->work_start_time ?? '08:30:00');

        $threshold = Carbon::parse($dateKey.' '.$startTime)->addMinutes($lateToleranceMinutes);

        return $now->gt($threshold) ? 'late' : 'present';
    }

    private function sendCheckInNotifications(User $user, string $status, Carbon $now): void
    {
        $this->notify(
            $user,
            'BERHASIL ABSEN MASUK',
            "Anda telah berhasil absen masuk pada pukul {$now->format('H:i')} WIB. Status: ".strtoupper($status),
            'success',
            null,
            'notif',
            false
        );

        if ($status === 'late' && $user->supervisor_id) {
            $supervisor = User::find($user->supervisor_id);
            if ($supervisor) {
                $this->notify(
                    $supervisor,
                    'BAWAHAN TERLAMBAT',
                    "Karyawan {$user->name} baru saja absen masuk terlambat (Pukul {$now->format('H:i')}). Status: ".strtoupper($status),
                    'warning',
                    '/dashboard/attendance'
                );
            }
        }
    }

    private function sendDinasLuarNotifications(User $user, Attendance $attendance): void
    {
        $this->notify(
            $user,
            'ABSEN DINAS LUAR TERCATAT',
            "Absensi Dinas Luar Anda ke {$attendance->dinas_luar_destination} telah tercatat pada pukul ".now()->format('H:i').' WIB. Menunggu persetujuan Supervisor.',
            'info',
            null,
            'notif',
            false
        );

        if ($user->supervisor_id) {
            $supervisor = User::find($user->supervisor_id);
            if ($supervisor) {
                $this->notify(
                    $supervisor,
                    'PENGAJUAN DINAS LUAR BAWAHAN',
                    "Karyawan {$user->name} mengajukan absen Dinas Luar ke {$attendance->dinas_luar_destination}. Mohon untuk meninjau dan menyetujui pengajuan ini.",
                    'warning',
                    '/dashboard/approvals'
                );
            }
        }
    }

    private function checkAssignedOffice($userLat, $userLng, $officeId): ?array
    {
        $assignedOffice = Office::find($officeId);
        if ($assignedOffice && $assignedOffice->is_active) {
            $distance = $this->calculateDistance($userLat, $userLng, $assignedOffice->latitude, $assignedOffice->longitude);
            if ($distance > ($assignedOffice->radius ?? 100)) {
                return ['success' => false, 'message' => "Maaf, Anda berada di luar area kantor assigned Anda: {$assignedOffice->name} ({$distance} meter). Silakan mendekat ke lokasi kerja Anda!", 'status' => 400];
            }

            return ['success' => true, 'office' => $assignedOffice];
        }

        return null;
    }

    private function checkCompanyRadius(User $user, $userLat, $userLng): array
    {
        $company = $user->company;
        $targetLat = $company?->latitude ?? null;
        $targetLng = $company?->longitude ?? null;
        $radius = $company?->radius_meters ?? $company?->default_radius ?? 100;

        if ($targetLat && $targetLng) {
            $distance = $this->calculateDistance($userLat, $userLng, $targetLat, $targetLng);
            if ($distance > $radius) {
                return ['success' => false, 'message' => "Maaf, Anda berada di luar area kantor manapun ({$distance} meter dari titik terdekat). Silakan mendekat ke kantor Anda!", 'status' => 400];
            }

            return ['success' => true, 'office' => null];
        }

        return ['success' => false, 'message' => 'Koordinat lokasi kantor belum diatur oleh Admin.', 'status' => 400];
    }

    private function findNearestOffice($offices, $userLat, $userLng): ?Office
    {
        $matchedOffice = null;
        foreach ($offices as $office) {
            $distance = $this->calculateDistance($userLat, $userLng, $office->latitude, $office->longitude);
            if ($distance <= ($office->radius ?? 100)) {
                $matchedOffice = $office;
                break;
            }
        }

        return $matchedOffice;
    }

    private function validateGeofencing(User $user, $request): array
    {
        $userRoleName = $user->role ? strtolower($user->role->name) : '';
        $isTechnician = str_contains($userRoleName, 'teknisi');

        $today = now()->startOfDay();
        $isWfhActive = $user->is_wfh && ($user->wfh_start_date <= $today && $user->wfh_end_date >= $today);

        if ($isTechnician || $isWfhActive) {
            return ['success' => true, 'office' => null];
        }

        return $this->resolveOfficeGeofence($user, $request->latitude, $request->longitude);
    }

    private function resolveOfficeGeofence(User $user, $userLat, $userLng): array
    {
        if ($user->office_id) {
            $assignedCheck = $this->checkAssignedOffice($userLat, $userLng, $user->office_id);
            if ($assignedCheck) {
                return $assignedCheck;
            }
        }

        $allOffices = Office::where('company_id', $user->company_id)->active()->get();
        $matchedOffice = $this->findNearestOffice($allOffices, $userLat, $userLng);

        return $matchedOffice
            ? ['success' => true, 'office' => $matchedOffice]
            : $this->checkCompanyRadius($user, $userLat, $userLng);
    }

    private function calculateDistance($lat1, $lon1, $lat2, $lon2): float
    {
        $earthRadius = 6371000; // dalam meter

        $latDelta = deg2rad($lat2 - $lat1);
        $lonDelta = deg2rad($lon2 - $lon1);

        $a = sin($latDelta / 2) * sin($latDelta / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($lonDelta / 2) * sin($lonDelta / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c);
    }

    private function saveCompressedAttendanceImage($request, string $prefix): ?string
    {
        $file = null;
        if ($request->hasFile('image')) {
            $file = $request->file('image');
        } elseif ($request->image instanceof UploadedFile) {
            $file = $request->image;
        }

        if (! $file) {
            return null;
        }

        $imageName = "attendance/{$prefix}_".Str::random(40).'.jpg';

        return SelfieImage::storeNormalized($file, $imageName);
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
}
