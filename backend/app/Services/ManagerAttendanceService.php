<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;

class ManagerAttendanceService
{
    public static function isCompanyWideViewer(User $user): bool
    {
        return $user->isSuperAdmin() || $user->canAccessAllCompanies();
    }

    public function getTeamAttendance(User $user, ?string $targetDate = null, ?string $companyId = null): array
    {
        $date = $targetDate ? Carbon::parse($targetDate)->toDateString() : Carbon::today()->toDateString();

        $query = User::with(['role', 'attendances' => function ($q) use ($date) {
            $q->whereDate('check_in', $date)->orderBy('id', 'desc');
        }]);

        $this->scopeTeamQuery($query, $user, $companyId);

        return $query->get()->map(fn ($sub) => $this->formatMemberAttendance($sub))->all();
    }

    private function scopeTeamQuery($query, User $user, ?string $companyId): void
    {
        if ($user->isSuperAdmin() || $user->canAccessAllCompanies()) {
            $this->scopeGlobalAdminQuery($query, $user, $companyId);

            return;
        }

        $allSubordinateIds = EmployeeQueryService::resolveSubordinateIds($user->id);
        if (! empty($allSubordinateIds)) {
            $query->whereIn('id', $allSubordinateIds);

            return;
        }

        // Jika bukan Super Admin dan tidak memiliki bawahan, jangan tampilkan karyawan lain
        $query->whereRaw('1 = 0');
    }

    private function scopeGlobalAdminQuery($query, User $user, ?string $companyId): void
    {
        $query->where('id', '!=', $user->id);
        if ($companyId && $companyId !== 'all') {
            $query->where(function ($q) use ($companyId) {
                $q->where('company_id', $companyId)
                    ->orWhereNull('company_id');
            });
        } elseif ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where(function ($q) use ($user) {
                $q->where('company_id', $user->company_id)
                    ->orWhereNull('company_id');
            });
        }
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
            $locationLabel = match ($attendance->attendance_type) {
                'dinas_luar' => 'Dinas Luar',
                'wfh' => 'WFA',
                default => 'Di Kantor',
            };
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
            'attendance_id' => $attendance?->id,
            'name' => $sub->name,
            'role' => $sub->role?->name ?? 'Karyawan',
            'photo_url' => $sub->profile_photo_url,
            'status' => $status,
            'location_label' => $locationLabel,
            'check_in' => $checkInFormatted,
            'check_out' => $checkOutFormatted,
            'check_in_full' => $attendance?->check_in,
            'check_out_full' => $attendance?->check_out,
            'attendance_type' => $attendance?->attendance_type ?? 'office',
            'is_dinas_luar' => $attendance?->attendance_type === 'dinas_luar',
            'is_wfa' => $attendance?->attendance_type === 'wfh',
            'dinas_luar_destination' => $attendance?->dinas_luar_destination,
            'dinas_luar_notes' => $attendance?->dinas_luar_notes,
            'dinas_luar_status' => $attendance?->dinas_luar_status,
            'image_in' => $attendance?->image_in,
            'image_out' => $attendance?->image_out,
            'image_in_url' => $attendance?->image_in_url,
            'image_out_url' => $attendance?->image_out_url,
            'latitude_in' => $attendance?->latitude_in,
            'longitude_in' => $attendance?->longitude_in,
            'latitude_out' => $attendance?->latitude_out,
            'longitude_out' => $attendance?->longitude_out,
            'work_pattern' => $normalizedPattern,
            'user_attendance_type' => $sub->attendance_type,
        ];
    }
}
