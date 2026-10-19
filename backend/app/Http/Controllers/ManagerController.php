<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\DataPurgeService;
use App\Services\ManagerApprovalService;
use App\Services\ManagerAttendanceService;
use App\Services\PendingRequestService;
use App\Services\RequestHistoryService;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ManagerController extends Controller
{
    use Notifiable;

    private const PERM_MAP = ManagerApprovalService::PERM_MAP;

    /**
     * Get summary count for pending requests
     */
    public function getPendingCount(Request $request)
    {
        return response()->json([
            'status' => 'success',
            'data' => PendingRequestService::getPendingCount(Auth::user(), self::PERM_MAP, $request),
        ]);
    }

    /**
     * Get list of pending requests by type
     */
    public function getPendingRequests(Request $request)
    {
        $items = PendingRequestService::getPendingRequests($request, Auth::user(), self::PERM_MAP);
        if ($items === null) {
            return response()->json(['status' => 'error', 'message' => 'Invalid request type'], 400);
        }

        return response()->json([
            'status' => 'success',
            'data' => $items,
        ]);
    }

    /**
     * Approve or Reject a request
     */
    public function updateRequestStatus(Request $request, ManagerApprovalService $approvalService)
    {
        return $approvalService->updateRequestStatus($request, Auth::user());
    }

    /**
     * Get team attendance status for today or specified date
     */
    public function getTeamAttendance(Request $request, ManagerAttendanceService $attendanceService)
    {
        /** @var User $user */
        $user = Auth::user();
        $isCompanyAdmin = ManagerAttendanceService::isCompanyWideViewer($user);

        return response()->json([
            'status' => 'success',
            'data' => $attendanceService->getTeamAttendance(
                $user,
                $isCompanyAdmin,
                $request->query('date'),
                $request->query('company_id')
            ),
        ]);
    }

    /**
     * Get processed requests and audit history
     */
    public function getHistoryRequests(Request $request)
    {
        $sorted = RequestHistoryService::getHistoryRequests($request, Auth::user());

        return response()->json([
            'status' => 'success',
            'data' => $sorted,
        ]);
    }

    /**
     * Purge requests and files for the specified/current month (Super Admin only)
     */
    public function purgeCurrentMonth(Request $request)
    {
        return DataPurgeService::purgeCurrentMonth(
            $request,
            Auth::user(),
            fn (...$args) => $this->logActivity(...$args)
        );
    }
}
