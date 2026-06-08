<?php

namespace App\Http\Controllers;

use App\Exports\OvertimeExport;
use App\Models\ActivityLog;
use App\Models\Overtime;
use App\Models\OvertimeItem;
use App\Models\User;
use App\Services\ApprovalService;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Facades\Excel;

class OvertimeController extends Controller
{
    use Notifiable;

    private const MSG_FORBIDDEN = 'Akses ditolak.';
    private const MODEL_OVERTIME = 'App\Models\Overtime';
    private const RULE_REQ_STRING = 'required|string';
    private const MSG_SUCCESS_SUBMIT = 'PENGAJUAN LEMBUR BERHASIL';
    private const PATH_APPROVALS = '/dashboard/approvals';

    public function index(Request $request)
    {
        $query = Overtime::with(['user', 'approver', 'items']);

        $user = $request->user();

        if ($user->is_manager) {
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $query->where('company_id', $user->company_id);
            }
        } else {
            $query->where('user_id', $user->id);
        }

        // Optionally filter by status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $overtimes = $query->orderBy('id', 'desc')->paginate(10);

        return $this->successResponse($overtimes, 'Data lembur berhasil diambil.');
    }

    /**
     * Show a single overtime detail.
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $overtime = Overtime::with(['user', 'user.role', 'user.office', 'user.company', 'approver', 'items'])->findOrFail($id);

        // Security: only owner or manager can view
        if (! $user->is_manager && $overtime->user_id !== $user->id) {
            return $this->errorResponse(self::MSG_FORBIDDEN, 403);
        }

        return $this->successResponse($overtime, 'Detail lembur.');
    }

    /**
     * Store overtime — supports both draft and direct submit.
     * If 'status' is 'draft', save without triggering approval.
     * If 'status' is 'pending' (or absent), trigger approval workflow.
     */
    public function store(Request $request)
    {
        $this->ensureItemsPresent($request);
        $isDraft = $request->input('status') === 'draft';
        $this->validateOvertimeStore($request, $isDraft);

        $user = $request->user();
        $companyId = $user->company_id;

        return DB::transaction(function () use ($request, $user, $companyId, $isDraft) {
            $overtime = $this->createOvertimeRecord($request, $user, $companyId, $isDraft);
            $this->createOvertimeItems($overtime, $request->items);
            $overtime->load('items');

            $this->logOvertimeActivity($overtime, $user, $companyId, $isDraft);

            if (!$isDraft) {
                $this->handleOvertimeSubmissionNotifications($overtime, $user, $companyId);
                return $this->successResponse($overtime, 'Permohonan lembur berhasil diajukan.', 201);
            }

            return $this->successResponse($overtime, 'Draf lembur berhasil disimpan.', 201);
        });
    }

    private function ensureItemsPresent(Request $request): void
    {
        if (!$request->has('items') && $request->filled('date')) {
            $request->merge([
                'items' => [
                    [
                        'date' => $request->date,
                        'start_time' => $request->start_time,
                        'end_time' => $request->end_time,
                        'reason' => $request->reason,
                    ]
                ]
            ]);
        }
    }

    private function validateOvertimeStore(Request $request, bool $isDraft): void
    {
        $rules = [
            'title' => 'nullable|string|max:255',
            'items' => $isDraft ? 'nullable|array' : 'required|array|min:1',
            'items.*.date' => 'required|date',
            'items.*.start_time' => self::RULE_REQ_STRING,
            'items.*.end_time' => self::RULE_REQ_STRING,
            'items.*.reason' => self::RULE_REQ_STRING,
        ];

        if (!$isDraft) {
            $rules['signature'] = 'nullable|string';
        }

        $request->validate($rules);
    }

    private function createOvertimeRecord(Request $request, User $user, $companyId, bool $isDraft): Overtime
    {
        $data = [
            'user_id' => $user->id,
            'company_id' => $companyId,
            'title' => $request->title,
        ];

        if ($isDraft) {
            $data['status'] = 'draft';
        } else {
            $data['signature'] = $request->signature;
            $workflowResult = ApprovalService::initApproval('overtime', $companyId, $user);
            if ($workflowResult) {
                $data['status'] = $workflowResult['status'];
                $data['current_approval_step'] = $workflowResult['current_approval_step'];
            } else {
                $data['status'] = 'pending';
            }
        }

        return Overtime::create($data);
    }

    private function createOvertimeItems(Overtime $overtime, $items): void
    {
        if (is_array($items)) {
            foreach ($items as $item) {
                OvertimeItem::create([
                    'overtime_id' => $overtime->id,
                    'date' => $item['date'],
                    'start_time' => $item['start_time'],
                    'end_time' => $item['end_time'],
                    'reason' => $item['reason'],
                ]);
            }
        }
    }

    private function logOvertimeActivity(Overtime $overtime, User $user, string $action, ?string $description = null): void
    {
        ActivityLog::create([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'action' => $action,
            'description' => $description ?? (($action === 'OVERTIME_DRAFT' ? "Menyimpan draf lembur: " : "Mengajukan lembur: ") . ($overtime->title ?? '-')),
            'model_type' => self::MODEL_OVERTIME,
            'model_id' => $overtime->id,
        ]);
    }

    private function notifyOvertimeApprovers(Overtime $overtime, User $user, $companyId): void
    {
        $wf = ApprovalService::initApproval('overtime', $companyId, $user);

        if ($wf && isset($wf['approvers'])) {
            $this->notify($user, self::MSG_SUCCESS_SUBMIT, "Permohonan lembur Anda telah diajukan. Menunggu: {$wf['step_label']}.", 'info');
            foreach ($wf['approvers'] as $ap) {
                $this->notify($ap, 'PENGAJUAN LEMBUR PERLU PERSETUJUAN', "{$user->name} telah mengajukan lembur.", 'warning', self::PATH_APPROVALS);
            }
        } else {
            if ($user->supervisor_id && $user->supervisor) {
                $this->notify($user->supervisor, 'PENGAJUAN LEMBUR BAWAHAN', "{$user->name} telah mengajukan lembur.", 'warning', self::PATH_APPROVALS);
            }
            $admins = User::where('company_id', $companyId)->where('role_id', '>', 1)->where('id', '!=', $user->supervisor_id)->get();
            foreach ($admins as $ad) {
                $this->notify($ad, 'PENGAJUAN LEMBUR BARU (ADMIN)', "{$user->name} telah mengajukan lembur.", 'warning');
            }
            $this->notify($user, self::MSG_SUCCESS_SUBMIT, "Permohonan lembur Anda sedang menunggu persetujuan.", 'info');
        }
    }

    public function update(Request $request, $id)
    {
        $this->ensureItemsPresent($request);
        $user = $request->user();
        $overtime = Overtime::findOrFail($id);

        if ($overtime->user_id !== $user->id || $overtime->status !== 'draft') {
            return $this->errorResponse($overtime->user_id !== $user->id ? self::MSG_FORBIDDEN : 'Hanya draf yang bisa diubah.', 403);
        }

        $isSub = $request->input('status') === 'pending';
        $this->validateOvertimeStore($request, !$isSub);

        return DB::transaction(function () use ($request, $user, $overtime, $isSub) {
            $upd = ['title' => $request->title ?? $overtime->title];
            if ($isSub) {
                $upd['signature'] = $request->signature;
                $wf = ApprovalService::initApproval('overtime', $user->company_id, $user);
                $upd['status'] = $wf ? $wf['status'] : 'pending';
                $upd['current_approval_step'] = $wf['current_approval_step'] ?? null;
            }
            $overtime->update($upd);

            if ($request->has('items')) {
                $overtime->items()->delete();
                $this->createOvertimeItems($overtime, $request->items);
            }
            $overtime->load('items');

            $this->logOvertimeActivity($overtime, $user, $isSub ? 'OVERTIME_SUBMISSION' : 'OVERTIME_DRAFT_UPDATE');
            if ($isSub) {
                $this->notifyOvertimeApprovers($overtime, $user, $user->company_id);
                return $this->successResponse($overtime, 'Lembur berhasil diajukan.');
            }
            return $this->successResponse($overtime, 'Draf lembur berhasil diperbarui.');
        });
    }

    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $overtime = Overtime::findOrFail($id);
        return ($overtime->current_approval_step !== null) 
            ? $this->handleOvertimeWorkflowApproval($request, $overtime, $user) 
            : $this->handleOvertimeFallbackApproval($request, $overtime, $user);
    }

    private function handleOvertimeWorkflowApproval(Request $request, Overtime $overtime, $user): \Illuminate\Http\JsonResponse
    {
        $res = ApprovalService::processApproval('overtime', $overtime->company_id, $user, $overtime->user, $overtime->current_approval_step, 'approve');
        if (!$res) return $this->errorResponse('Workflow tidak ditemukan.', 400);
        if (isset($res['error'])) return $this->errorResponse($res['error'], 403);

        $upd = ['status' => $res['status'], 'current_approval_step' => $res['current_approval_step']];
        if ($res['is_final'] && $res['status'] === 'approved') {
            $upd['approved_by'] = $user->id;
            $upd['remark'] = $request->remark;
        }
        $overtime->update($upd);
        $this->logOvertimeActivity($overtime, $user, 'OVERTIME_APPROVAL', "Menyetujui lembur {$overtime->user->name}");

        if ($res['is_final'] && $res['status'] === 'approved') {
            $this->notify($overtime->user, 'LEMBUR DISETUJUI', "Permohonan lembur Anda telah DISETUJUI.", 'success');
            return $this->successResponse($overtime, 'Permohonan lembur disetujui.');
        }

        $this->notifyNextOvertimeApprovers($overtime, $res);
        return $this->successResponse($overtime, "Di-approve. Menunggu: {$res['step_label']}.");
    }

    private function handleOvertimeFallbackApproval(Request $request, Overtime $overtime, $user): \Illuminate\Http\JsonResponse
    {
        abort_if(!$user->hasPermission('approve-overtimes'), 403, self::MSG_FORBIDDEN);
        $overtime->update(['status' => 'approved', 'approved_by' => $user->id, 'remark' => $request->remark]);
        $this->logOvertimeActivity($overtime, $user, 'OVERTIME_APPROVAL', "Menyetujui lembur {$overtime->user->name}");
        $this->notify($overtime->user, 'LEMBUR DISETUJUI', "Permohonan lembur Anda telah DISETUJUI oleh Admin.", 'success');
        return $this->successResponse($overtime, 'Permohonan lembur disetujui.');
    }

    public function reject(Request $request, $id)
    {
        $user = $request->user();
        $overtime = Overtime::findOrFail($id);
        return ($overtime->current_approval_step !== null) 
            ? $this->handleOvertimeWorkflowRejection($request, $overtime, $user) 
            : $this->handleOvertimeFallbackRejection($request, $overtime, $user);
    }

    private function handleOvertimeWorkflowRejection(Request $request, Overtime $overtime, $user): \Illuminate\Http\JsonResponse
    {
        $res = ApprovalService::processApproval('overtime', $overtime->company_id, $user, $overtime->user, $overtime->current_approval_step, 'reject');
        if (!$res) return $this->errorResponse('Workflow tidak ditemukan.', 400);
        if (isset($res['error'])) return $this->errorResponse($res['error'], 403);

        $overtime->update(['status' => 'rejected', 'current_approval_step' => null, 'approved_by' => $user->id, 'remark' => $request->remark]);
        $this->logOvertimeActivity($overtime, $user, 'OVERTIME_REJECTION', "Menolak lembur {$overtime->user->name}");
        $this->notify($overtime->user, 'LEMBUR DITOLAK', "Mohon maaf, permohonan lembur Anda telah DITOLAK.", 'danger');
        return $this->successResponse($overtime, 'Permohonan lembur ditolak.');
    }

    private function handleOvertimeFallbackRejection(Request $request, Overtime $overtime, $user): \Illuminate\Http\JsonResponse
    {
        abort_if(!$user->hasPermission('approve-overtimes'), 403, self::MSG_FORBIDDEN);
        $overtime->update(['status' => 'rejected', 'approved_by' => $user->id, 'remark' => $request->remark]);
        $this->logOvertimeActivity($overtime, $user, 'OVERTIME_REJECTION', "Menolak lembur {$overtime->user->name}");
        $this->notify($overtime->user, 'LEMBUR DITOLAK', "Mohon maaf, permohonan lembur Anda telah DITOLAK.", 'danger');
        return $this->successResponse($overtime, 'Permohonan lembur ditolak.');
    }

    private function notifyNextOvertimeApprovers(Overtime $overtime, array $res): void
    {
        if (isset($res['approvers'])) {
            foreach ($res['approvers'] as $ap) {
                $this->notify($ap, 'LEMBUR MENUNGGU PERSETUJUAN', "Pengajuan lembur {$overtime->user->name} menunggu persetujuan Anda.", 'warning', self::PATH_APPROVALS);
            }
        }
        $this->notify($overtime->user, 'LEMBUR DALAM PROSES', "Pengajuan lembur Anda disetujui di tahap sebelumnya.", 'info');
    }


    public function destroy(Request $request, $id)
    {
        $overtime = Overtime::findOrFail($id);
        $user = $request->user();

        // Owner can delete their own draft/pending
        $isOwner = $overtime->user_id === $user->id;
        $isManager = $user->hasPermission('delete-overtimes');

        if (! $isOwner && ! $isManager) {
            return $this->errorResponse(self::MSG_FORBIDDEN, 403);
        }

        if (! in_array($overtime->status, ['pending', 'draft'])) {
            return $this->errorResponse('Lembur yang sudah diproses tidak bisa dihapus.', 403);
        }

        // Log Activity (Before delete)
        ActivityLog::create([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'action' => 'OVERTIME_DELETION',
            'description' => "Menghapus pengajuan lembur: " . ($overtime->title ?? '-'),
            'model_type' => self::MODEL_OVERTIME,
            'model_id' => $overtime->id,
        ]);

        $overtime->delete();

        return $this->successResponse(null, 'Permohonan lembur berhasil dihapus.');
    }

    public function export(Request $request)
    {
        $query = Overtime::with(['user', 'approver', 'items']);
        $user = $request->user();

        // Isolation logic (same as index)
        if ($user->is_manager) {
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $query->where('company_id', $user->company_id);
            }
        } else {
            $query->where('user_id', $user->id);
        }

        // Filtering
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereHas('items', function ($q) use ($request) {
                $q->whereBetween('date', [$request->start_date, $request->end_date]);
            });
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        // Default to approved if not specified, usually reports are for approved items
        if ($request->status === 'approved') {
            $query->where('status', 'approved');
        }

        $overtimes = $query->orderBy('id', 'asc')->get();

        if ($overtimes->isEmpty()) {
            return response()->json(['message' => 'Tidak ada data lembur untuk diekspor.'], 404);
        }

        $meta = [
            'date_range' => $request->filled('date_range') ? $request->date_range : date('F Y'),
            'office_name' => $user->company?->offices()->first()->name ?? 'KP Cakung',
            'company_name' => $user->company->name ?? 'PT. Narwastu Group',
            'hr_ga' => User::where('company_id', $user->company_id)
                ->whereHas('role', function ($q) {
                    $q->where('name', 'LIKE', '%HR%');
                })->first()->name ?? 'Nazirin Nawawi',
            'today' => now(),
        ];

        return Excel::download(new OvertimeExport($overtimes, $meta), 'laporan-lembur-'.now()->format('Y-m-d').'.xlsx');
    }
}
