<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Resources\Mobile\AnnouncementResource;
use App\Models\Announcement;
use App\Models\Attendance;
use App\Models\Leave;
use App\Models\Reimbursement;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class MobileDashboardController extends Controller
{
    /**
     * Get a lightweight dashboard summary for mobile app.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $today = Carbon::today()->toDateString();
        $companyId = $user->company_id;
        $isStaff = in_array($user->role?->name, ['Staff Karyawan', 'Karyawan', 'Staff']);

        // 1. Personal / Global Summary
        if ($isStaff) {
            $totalPresentMonth = Attendance::where('user_id', $user->id)
                ->where('status', 'present')
                ->whereMonth('check_in', Carbon::now()->month)
                ->count();

            $summary = [
                'present_this_month' => $totalPresentMonth,
                'leaves_this_month' => Leave::where('user_id', $user->id)
                    ->where('status', 'approved')
                    ->whereMonth('start_date', Carbon::now()->month)
                    ->count(),
                'late_this_month' => Attendance::where('user_id', $user->id)
                    ->whereMonth('check_in', Carbon::now()->month)
                    ->where('status', 'late')
                    ->count(),
            ];
        } else {
            $totalEmployees = User::where('company_id', $companyId)->count();
            $presentToday = Attendance::where('company_id', $companyId)->whereDate('check_in', $today)->count();
            $onLeaveToday = Leave::where('company_id', $companyId)->where('status', 'approved')->whereDate('start_date', '<=', $today)->whereDate('end_date', '>=', $today)->count();

            $summary = [
                'total_employees' => $totalEmployees,
                'present_today' => $presentToday,
                'on_leave_today' => $onLeaveToday,
                'absent_today' => max($totalEmployees - $presentToday - $onLeaveToday, 0),
            ];
        }

        // 2. Today's Status (Lightweight)
        $todayAttendance = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', $today)
            ->first();

        $status = [
            'is_checked_in' => $todayAttendance ? true : false,
            'is_checked_out' => ($todayAttendance && $todayAttendance->check_out) ? true : false,
            'check_in_time' => $todayAttendance ? Carbon::parse($todayAttendance->check_in)->format('H:i') : null,
            'check_out_time' => ($todayAttendance && $todayAttendance->check_out) ? Carbon::parse($todayAttendance->check_out)->format('H:i') : null,
            'attendance_status' => $todayAttendance ? $todayAttendance->status : 'absent',
        ];

        // 3. Pending Count (for Badges)
        $pendingCounts = [
            'tasks' => Task::where('user_id', $user->id)->where('status', 'pending')->count(),
            'leaves' => $isStaff ? 0 : Leave::where('company_id', $companyId)->where('status', 'pending')->count(),
            'reimbursements' => $isStaff ? 0 : Reimbursement::where('company_id', $companyId)->where('status', 'pending')->count(),
        ];

        // 4. Announcements (Top 3 only)
        $announcements = Announcement::where('company_id', $companyId)
            ->latest()
            ->limit(3)
            ->get();

        // 5. Upcoming Birthdays (Current Month)
        $todayObj = Carbon::today();
        $upcomingBirthdays = User::where('company_id', $companyId)
            ->whereNotNull('date_of_birth')
            ->whereMonth('date_of_birth', $todayObj->month)
            ->with('role')
            ->get()
            ->map(function ($emp) use ($todayObj) {
                $dob = Carbon::parse($emp->date_of_birth);
                $birthdayThisYear = Carbon::createFromDate($todayObj->year, $dob->month, $dob->day)->startOfDay();
                return [
                    'id' => $emp->id,
                    'name' => $emp->name,
                    'role' => $emp->role->name ?? 'Karyawan',
                    'formatted_birthday' => $dob->translatedFormat('d F'),
                    'birth_day' => $dob->day,
                    'is_today' => $todayObj->isSameDay($birthdayThisYear),
                    'phone_number' => $emp->phone_number,
                ];
            })
            ->sortBy('birth_day')
            ->values()
            ->take(5);

        return $this->successResponse([
            'user' => [
                'name' => $user->name,
                'role' => $user->role->name ?? 'User',
                'photo' => $user->profile_photo_url,
                'wfh_active' => (bool) $user->is_wfh,
            ],
            'summary' => $summary,
            'today_status' => $status,
            'pending_counts' => $pendingCounts,
            'announcements' => AnnouncementResource::collection($announcements),
            'upcoming_birthdays' => $upcomingBirthdays,
        ], 'Mobile dashboard data fetched successfully.');
    }
}
