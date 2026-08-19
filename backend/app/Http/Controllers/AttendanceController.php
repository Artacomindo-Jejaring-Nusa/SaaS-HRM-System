<?php

namespace App\Http\Controllers;

use App\Exports\AttendanceExport;
use App\Models\Attendance;
use App\Models\Office;
use App\Models\Schedule;
use App\Models\User;
use App\Traits\Notifiable;
use App\Http\Requests\StoreAttendanceRequest;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;
use Maatwebsite\Excel\Facades\Excel;

class AttendanceController extends Controller
{
    use Notifiable;

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
            $response = $this->errorResponse('Anda sudah check-in hari ini.', 400);
        } elseif ($securityError = $this->validateDeviceAndSecurity($user, $request)) {
            $response = $this->errorResponse($securityError['message'], $securityError['code']);
        } elseif ($isDinasLuar) {
            // Dinas Luar: skip geofence, but still requires selfie (validated by request rules)
            $response = $this->processCheckIn($user, $request, null, $now, $today);
        } elseif (!($geoResult = $this->validateGeofencing($user, $request))['success']) {
            $response = $this->errorResponse($geoResult['message'], $geoResult['status']);
        } else {
            $response = $this->processCheckIn($user, $request, $geoResult['office'], $now, $today);
        }

        return $response;
    }

    private function processCheckIn(User $user, StoreAttendanceRequest $request, $matchedOffice, Carbon $now, string $today)
    {
        $isDinasLuar = $request->attendance_type === 'dinas_luar';

        $schedule = Schedule::with('shift')
            ->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        $status = $isDinasLuar ? 'dinas_luar' : $this->determineCheckInStatus($user, $schedule, $now);

        // Handle Image & Compression
        $imageName = null;
        $file = $request->hasFile('image') ? $request->file('image') : ($request->image instanceof \Symfony\Component\HttpFoundation\File\UploadedFile ? $request->image : null);
        if ($file) {
            $imageName = 'attendance/in_'.Str::random(40).'.jpg';
            // Compress and resize image to save storage space (target ~50-80KB)
            $img = Image::decode($file);
            $img->scale(width: 800);
            Storage::disk('public')->put($imageName, (string) $img->encodeUsingFileExtension('jpg', 80));
        }

        $attendanceData = [
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'check_in' => $now,
            'latitude_in' => $request->latitude,
            'longitude_in' => $request->longitude,
            'image_in' => $imageName,
            'status' => $status,
            'office_id' => $matchedOffice ? $matchedOffice->id : null,
            'attendance_type' => $isDinasLuar ? 'dinas_luar' : 'office',
        ];

        // Add dinas luar specific fields
        if ($isDinasLuar) {
            $attendanceData['dinas_luar_destination'] = $request->dinas_luar_destination;
            $attendanceData['dinas_luar_notes'] = $request->dinas_luar_notes;
            $attendanceData['dinas_luar_status'] = 'pending';
        }

        $attendance = Attendance::create($attendanceData);

        if ($isDinasLuar) {
            $this->sendDinasLuarNotifications($user, $attendance);
        } else {
            $this->sendCheckInNotifications($user, $status, $now);
        }

        $message = $isDinasLuar
            ? 'Absen Dinas Luar berhasil tercatat. Menunggu persetujuan Supervisor.'
            : 'Check-in berhasil. Status: '.$status;

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

        $faceMatch = true;

        // Check minimum clock-out time (Default: 17:00 WIB / 5 PM, or Shift End Time)
        $now = now();
        $today = Carbon::today()->toDateString();
        $minCheckOutTime = Carbon::today()->setHour(17)->setMinute(0)->setSecond(0);

        $schedule = Schedule::with('shift')
            ->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        if ($schedule && $schedule->shift && $schedule->shift->end_time) {
            $minCheckOutTime = Carbon::parse($today . ' ' . $schedule->shift->end_time);
        }

        if (! $attendance) {
            $response = $this->errorResponse('Anda belum check-in atau sudah check-out.', 400);
        } elseif ($now->lt($minCheckOutTime) && $user->role_id !== 1 && ! $request->boolean('allow_early_checkout')) {
            $formattedTime = $minCheckOutTime->format('H:i');
            $response = $this->errorResponse("Belum jam pulang kerja! Absen pulang baru dapat dilakukan mulai pukul {$formattedTime} WIB.", 400);
        } elseif ($request->is_mocked) {
            $response = $this->errorResponse('Lokasi Palsu Terdeteksi! Mohon gunakan GPS asli.', 403);
        } elseif ($request->device_id && $user->device_id && $user->device_id !== $request->device_id) {
            $response = $this->errorResponse('HP Anda tidak terdaftar. Gunakan HP yang sama saat absen masuk.', 403);
        } elseif ($request->hasFile('image') && $user->profile_photo_path && ! $faceMatch) {
            $response = $this->errorResponse('Wajah tidak cocok dengan profil Anda.', 403);
        } else {
            $response = $this->processCheckOut($attendance, $user, $request);
        }

        return $response;
    }

    private function processCheckOut(Attendance $attendance, User $user, StoreAttendanceRequest $request)
    {
        // Handle Image & Compression
        $imageName = null;
        $file = $request->hasFile('image') ? $request->file('image') : ($request->image instanceof \Symfony\Component\HttpFoundation\File\UploadedFile ? $request->image : null);
        if ($file) {
            $imageName = 'attendance/out_'.Str::random(40).'.jpg';
            // Compress and resize image to save storage space
            $img = Image::decode($file);
            $img->scale(width: 800);
            Storage::disk('public')->put($imageName, (string) $img->encodeUsingFileExtension('jpg', 80));
        }

        $attendance->update([
            'check_out' => now(),
            'latitude_out' => $request->latitude,
            'longitude_out' => $request->longitude,
            'image_out' => $imageName,
        ]);

        $this->notify(
            $user,
            'BERHASIL ABSEN KELUAR',
            'Anda telah berhasil absen keluar pada pukul '.now()->format('H:i').' WIB. Terima kasih atas kerja keras Anda!',
            'info',
            null,
            'notif',
            false
        );

        return $this->successResponse($attendance, 'Check-out berhasil.');
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
        $query = Attendance::with('user')->where('company_id', $request->user()->company_id);

        $user = $request->user();

        if ($user->canAccessAllCompanies()) {
            // Master Admin sees all
        } elseif ($user->is_manager) {
            $query->where('company_id', $user->company_id);
        } else {
            $query->where('user_id', $user->id)
                ->where('company_id', $user->company_id);
        }

        if ($request->start_date && $request->end_date) {
            $query->whereDate('check_in', '>=', $request->start_date)
                ->whereDate('check_in', '<=', $request->end_date);
        }

        if ($request->user_id) { // Tambahan filter ID karyawan jika dikirim
            $query->where('user_id', $request->user_id);
        }

        $history = $query->orderBy('id', 'desc')->paginate(10);

        return $this->successResponse($history, 'Riwayat absensi berhasil diambil.');
    }

    public function heatmap(Request $request)
    {
        /** @var User $user */
        $user = Auth::user();

        // Security check: Only Admin, HR, or Owner can see the map
        $userRoleName = $user->role ? strtolower($user->role->name) : '';
        if (str_contains($userRoleName, 'karyawan') && ! str_contains($userRoleName, 'admin') && ! str_contains($userRoleName, 'hr')) {
            return $this->errorResponse('Akses ditolak. Fitur ini hanya untuk Admin/HR.', 403);
        }

        $attendances = Attendance::with('user')
            ->where('company_id', $user->company_id)
            ->whereDate('check_in', Carbon::today())
            ->get();

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

    private function validateDeviceAndSecurity($user, $request)
    {
        if ($request->is_mocked) {
            return ['message' => 'Lokasi Palsu Terdeteksi! Mohon gunakan GPS asli perangkat Anda.', 'code' => 403];
        }

        if ($request->device_id) {
            if (! $user->device_id) {
                $user->update(['device_id' => $request->device_id]);
            } elseif ($user->device_id !== $request->device_id) {
                return ['message' => 'HP Anda tidak terdaftar. Mohon hubungi Admin untuk reset Device ID.', 'code' => 403];
            }
        }

        $faceMatch = true;
        if ($request->hasFile('image') && $user->profile_photo_path && ! $faceMatch) {
            return ['message' => 'Wajah tidak cocok dengan profil Anda. Pastikan wajah terlihat jelas!', 'code' => 403];
        }

        return null;
    }

    private function findNearestOffice($allOffices, $userLat, $userLng)
    {
        $nearestDistance = PHP_INT_MAX;
        $matchedOffice = null;

        foreach ($allOffices as $office) {
            $distance = $this->calculateDistance($userLat, $userLng, $office->latitude, $office->longitude);
            if ($distance <= ($office->radius ?? 100) && $distance < $nearestDistance) {
                $nearestDistance = $distance;
                $matchedOffice = $office;
            }
        }

        return $matchedOffice;
    }

    private function determineCheckInStatus($user, $schedule, $now)
    {
        $shift = $schedule ? $schedule->shift : null;

        if ($shift) {
            if ($now->toTimeString() > $shift->start_time) {
                return 'late';
            }
            return 'present';
        }

        return $user->attendance_type === 'shift' ? 'no_schedule' : 'office_hour';
    }

    private function sendCheckInNotifications($user, $status, $now)
    {
        $this->notify(
            $user,
            'BERHASIL ABSEN MASUK',
            "Anda telah berhasil absen masuk pada pukul {$now->format('H:i')} WIB. Status: ".strtoupper($status),
            $status === 'late' ? 'warning' : 'success',
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

    private function checkAssignedOffice($userLat, $userLng, $officeId)
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

    private function checkCompanyRadius($user, $userLat, $userLng)
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

    private function validateGeofencing($user, $request)
    {
        $userRoleName = $user->role ? strtolower($user->role->name) : '';
        $isTechnician = str_contains($userRoleName, 'teknisi');

        $today = now()->startOfDay();
        $isWfhActive = $user->is_wfh && ($user->wfh_start_date <= $today && $user->wfh_end_date >= $today);

        if ($isTechnician || $isWfhActive) {
            return ['success' => true, 'office' => null];
        }

        $userLat = $request->latitude;
        $userLng = $request->longitude;

        if ($user->office_id) {
            $assignedCheck = $this->checkAssignedOffice($userLat, $userLng, $user->office_id);
            if ($assignedCheck) {
                return $assignedCheck;
            }
        }

        $allOffices = Office::where('company_id', $user->company_id)->active()->get();
        $matchedOffice = $this->findNearestOffice($allOffices, $userLat, $userLng);

        if (! $matchedOffice) {
            return $this->checkCompanyRadius($user, $userLat, $userLng);
        }

        return ['success' => true, 'office' => $matchedOffice];
    }

    private function calculateDistance($lat1, $lon1, $lat2, $lon2)
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

    // ── Dinas Luar Notifications ──

    private function sendDinasLuarNotifications(User $user, Attendance $attendance)
    {
        // Notify the employee
        $this->notify(
            $user,
            'ABSEN DINAS LUAR TERCATAT',
            "Absensi Dinas Luar Anda ke {$attendance->dinas_luar_destination} telah tercatat pada pukul ".now()->format('H:i').' WIB. Menunggu persetujuan Supervisor.',
            'info',
            null,
            'notif',
            false
        );

        // Notify the supervisor
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

    // ── Dinas Luar Approval Endpoints ──

    public function pendingDinasLuar(Request $request)
    {
        $user = $request->user();
        $query = Attendance::with(['user', 'spvApprover', 'hrApprover'])
            ->where('company_id', $user->company_id)
            ->where('attendance_type', 'dinas_luar');

        // Filter by status
        if ($request->status) {
            $query->where('dinas_luar_status', $request->status);
        } else {
            $query->whereIn('dinas_luar_status', ['pending', 'approved_spv']);
        }

        // SPV only sees their subordinates
        if (! $user->is_manager && ! $user->hasPermission('manage-attendance-corrections')) {
            $query->whereHas('user', fn ($q) => $q->where('supervisor_id', $user->id));
        }

        $records = $query->orderBy('check_in', 'desc')->paginate(15);

        return $this->successResponse($records, 'Data dinas luar berhasil diambil.');
    }

    public function approveDinasLuarSpv(Request $request, $id)
    {
        $user = $request->user();
        $attendance = Attendance::where('company_id', $user->company_id)
            ->where('attendance_type', 'dinas_luar')
            ->where('dinas_luar_status', 'pending')
            ->findOrFail($id);

        // Verify the approver is the employee's supervisor
        $employee = $attendance->user;
        if ($employee->supervisor_id !== $user->id && ! $user->hasPermission('manage-attendance-corrections')) {
            return $this->errorResponse('Anda bukan supervisor karyawan ini.', 403);
        }

        $attendance->update([
            'dinas_luar_status' => 'approved_spv',
            'approved_by_spv' => $user->id,
            'approved_at_spv' => now(),
        ]);

        // Notify employee
        $this->notify(
            $employee,
            'DINAS LUAR DISETUJUI SUPERVISOR',
            "Pengajuan dinas luar Anda ke {$attendance->dinas_luar_destination} telah disetujui oleh Supervisor {$user->name}. Menunggu persetujuan HRD.",
            'success'
        );

        // Notify HR users
        $hrUsers = User::where('company_id', $user->company_id)
            ->whereHas('role', fn ($q) => $q->where('name', 'like', '%HRD%')->orWhere('name', 'like', '%HR%'))
            ->get();

        foreach ($hrUsers as $hr) {
            $this->notify(
                $hr,
                'PERSETUJUAN DINAS LUAR (HRD)',
                "Dinas luar {$employee->name} ke {$attendance->dinas_luar_destination} telah disetujui Supervisor. Mohon persetujuan akhir dari HRD.",
                'warning',
                '/dashboard/approvals'
            );
        }

        return $this->successResponse($attendance->fresh(), 'Dinas luar disetujui oleh Supervisor.');
    }

    public function approveDinasLuarHr(Request $request, $id)
    {
        $user = $request->user();
        $attendance = Attendance::where('company_id', $user->company_id)
            ->where('attendance_type', 'dinas_luar')
            ->where('dinas_luar_status', 'approved_spv')
            ->findOrFail($id);

        $attendance->update([
            'dinas_luar_status' => 'approved_hr',
            'approved_by_hr' => $user->id,
            'approved_at_hr' => now(),
            'status' => 'present', // Final status: hadir
        ]);

        $employee = $attendance->user;
        $this->notify(
            $employee,
            'DINAS LUAR DISETUJUI HRD',
            "Selamat! Pengajuan dinas luar Anda ke {$attendance->dinas_luar_destination} telah disetujui sepenuhnya oleh HRD {$user->name}.",
            'success'
        );

        return $this->successResponse($attendance->fresh(), 'Dinas luar disetujui oleh HRD.');
    }

    public function rejectDinasLuar(Request $request, $id)
    {
        $request->validate(['reason' => 'required|string|max:500']);

        $user = $request->user();
        $attendance = Attendance::where('company_id', $user->company_id)
            ->where('attendance_type', 'dinas_luar')
            ->whereIn('dinas_luar_status', ['pending', 'approved_spv'])
            ->findOrFail($id);

        $attendance->update([
            'dinas_luar_status' => 'rejected',
            'rejection_reason' => $request->reason,
            'status' => 'alfa', // Ditolak = dianggap tidak hadir
        ]);

        $employee = $attendance->user;
        $this->notify(
            $employee,
            'DINAS LUAR DITOLAK',
            "Pengajuan dinas luar Anda ke {$attendance->dinas_luar_destination} telah ditolak. Alasan: {$request->reason}",
            'danger'
        );

        return $this->successResponse($attendance->fresh(), 'Dinas luar ditolak.');
    }
}
