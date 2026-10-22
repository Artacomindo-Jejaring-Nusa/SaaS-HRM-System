<?php

namespace App\Traits;

use App\Models\Overtime;
use App\Models\OvertimeItem;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

trait HandlesOvertimeAssignment
{
    private const ROUTE_OVERTIMES = '/dashboard/overtimes';

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
        $targetUserIds = [];

        if ($request->filled('division_id')) {
            $divQuery = User::where('role_id', $request->division_id);
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $divQuery->where('company_id', $user->company_id);
            }

            $targetUserIds = $divQuery->pluck('id')->toArray();
        } elseif ($request->filled('user_id')) {
            $userIds = is_array($request->user_id) ? $request->user_id : [$request->user_id];
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $targetUserIds = User::whereIn('id', $userIds)->where('company_id', $user->company_id)->pluck('id')->toArray();
            } else {
                $targetUserIds = $userIds;
            }
        }

        return $targetUserIds;
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

    private function handleOvertimeAssignmentStore(Request $request, User $user)
    {
        if (! $this->canAssignOvertime($user)) {
            return $this->errorResponse('Akses ditolak. Anda tidak memiliki izin untuk memberikan penugasan lembur (assign-overtimes).', 403);
        }

        $this->normalizeOvertimeItems($request);
        $this->validateStoreRequest($request);

        $targetUserIds = $this->resolveTargetUserIds($request, $user);
        if (empty($targetUserIds)) {
            return $this->errorResponse('Pilih minimal satu karyawan atau divisi penerima perintah lembur.', 422);
        }

        $createdOvertimes = $this->dispatchOvertimeAssignments($request, $user, $targetUserIds);

        $this->logActivity('ASSIGN_OVERTIME', "Memberikan perintah lembur '{$request->title}' kepada ".count($createdOvertimes).' karyawan', $createdOvertimes[0] ?? null);

        return $this->successResponse([
            'overtimes' => $createdOvertimes,
            'total_assigned' => count($createdOvertimes),
        ], 'Perintah lembur berhasil diberikan kepada '.count($createdOvertimes).' karyawan.', 201);
    }

    private function processOvertimeResponse(Overtime $overtime, User $user, Request $request): string
    {
        $isAccept = $request->action === 'accept';

        $overtime->update([
            'status' => $isAccept ? 'approved' : 'rejected',
            'responded_at' => now(),
            'rejection_reason' => $isAccept ? null : $request->reason,
        ]);

        if ($overtime->assigner) {
            $this->notify(
                $overtime->assigner,
                $isAccept ? 'PERINTAH LEMBUR DISETUJUI ✅' : 'PERINTAH LEMBUR DITOLAK ⚠️',
                $isAccept
                    ? "Karyawan {$user->name} telah menyetujui perintah lembur: '{$overtime->title}'."
                    : "Karyawan {$user->name} menolak perintah lembur: '{$overtime->title}'. Alasan: {$request->reason}",
                $isAccept ? 'success' : 'danger',
                self::ROUTE_OVERTIMES
            );
        }

        $action = $isAccept ? 'ACCEPT_OVERTIME' : 'REJECT_OVERTIME';
        $desc = $isAccept
            ? "Menerima perintah lembur #{$overtime->id} ('{$overtime->title}')"
            : "Menolak perintah lembur #{$overtime->id} ('{$overtime->title}'). Alasan: {$request->reason}";

        $this->logActivity($action, $desc, $overtime);

        return $isAccept ? 'Perintah lembur berhasil Anda setujui.' : 'Perintah lembur telah ditolak dengan komentar.';
    }
}
