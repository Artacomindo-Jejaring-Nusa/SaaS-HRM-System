<?php

namespace App\Traits;

use App\Models\Attendance;
use App\Models\Office;
use App\Models\Schedule;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;

trait HandlesAttendanceProcessing
{
    private function determineCheckInStatus(User $user, ?Schedule $schedule, Carbon $now): string
    {
        if ($schedule && $schedule->shift) {
            $shift = $schedule->shift;
            if ($now->toTimeString() > $shift->start_time) {
                return 'late';
            }
            return 'present';
        }

        return $user->attendance_type === 'shift' ? 'no_schedule' : 'office_hour';
    }

    private function sendCheckInNotifications(User $user, string $status, Carbon $now): void
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
        } elseif ($request->image instanceof \Symfony\Component\HttpFoundation\File\UploadedFile) {
            $file = $request->image;
        }

        if (! $file) {
            return null;
        }

        $imageName = "attendance/{$prefix}_".Str::random(40).'.jpg';
        $img = Image::decode($file);
        $img->scale(width: 800);
        Storage::disk('public')->put($imageName, (string) $img->encodeUsingFileExtension('jpg', 80));

        return $imageName;
    }
}
