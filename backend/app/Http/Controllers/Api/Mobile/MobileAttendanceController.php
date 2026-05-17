<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\AttendanceController;
use App\Http\Resources\Mobile\AttendanceResource;
use App\Models\Attendance;
use Carbon\Carbon;
use Illuminate\Http\Request;

class MobileAttendanceController extends AttendanceController
{
    /**
     * Get attendance history for mobile using lightweight resource.
     */
    public function history(Request $request)
    {
        $user = $request->user();
        $query = Attendance::where('user_id', $user->id);

        if ($request->start_date && $request->end_date) {
            $query->whereDate('check_in', '>=', $request->start_date)
                ->whereDate('check_in', '<=', $request->end_date);
        }

        $history = $query->orderBy('check_in', 'desc')
            ->paginate($request->per_page ?? 15);

        return AttendanceResource::collection($history)->additional([
            'message' => 'Attendance history retrieved successfully.',
        ]);
    }

    /**
     * Get today's attendance status (lightweight).
     */
    public function today(Request $request)
    {
        $user = $request->user();
        $attendance = Attendance::where('user_id', $user->id)
            ->whereDate('check_in', Carbon::today())
            ->first();

        if (! $attendance) {
            return $this->successResponse([
                'isLoggedIn' => false,
                'checkIn' => null,
                'checkOut' => null,
                'status' => 'absent',
            ], 'No attendance record for today.');
        }

        return $this->successResponse([
            'isLoggedIn' => true,
            'checkIn' => $attendance->check_in ? Carbon::parse($attendance->check_in)->format('H:i') : null,
            'checkOut' => $attendance->check_out ? Carbon::parse($attendance->check_out)->format('H:i') : null,
            'status' => $attendance->status,
            'isSuspicious' => (bool) $attendance->is_suspicious,
        ], 'Today\'s status retrieved.');
    }

    // Note: checkIn and checkOut can be inherited from AttendanceController
    // but the responses might still be heavy if defined there.
    // Let's override them to return just what mobile needs.

    public function checkIn(Request $request)
    {
        $response = parent::checkIn($request);

        // If successful, return a stripped down version
        if ($response->getStatusCode() === 200) {
            $data = $response->getData()->data;

            return $this->successResponse([
                'id' => $data->id,
                'time' => Carbon::parse($data->check_in)->format('H:i'),
                'status' => $data->status,
            ], 'Check-in berasil.');
        }

        return $response;
    }

    public function checkOut(Request $request)
    {
        $response = parent::checkOut($request);

        if ($response->getStatusCode() === 200) {
            $data = $response->getData()->data;

            return $this->successResponse([
                'id' => $data->id,
                'time' => Carbon::parse($data->check_out)->format('H:i'),
                'status' => $data->status,
            ], 'Check-out berhasil.');
        }

        return $response;
    }
}
