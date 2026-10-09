<?php

namespace App\Services;

use App\Models\AttendanceCorrection;
use App\Models\FundRequest;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\Permit;
use App\Models\Reimbursement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DataPurgeService
{
    public static function purgeCurrentMonth(Request $request, User $user, callable $logActivityCallback)
    {
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');

        if (!$isSuperAdmin) {
            return response()->json([
                'status' => 'error',
                'message' => 'Hanya Super Admin yang berhak melakukan pembersihan data periode.',
            ], 403);
        }

        $period = $request->input('period', Carbon::now()->format('Y-m'));
        $start = Carbon::parse($period . '-01')->startOfMonth();
        $end = Carbon::parse($period . '-01')->endOfMonth();

        $companyScope = function ($q) use ($user) {
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $q->where('company_id', $user->company_id);
            }
        };

        $reimResult = self::purgeReimbursements($companyScope, $start, $end);
        $fundResult = self::purgeFundRequests($companyScope, $start, $end);
        $otCount = self::purgeOvertimes($companyScope, $start, $end);

        $leaveQuery = Leave::whereBetween('created_at', [$start, $end]);
        $companyScope($leaveQuery);
        $leavesDeleted = $leaveQuery->delete();

        $permitQuery = Permit::whereBetween('created_at', [$start, $end]);
        $companyScope($permitQuery);
        $permitsDeleted = $permitQuery->delete();

        $acQuery = AttendanceCorrection::whereBetween('created_at', [$start, $end]);
        $companyScope($acQuery);
        $correctionsDeleted = $acQuery->delete();

        $deletedCounts = [
            'reimbursements' => $reimResult['count'],
            'fund_requests' => $fundResult['count'],
            'leaves' => $leavesDeleted,
            'permits' => $permitsDeleted,
            'overtimes' => $otCount,
            'attendance_corrections' => $correctionsDeleted,
            'files' => $reimResult['files'] + $fundResult['files'],
        ];

        $totalRecords = $deletedCounts['reimbursements'] +
            $deletedCounts['fund_requests'] +
            $deletedCounts['leaves'] +
            $deletedCounts['permits'] +
            $deletedCounts['overtimes'] +
            $deletedCounts['attendance_corrections'];

        // Audit log via callback
        $logActivityCallback(
            'PURGE_MONTHLY_DATA',
            "Pembersihan data periode {$period}: {$totalRecords} transaksi dan {$deletedCounts['files']} berkas server dihapus",
            null,
            'maintenance',
            null,
            $deletedCounts
        );

        return response()->json([
            'status' => 'success',
            'message' => "Pembersihan periode {$period} berhasil. {$totalRecords} transaksi dan {$deletedCounts['files']} berkas server berhasil dihapus.",
            'data' => $deletedCounts,
        ]);
    }

    private static function deleteStorageFiles(mixed $attachments): int
    {
        if (empty($attachments)) {
            return 0;
        }
        $files = is_array($attachments) ? $attachments : [$attachments];
        $count = 0;
        foreach ($files as $file) {
            if ($file && Storage::disk('public')->exists($file)) {
                Storage::disk('public')->delete($file);
                $count++;
            }
        }
        return $count;
    }

    private static function purgeReimbursements(\Closure $companyScope, $start, $end): array
    {
        $reimQuery = Reimbursement::whereBetween('created_at', [$start, $end]);
        $companyScope($reimQuery);
        $reimbursements = $reimQuery->get();
        $filesCount = 0;

        foreach ($reimbursements as $reim) {
            $filesCount += self::deleteStorageFiles($reim->attachment);
            $reim->delete();
        }

        return ['count' => $reimbursements->count(), 'files' => $filesCount];
    }

    private static function purgeFundRequests(\Closure $companyScope, $start, $end): array
    {
        $fundQuery = FundRequest::whereBetween('created_at', [$start, $end]);
        $companyScope($fundQuery);
        $fundRequests = $fundQuery->get();
        $filesCount = 0;

        foreach ($fundRequests as $fund) {
            $filesCount += self::deleteStorageFiles($fund->attachment);
            $fund->delete();
        }

        return ['count' => $fundRequests->count(), 'files' => $filesCount];
    }

    private static function purgeOvertimes(\Closure $companyScope, $start, $end): int
    {
        $otQuery = Overtime::with('items')->whereBetween('created_at', [$start, $end]);
        $companyScope($otQuery);
        $overtimes = $otQuery->get();

        foreach ($overtimes as $ot) {
            $ot->items()->delete();
            $ot->delete();
        }

        return $overtimes->count();
    }
}
