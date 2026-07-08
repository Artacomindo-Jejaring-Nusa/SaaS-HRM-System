<?php

namespace App\Http\Controllers;

use App\Models\Leave;
use App\Models\User;
use App\Services\ApprovalService;
use App\Traits\Notifiable;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LeaveController extends Controller
{
    use Notifiable;

    private const TYPE_ANNUAL_LEAVE = 'Cuti Tahunan';

    public function index(Request $request): \Illuminate\Http\JsonResponse
    {
        $query = Leave::with(['user.supervisor', 'user.company', 'user.role', 'supervisorApprover', 'hrApprover']);

        $user = $request->user();

        if ($user->role_id === 1) {
            // Master Admin sees all
        } elseif ($user->is_manager || $user->hasPermission('approve-leaves')) {
            $query->where('company_id', $user->company_id);
        } else {
            $query->where('user_id', $user->id)
                ->where('company_id', $user->company_id);
        }

        $leaves = $query->orderBy('id', 'desc')->paginate(10);

        return response()->json([
            'status' => 'success',
            'message' => 'Data cuti berhasil diambil.',
            'data' => $leaves,
            'leave_balance' => $user->leave_balance,
        ]);
    }

    public function calendar(Request $request): \Illuminate\Http\JsonResponse
    {
        $query = Leave::with('user')->where('status', 'approved');

        if ($request->user()->company_id && ! $request->user()->canAccessAllCompanies()) {
            $query->where('company_id', $request->user()->company_id);
        }

        if ($request->month && $request->year) {
            $start = Carbon::create($request->year, $request->month, 1)->startOfMonth();
            $end = Carbon::create($request->year, $request->month, 1)->endOfMonth();

            $query->where(function ($q) use ($start, $end) {
                $q->whereBetween('start_date', [$start, $end])
                    ->orWhereBetween('end_date', [$start, $end]);
            });
        }

        $leaves = $query->get();

        return $this->successResponse($leaves, 'Data kalender cuti berhasil diambil.');
    }

    public function store(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'type' => 'required|string',
            'reason' => 'nullable|string',
            'leave_address' => 'nullable|string|max:500',
            'emergency_phone' => 'nullable|string|max:30',
            'signature' => 'required|string', // Base64 signature
        ]);

        if ($request->type === self::TYPE_ANNUAL_LEAVE) {
            $requestedDays = Carbon::parse($request->start_date)->diffInDays(Carbon::parse($request->end_date)) + 1;

            $pendingDays = Leave::where('user_id', $request->user()->id)
                ->where('type', self::TYPE_ANNUAL_LEAVE)
                ->whereIn('status', ['pending', 'pending_supervisor', 'pending_hr'])
                ->get()
                ->sum(function ($l) {
                    return Carbon::parse($l->start_date)->diffInDays(Carbon::parse($l->end_date)) + 1;
                });

            if ($request->user()->leave_balance < ($requestedDays + $pendingDays)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Sisa cuti tahunan Anda tidak mencukupi (termasuk cuti yang masih pending/menunggu).',
                ], 400);
            }
        }

        $user = $request->user();
        $companyId = $user->company_id;

        // ── Dynamic Workflow Check ──
        $workflowResult = ApprovalService::initApproval('leave', $companyId, $user);

        if ($workflowResult) {
            // Dynamic workflow is active
            $leave = Leave::create([
                'user_id' => $user->id,
                'company_id' => $companyId,
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'type' => $request->type,
                'reason' => $request->reason,
                'leave_address' => $request->leave_address,
                'emergency_phone' => $request->emergency_phone,
                'signature' => $request->signature,
                'status' => $workflowResult['status'],
                'current_approval_step' => $workflowResult['current_approval_step'],
            ]);

            // Notify the submitter
            $this->notify(
                $user,
                'PENGAJUAN CUTI BERHASIL',
                "Permohonan cuti ({$request->type}) Anda dari tanggal {$request->start_date} s/d {$request->end_date} telah diajukan. Menunggu: {$workflowResult['step_label']}.",
                'info'
            );

            // Notify dynamic approvers
            foreach ($workflowResult['approvers'] as $approver) {
                $this->notify(
                    $approver,
                    'PENGAJUAN CUTI PERLU PERSETUJUAN',
                    "{$user->name} telah mengajukan cuti ({$request->type}) pada {$request->start_date} s/d {$request->end_date}. Mohon segera tinjau.",
                    'warning',
                    self::ROUTE_APPROVALS
                );
            }
        } else {
            // ── Fallback: Default hardcoded logic ──
            $status = $user->supervisor_id ? 'pending_supervisor' : 'pending_hr';

            $leave = Leave::create([
                'user_id' => $user->id,
                'company_id' => $companyId,
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'type' => $request->type,
                'reason' => $request->reason,
                'leave_address' => $request->leave_address,
                'emergency_phone' => $request->emergency_phone,
                'signature' => $request->signature,
                'status' => $status,
            ]);

            $this->notify(
                $user,
                'PENGAJUAN CUTI BERHASIL',
                "Permohonan cuti ({$request->type}) Anda dari tanggal {$request->start_date} s/d {$request->end_date} telah diajukan dan sedang menunggu persetujuan.",
                'info'
            );

            // 1. Notify the User's Immediate Supervisor
            if ($user->supervisor_id) {
                $supervisor = $user->supervisor;
                if ($supervisor) {
                    $this->notify(
                        $supervisor,
                        'PENGAJUAN CUTI BAWAHAN',
                        "{$user->name} telah mengajukan cuti ({$request->type}) pada {$request->start_date}. Mohon segera tinjau.",
                        'warning',
                        self::ROUTE_APPROVALS
                    );
                }
            }

            // 2. Notify HRD/Admin ONLY if user has no supervisor
            // If supervisor exists, HRD will be notified after supervisor approves
            if (! $user->supervisor_id) {
                $hrds = User::where('company_id', $companyId)
                    ->where('id', '!=', $user->id)
                    ->whereHas('role', function ($q) {
                        $q->where('name', 'HRD')->orWhere('name', 'Admin');
                    })
                    ->get();

                foreach ($hrds as $hrd) {
                    $this->notify(
                        $hrd,
                        'PENGAJUAN CUTI BARU (HRD)',
                        "{$user->name} telah mengajukan cuti ({$request->type}) pada {$request->start_date}. Karyawan tidak memiliki Supervisor, mohon segera tinjau.",
                        'warning',
                        self::ROUTE_APPROVALS
                    );
                }
            }
        }

        return $this->successResponse($leave, 'Permohonan cuti berhasil diajukan.', 201);
    }

    public function approve(Request $request, $id): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        $leave = Leave::where(function ($q) use ($user) {
            if ($user->role_id !== 1) {
                $q->where('company_id', $user->company_id);
            }
        })->findOrFail($id);

        if ($leave->current_approval_step !== null) {
            return $this->approveDynamicWorkflow($request, $leave, $user);
        }

        return $this->approveFallbackWorkflow($request, $leave, $user);
    }

    private function approveDynamicWorkflow(Request $request, Leave $leave, $user): \Illuminate\Http\JsonResponse
    {
        $result = ApprovalService::processApproval(
            'leave', $leave->company_id, $user, $leave->user, $leave->current_approval_step, 'approve'
        );

        if ($result === null) {
            return $this->errorResponse('Workflow tidak ditemukan.', 400);
        }

        if (isset($result['error'])) {
            return $this->errorResponse($result['error'], 403);
        }

        $updateData = [
            'status' => $result['status'],
            'current_approval_step' => $result['current_approval_step'],
        ];

        if ($result['is_final'] && $result['status'] === 'approved') {
            $updateData['approved_by'] = $user->id;
            $updateData['remark'] = $request->remark;
        }

        $leave->update($updateData);

        if ($result['is_final'] && $result['status'] === 'approved') {
            if ($leave->type === self::TYPE_ANNUAL_LEAVE) {
                $days = Carbon::parse($leave->start_date)->diffInDays(Carbon::parse($leave->end_date)) + 1;
                $leaveUser = $leave->user;
                $leaveUser->leave_balance -= $days;
                $leaveUser->save();
            }

            $this->notify(
                $leave->user,
                'CUTI DISETUJUI',
                "Permohonan cuti Anda untuk tanggal {$leave->start_date} s/d {$leave->end_date} telah DISETUJUI.",
                'success'
            );

            $msg = 'Permohonan cuti disetujui.';
        } else {
            if (isset($result['approvers'])) {
                foreach ($result['approvers'] as $nextApprover) {
                    $this->notify(
                        $nextApprover,
                        'CUTI MENUNGGU PERSETUJUAN ANDA',
                        "Pengajuan cuti {$leave->user->name} ({$leave->type}) menunggu persetujuan Anda. Tahap: {$result['step_label']}.",
                        'warning',
                        self::ROUTE_APPROVALS
                    );
                }
            }

            $this->notify(
                $leave->user,
                'CUTI DALAM PROSES',
                "Pengajuan cuti Anda telah disetujui di tahap sebelumnya. Menunggu: {$result['step_label']}.",
                'info'
            );

            $msg = "Di-approve. Menunggu: {$result['step_label']}.";
        }

        return $this->successResponse(null, $msg);
    }

    private function approveFallbackWorkflow(Request $request, Leave $leave, $user): \Illuminate\Http\JsonResponse
    {
        $isSupervisor = $leave->user->supervisor_id === $user->id;
        $isHR         = $user->hasPermission('approve-leaves') || $user->role_id === 1;

        if ($leave->status === 'pending_supervisor') {
            return $this->handlePendingSupervisorApproval($request, $leave, $user, $isSupervisor, $isHR);
        }

        if (in_array($leave->status, ['pending_hr', 'pending'])) {
            return $this->handlePendingHrApproval($request, $leave, $user, $isHR);
        }

        return response()->json(['status' => 'error', 'message' => 'Status tidak valid.'], 400);
    }

    /**
     * Handle approval when leave is in pending_supervisor state.
     */
    private function handlePendingSupervisorApproval(Request $request, Leave $leave, $user, bool $isSupervisor, bool $isHR): \Illuminate\Http\JsonResponse
    {
        if (! $isSupervisor && ! $isHR) {
            return response()->json(['status' => 'error', 'message' => 'Anda tidak berhak.'], 403);
        }

        if ($isSupervisor) {
            $leave->update([
                'status'                => 'pending_hr',
                'supervisor_approved_by'=> $user->id,
                'supervisor_approved_at'=> now(),
                'supervisor_remark'     => $request->remark,
            ]);

            $this->notify($leave->user, 'CUTI DI-APPROVE ATASAN', "Cuti Anda ({$leave->type}) telah disetujui oleh atasan. Menunggu persetujuan HRD.", 'info');
            $this->notifyHrdsAfterSupervisorApprove($leave);

            return $this->successResponse(null, 'Di-approve oleh atasan. Menunggu proses HRD.');
        }

        // HR overrides directly to approved
        $leave->update([
            'status'                => 'approved',
            'approved_by'           => $user->id,
            'remark'                => $request->remark,
            'supervisor_approved_by'=> $user->id,
            'supervisor_approved_at'=> now(),
        ]);

        return $this->finalizeLeaveApproval($leave);
    }

    /**
     * Handle approval when leave is in pending_hr or pending state.
     */
    private function handlePendingHrApproval(Request $request, Leave $leave, $user, bool $isHR): \Illuminate\Http\JsonResponse
    {
        if (! $isHR) {
            return response()->json(['status' => 'error', 'message' => 'Hanya HRD.'], 403);
        }

        $leave->update([
            'status'     => 'approved',
            'approved_by'=> $user->id,
            'remark'     => $request->remark,
        ]);

        return $this->finalizeLeaveApproval($leave);
    }

    /**
     * Deduct annual leave balance and notify submitter after full approval.
     */
    private function finalizeLeaveApproval(Leave $leave): \Illuminate\Http\JsonResponse
    {
        if ($leave->type === self::TYPE_ANNUAL_LEAVE) {
            $days      = Carbon::parse($leave->start_date)->diffInDays(Carbon::parse($leave->end_date)) + 1;
            $leaveUser = $leave->user;
            $leaveUser->leave_balance -= $days;
            $leaveUser->save();
        }

        $this->notify(
            $leave->user,
            'CUTI DISETUJUI',
            "Permohonan cuti Anda untuk tanggal {$leave->start_date} s/d {$leave->end_date} telah DISETUJUI oleh Admin.",
            'success'
        );

        return $this->successResponse(null, 'Permohonan cuti disetujui.');
    }

    /**
     * Notify all HRD/Admin users that a leave is now pending their review.
     */
    private function notifyHrdsAfterSupervisorApprove(Leave $leave): void
    {
        $hrds = User::where('company_id', $leave->company_id)
            ->whereHas('role', fn ($q) => $q->where('name', 'HRD')->orWhere('name', 'Admin'))
            ->get();

        foreach ($hrds as $hrd) {
            $this->notify(
                $hrd,
                'CUTI MENUNGGU PERSETUJUAN HRD',
                "Cuti {$leave->user->name} ({$leave->type}) telah disetujui Supervisor. Mohon segera proses.",
                'warning',
                self::ROUTE_APPROVALS
            );
        }
    }

    public function reject(Request $request, $id): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        $leave = Leave::findOrFail($id);

        if ($leave->current_approval_step !== null) {
            return $this->rejectDynamicWorkflow($request, $leave, $user);
        }

        return $this->rejectFallbackWorkflow($request, $leave, $user);
    }

    private function rejectDynamicWorkflow(Request $request, Leave $leave, $user): \Illuminate\Http\JsonResponse
    {
        $result = ApprovalService::processApproval(
            'leave', $leave->company_id, $user, $leave->user, $leave->current_approval_step, 'reject'
        );

        if ($result === null) {
            return $this->errorResponse('Workflow tidak ditemukan.', 400);
        }

        if (isset($result['error'])) {
            return $this->errorResponse($result['error'], 403);
        }

        $leave->update([
            'status' => 'rejected',
            'current_approval_step' => null,
            'approved_by' => $user->id,
            'remark' => $request->remark,
        ]);

        $this->notify(
            $leave->user,
            'CUTI DITOLAK',
            "Mohon maaf, permohonan cuti Anda untuk tanggal {$leave->start_date} s/d {$leave->end_date} telah DITOLAK.",
            'danger'
        );

        return $this->successResponse(null, 'Permohonan cuti ditolak.');
    }

    private function rejectFallbackWorkflow(Request $request, Leave $leave, $user): \Illuminate\Http\JsonResponse
    {
        $isSupervisor = $leave->user->supervisor_id === $user->id;
        $isHR = $user->hasPermission('approve-leaves') || $user->role_id === 1;

        if (! $isSupervisor && ! $isHR) {
            abort(403, 'Akses ditolak.');
        }

        if ($leave->status === 'pending_supervisor' && $isSupervisor) {
            $leave->update([
                'status' => 'rejected',
                'supervisor_approved_by' => $user->id,
                'supervisor_approved_at' => now(),
                'supervisor_remark' => $request->remark,
            ]);
        } else {
            $leave->update([
                'status' => 'rejected',
                'approved_by' => $user->id,
                'remark' => $request->remark,
            ]);
        }

        $this->notify(
            $leave->user,
            'CUTI DITOLAK',
            "Mohon maaf, permohonan cuti Anda untuk tanggal {$leave->start_date} s/d {$leave->end_date} telah DITOLAK.",
            'danger'
        );

        return $this->successResponse(null, 'Permohonan cuti ditolak.');
    }

    public function destroy(Request $request, $id): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        $leave = Leave::where(function ($q) use ($user) {
            if ($user->role_id !== 1) {
                $q->where('company_id', $user->company_id);
            }
        })->findOrFail($id);

        if (! in_array($leave->status, ['pending', 'pending_supervisor', 'pending_hr']) && $user->role_id !== 1) {
            return $this->errorResponse('Cuti yang sudah diproses tidak bisa dihapus.', 403);
        }

        $leave->delete();

        return $this->successResponse(null, 'Cuti berhasil dihapus.');
    }
}
