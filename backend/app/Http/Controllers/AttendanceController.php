<?php

namespace App\Http\Controllers;

use App\Exports\AttendanceExport;
use App\Models\Attendance;
use App\Models\Office;
use App\Models\Schedule;
use App\Models\User;
use App\Traits\Notifiable;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Laravel\Facades\Image;
use Maatwebsite\Excel\Facades\Excel;

class AttendanceController extends Controller
{
    use Notifiable;

    public function checkIn(Request $request)
    {
        $user = $request->user();
        $now = now();
        $today = Carbon::today()->toDateString();

        $attendance = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', $today)
            ->first();

        if ($attendance) {
            return $this->errorResponse('Anda sudah check-in hari ini.', 400);
        }

        $securityError = $this->validateDeviceAndSecurity($user, $request);
        if ($securityError) {
            return $this->errorResponse($securityError['message'], $securityError['code']);
        }

        $schedule = Schedule::with('shift')
            ->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        $status = $this->determineCheckInStatus($user, $schedule, $now);

        // --- Geofencing Check (Multi-Office) ---
        $geoResult = $this->validateGeofencing($user, $request);
        if (!$geoResult['success']) {
            return $this->errorResponse($geoResult['message'], $geoResult['status']);
        }
        $matchedOffice = $geoResult['office'];

        // Handle Image & Compression
        $imageName = null;
        if ($request->image) {
            $imageName = 'attendance/in_'.$user->id.'_'.time().'.jpg';
            // Compress and resize image to save storage space (target ~50-80KB)
            $img = Image::decode($request->image);
            $img->scale(width: 800);
            Storage::disk('public')->put($imageName, (string) $img->encodeUsingFileExtension('jpg', 80));
        }

        $attendance = Attendance::create([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'check_in' => $now,
            'latitude_in' => $request->latitude,
            'longitude_in' => $request->longitude,
            'image_in' => $imageName,
            'status' => $status,
            'office_id' => $matchedOffice ? $matchedOffice->id : null,
        ]);

        $this->sendCheckInNotifications($user, $status, $now);

        return $this->successResponse($attendance, 'Check-in berhasil. Status: '.$status);
    }

    public function checkOut(Request $request)
    {
        $user = $request->user();

        $attendance = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', Carbon::today())
            ->whereNull('check_out')
            ->first();

        if (! $attendance) {
            return $this->errorResponse('Anda belum check-in atau sudah check-out.', 400);
        }

        // --- 1. Fake GPS Check ---
        if ($request->is_mocked) {
            return $this->errorResponse('Lokasi Palsu Terdeteksi! Mohon gunakan GPS asli.', 403);
        }

        // --- 2. Device Binding Check ---
        if ($request->device_id && $user->device_id && $user->device_id !== $request->device_id) {
            return $this->errorResponse('HP Anda tidak terdaftar. Gunakan HP yang sama saat absen masuk.', 403);
        }

        // --- 3. Foto Selfie Check & Face Match Placeholder ---
        // Image is now optional

        $faceMatch = true;
        if ($request->image && $user->profile_photo_path && ! $faceMatch) {
            return $this->errorResponse('Wajah tidak cocok dengan profil Anda.', 403);
        }

        // Handle Image & Compression
        $imageName = null;
        if ($request->image) {
            $imageName = 'attendance/out_'.$user->id.'_'.time().'.jpg';
            // Compress and resize image to save storage space
            $img = Image::decode($request->image);
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
        if ($request->image && $user->profile_photo_path && ! $faceMatch) {
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
}
