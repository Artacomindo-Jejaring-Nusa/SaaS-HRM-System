<?php

namespace App\Traits;

use App\Models\Overtime;
use App\Models\OvertimeItem;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

trait HandlesOvertimeAssignment
{
    private function canAssignOvertime(User $user): bool
    {
        return $user->isSuperAdmin()
            || $user->role_id === 1
            || $user->hasPermission('assign-overtimes')
            || $user->hasPermission('manage-overtimes');
    }

    private function validateStoreRequest(Request $request): void
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'user_id' => 'nullable',
            'division_id' => 'nullable|exists:roles,id',
            'date' => 'required|date',
            'start_time' => 'required|string',
            'end_time' => 'required|string',
            'reason' => 'required|string',
            'items' => 'nullable|array',
        ]);
    }

    private function resolveTargetUserIds(Request $request, User $user): array
    {
        if ($request->filled('division_id')) {
            $divQuery = User::where('role_id', $request->division_id);
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $divQuery->where('company_id', $user->company_id);
            }

            return $divQuery->pluck('id')->toArray();
        }

        if ($request->filled('user_id')) {
            $userIds = is_array($request->user_id) ? $request->user_id : [$request->user_id];
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                return User::whereIn('id', $userIds)->where('company_id', $user->company_id)->pluck('id')->toArray();
            }

            return $userIds;
        }

        return [];
    }

    private function dispatchOvertimeAssignments(Request $request, User $user, array $targetUserIds): array
    {
        $createdOvertimes = [];
        $companyId = $user->company_id;

        DB::transaction(function () use ($request, $user, $companyId, $targetUserIds, &$createdOvertimes) {
            foreach ($targetUserIds as $targetId) {
                $createdOvertimes[] = $this->createSingleAssignedOvertime($request, $user, $targetId, $companyId);
            }
        });

        return $createdOvertimes;
    }

    private function createSingleAssignedOvertime(Request $request, User $user, int $targetId, $companyId): Overtime
    {
        $targetUser = User::find($targetId);
        $targetCompanyId = $targetUser ? $targetUser->company_id : $companyId;

        $ot = Overtime::create([
            'user_id' => $targetId,
            'company_id' => $targetCompanyId,
            'assigned_by' => $user->id,
            'division_id' => $request->division_id ?? null,
            'title' => $request->title,
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'reason' => $request->reason,
            'status' => 'pending',
        ]);

        $this->createOvertimeItemsFromRequest($ot, $request);

        if ($targetUser) {
            $this->notify(
                $targetUser,
                'PERINTAH KERJA LEMBUR 📋',
                "Anda ditugaskan lembur '{$request->title}' pada tanggal {$request->date} ({$request->start_time} - {$request->end_time}) oleh {$user->name}. Mohon konfirmasi kesediaan Anda.",
                'warning',
                self::ROUTE_OVERTIMES
            );
        }

        return $ot->load(['items', 'user.role', 'assigner.role']);
    }

    private function createOvertimeItemsFromRequest(Overtime $ot, Request $request): void
    {
        if ($request->has('items') && is_array($request->items)) {
            foreach ($request->items as $item) {
                OvertimeItem::create([
                    'overtime_id' => $ot->id,
                    'date' => $item['date'] ?? $request->date,
                    'start_time' => $item['start_time'] ?? $request->start_time,
                    'end_time' => $item['end_time'] ?? $request->end_time,
                    'reason' => $item['reason'] ?? $request->reason,
                ]);
            }

            return;
        }

        OvertimeItem::create([
            'overtime_id' => $ot->id,
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'reason' => $request->reason,
        ]);
    }
}
