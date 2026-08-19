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
    use Notifiable, \App\Traits\HandlesAttendanceDinasLuar, \App\Traits\HandlesAttendanceProcessing;

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
        $imageName = $this->saveCompressedAttendanceImage($request, 'in');

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
        } elseif ($now->lt($minCheckOutTime)) {
            $diffMinutes = $now->diffInMinutes($minCheckOutTime);
            $hours = floor($diffMinutes / 60);
            $mins = $diffMinutes % 60;
            $timeRemaining = ($hours > 0 ? $hours . ' jam ' : '') . $mins . ' menit';
            $response = $this->errorResponse("Belum saatnya pulang! Jam pulang Anda adalah pukul {$minCheckOutTime->format('H:i')} WIB (Kurang {$timeRemaining} lagi).", 400);
        }

        if ($response) {
            return $response;
        }

        if ($request->is_mocked) {
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
        $imageName = $this->saveCompressedAttendanceImage($request, 'out');

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
}
