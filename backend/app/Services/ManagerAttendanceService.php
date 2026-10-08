<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;

class ManagerAttendanceService
{
    public function getTeamAttendance(User $user, bool $isCompanyAdmin): array
    {
        $today = Carbon::today()->toDateString();
        $isGlobalAdmin = $user->role_id === 1;
        $directSubordinateIds = User::where('supervisor_id', $user->id)->pluck('id');

        $query = User::with(['role', 'attendances' => function ($q) use ($today) {
            $q->whereDate('check_in', $today);
        }]);

        if ($directSubordinateIds->isNotEmpty()) {
            $query->whereIn('id', $directSubordinateIds);
        } elseif ($isGlobalAdmin) {
            $query->where('id', '!=', $user->id)->take(50);
        } elseif ($isCompanyAdmin) {
            $query->where('company_id', $user->company_id)->where('id', '!=', $user->id)->take(50);
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
        ];
    }
}
