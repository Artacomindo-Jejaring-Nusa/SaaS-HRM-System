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
                    '/dashboard/approvals'
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
                        '/dashboard/approvals'
                    );
                }
            }

            // 2. Notify Admins and HR (Fallback or Additional)
            $admins = User::where('company_id', $companyId)
                ->where('role_id', '>', 1)
                ->where('id', '!=', $user->supervisor_id)
                ->get();

            foreach ($admins as $admin) {
                $this->notify(
                    $admin,
                    'PENGAJUAN CUTI BARU (ADMIN)',
                    "{$user->name} telah mengajukan cuti ({$request->type}) pada {$request->start_date}.",
                    'warning'
                );
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
                        '/dashboard/approvals'
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
        $isHR = $user->hasPermission('approve-leaves') || $user->role_id === 1;

        $errorResponse = null;
        $successMsg = null;

        if ($leave->status === 'pending_supervisor') {
            if (! $isSupervisor && ! $isHR) {
                $errorResponse = response()->json(['status' => 'error', 'message' => 'Anda tidak berhak.'], 403);
            } elseif ($isSupervisor) {
                $leave->update([
                    'status' => 'pending_hr',
                    'supervisor_approved_by' => $user->id,
                    'supervisor_approved_at' => now(),
                    'supervisor_remark' => $request->remark,
                ]);
                $this->notify($leave->user, 'CUTI DI-APPROVE ATASAN', 'Menunggu HRD.', 'info');
                $successMsg = 'Di-approve oleh atasan. Menunggu proses HRD.';
            } else {
                $leave->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'remark' => $request->remark,
                    'supervisor_approved_by' => $user->id,
                    'supervisor_approved_at' => now(),
                ]);
            }
        } elseif (in_array($leave->status, ['pending_hr', 'pending'])) {
            if (! $isHR) {
                $errorResponse = response()->json(['status' => 'error', 'message' => 'Hanya HRD.'], 403);
            } else {
                $leave->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'remark' => $request->remark,
                ]);
            }
        } else {
            $errorResponse = response()->json(['status' => 'error', 'message' => 'Status tidak valid.'], 400);
        }

        if ($errorResponse) {
            return $errorResponse;
        }

        if ($successMsg) {
            return $this->successResponse(null, $successMsg);
        }

        if ($leave->type === 'Cuti Tahunan') {
            $days = Carbon::parse($leave->start_date)->diffInDays(Carbon::parse($leave->end_date)) + 1;
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
