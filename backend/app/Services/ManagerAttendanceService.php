<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;

class ManagerAttendanceService
{
    public function getTeamAttendance(User $user, bool $isCompanyAdmin, ?string $targetDate = null, ?string $companyId = null): array
    {
        $date = $targetDate ? Carbon::parse($targetDate)->toDateString() : Carbon::today()->toDateString();
        $isGlobalAdmin = $user->isSuperAdmin() || $user->canAccessAllCompanies();
        $directSubordinateIds = User::where('supervisor_id', $user->id)->pluck('id');

        $query = User::with(['role', 'attendances' => function ($q) use ($date) {
            $q->whereDate('check_in', $date);
        }]);

        if ($isGlobalAdmin) {
            $query->where('id', '!=', $user->id);
            if ($companyId && $companyId !== 'all') {
                $query->where('company_id', $companyId);
            } elseif ($user->company_id && !$user->canAccessAllCompanies()) {
                $query->where('company_id', $user->company_id);
            }
        } elseif ($isCompanyAdmin) {
            $comp = ($companyId && $companyId !== 'all') ? $companyId : $user->company_id;
            if ($comp) {
                $query->where('company_id', $comp);
            }
            $query->where('id', '!=', $user->id);
        } elseif ($directSubordinateIds->isNotEmpty()) {
            $query->whereIn('id', $directSubordinateIds);
        } else {
            $query->where('supervisor_id', $user->id);
        }

        return $query->get()->map(fn ($sub) => $this->formatMemberAttendance($sub))->all();
    }

    private function formatMemberAttendance(User $sub): array
    {
        $attendance = $sub->attendances->first();

        $status = 'Belum Masuk';
        if ($attendance) {
            $status = $attendance->check_out ? 'Selesai' : 'Hadir';
        }

        $locationLabel = null;
        if ($attendance) {
            $locationLabel = ($attendance->attendance_type === 'dinas_luar') ? 'Dinas Luar' : 'Di Kantor';
        }

        $checkInFormatted = null;
        if ($attendance?->check_in) {
            $checkInFormatted = Carbon::parse($attendance->check_in)->format('H:i');
        }

        $checkOutFormatted = null;
        if ($attendance?->check_out) {
            $checkOutFormatted = Carbon::parse($attendance->check_out)->format('H:i');
        }

        $rawPattern = $sub->attendance_type ?: 'office_hour';
        $normalizedPattern = match ($rawPattern) {
            'shift', 'shift_hour' => 'shift',
            'flexible', 'flexi' => 'flexible',
            default => 'office_hour',
        };

        return [
            'id' => $sub->id,
            'name' => $sub->name,
            'role' => $sub->role?->name ?? 'Karyawan',
            'photo_url' => $sub->profile_photo_url,
            'status' => $status,
            'check_in' => $checkInFormatted,
            'check_out' => $checkOutFormatted,
            'attendance_type' => $attendance?->attendance_type ?? 'office',
            'is_dinas_luar' => $attendance?->attendance_type === 'dinas_luar',
            'dinas_luar_destination' => $attendance?->dinas_luar_destination,
            'dinas_luar_status' => $attendance?->dinas_luar_status,
            'location_label' => $locationLabel,
            'work_pattern' => $normalizedPattern,
            'user_attendance_type' => $sub->attendance_type,
        ];
    }
}
