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
    private const NOTIFICATION_OVERTIME_SUCCESS = 'PENGAJUAN LEMBUR BERHASIL';

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
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filter by date range
        if ($request->filled('start_date')) {
            $query->whereDate('date', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->whereDate('date', '<=', $request->end_date);
        }

        // Filter by user ID
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        $perPage = $request->get('per_page', 10);
        $overtimes = $query->orderBy('date', 'desc')->paginate($perPage);

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
        $this->normalizeOvertimeItems($request);

        $isDraft = $request->input('status') === 'draft';

        $this->validateOvertimeStore($request, $isDraft);

        $user = $request->user();
        $companyId = $user->company_id;

        $overtime = DB::transaction(function () use ($request, $user, $companyId, $isDraft) {
            return $this->createOvertime($request, $user, $companyId, $isDraft);
        });

        return $this->handlePostOvertimeStore($overtime, $user, $companyId, $isDraft);
    }

    private function normalizeOvertimeItems(Request $request): void
    {
        if (! $request->has('items') && $request->filled('date')) {
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
        if ($isDraft) {
            // Draft: minimal validation
            $request->validate([
                'title' => 'nullable|string|max:255',
                'items' => 'nullable|array',
                'items.*.date' => 'required|date',
                'items.*.start_time' => self::RULE_REQ_STRING,
                'items.*.end_time' => self::RULE_REQ_STRING,
                'items.*.reason' => self::RULE_REQ_STRING,
            ]);
        } else {
            // Submit: full validation
            $request->validate([
                'title' => 'nullable|string|max:255',
                'items' => 'required|array|min:1',
                'items.*.date' => 'required|date',
                'items.*.start_time' => self::RULE_REQ_STRING,
                'items.*.end_time' => self::RULE_REQ_STRING,
                'items.*.reason' => self::RULE_REQ_STRING,
                'signature' => 'nullable|string',
            ]);
        }
    }

    private function createOvertime(Request $request, User $user, $companyId, bool $isDraft): Overtime
    {
        if ($isDraft) {
            $overtime = Overtime::create([
                'user_id' => $user->id,
                'company_id' => $companyId,
                'title' => $request->title,
                'status' => 'draft',
            ]);
        } else {
            // ── Dynamic Workflow Check ──
            $workflowResult = ApprovalService::initApproval('overtime', $companyId, $user);

            if ($workflowResult) {
                $overtime = Overtime::create([
                    'user_id' => $user->id,
                    'company_id' => $companyId,
                    'title' => $request->title,
                    'signature' => $request->signature,
                    'status' => $workflowResult['status'],
                    'current_approval_step' => $workflowResult['current_approval_step'],
                ]);
            } else {
                $overtime = Overtime::create([
                    'user_id' => $user->id,
                    'company_id' => $companyId,
                    'title' => $request->title,
                    'signature' => $request->signature,
                    'status' => 'pending',
                ]);
            }
        }

        // Create items
        if ($request->has('items') && is_array($request->items)) {
            foreach ($request->items as $item) {
                OvertimeItem::create([
                    'overtime_id' => $overtime->id,
                    'date' => $item['date'],
                    'start_time' => $item['start_time'],
                    'end_time' => $item['end_time'],
                    'reason' => $item['reason'],
                ]);
            }
        }

        $overtime->load('items');

        return $overtime;
    }

    private function handlePostOvertimeStore(Overtime $overtime, User $user, $companyId, bool $isDraft): \Illuminate\Http\JsonResponse
    {
        if ($isDraft) {
            ActivityLog::create([
                'user_id' => $user->id,
                'company_id' => $companyId,
                'action' => 'OVERTIME_DRAFT',
                'description' => "Menyimpan draf lembur: " . ($overtime->title ?? 'Untitled'),
                'model_type' => self::MODEL_OVERTIME,
                'model_id' => $overtime->id,
            ]);

            return $this->successResponse($overtime, 'Draf lembur berhasil disimpan.', 201);
        }

        // Notifications for submit
        ActivityLog::create([
            'user_id' => $user->id,
            'company_id' => $companyId,
            'action' => 'OVERTIME_SUBMISSION',
            'description' => "Mengajukan lembur: " . ($overtime->title ?? '-'),
            'model_type' => self::MODEL_OVERTIME,
            'model_id' => $overtime->id,
        ]);

        if ($this->handleOvertimeWorkflowNotification($user, $companyId)) {
            // Already handled
        } else {
            // Fallback notifications
            if ($user->supervisor_id) {
                $supervisor = $user->supervisor;
                if ($supervisor) {
                    $this->notify($supervisor, 'PENGAJUAN LEMBUR BAWAHAN', "{$user->name} telah mengajukan lembur. Mohon segera tinjau.", 'warning', self::ROUTE_APPROVALS);
                }
            }

            $admins = User::where('company_id', $companyId)
                ->where('id', '!=', $user->id)
                ->where('id', '!=', $user->supervisor_id)
                ->whereHrdOrAdmin('approve-overtimes')
                ->get();

            foreach ($admins as $admin) {
                $this->notify($admin, 'PENGAJUAN LEMBUR BARU (ADMIN)', "{$user->name} telah mengajukan lembur.", 'warning', self::ROUTE_APPROVALS);
            }

            $this->notify($user, self::NOTIFICATION_OVERTIME_SUCCESS, "Permohonan lembur Anda sedang menunggu persetujuan.", 'info');
        }

        return $this->successResponse($overtime, 'Permohonan lembur berhasil diajukan.', 201);
    }

    /**
     * Update a draft overtime. Can also transition from draft to submitted.
     */
    public function update(Request $request, $id)
    {
        $this->normalizeOvertimeItems($request);

        $user = $request->user();
        $overtime = Overtime::findOrFail($id);

        // Only owner can edit, only drafts can be updated
        if ($overtime->user_id !== $user->id) {
            return $this->errorResponse(self::MSG_FORBIDDEN, 403);
        }

        if ($overtime->status !== 'draft') {
            return $this->errorResponse('Hanya lembur berstatus draf yang bisa diubah.', 403);
        }

        $isSubmitting = $request->input('status') === 'pending';

        $this->validateOvertimeUpdate($request, $isSubmitting);

        $overtime = DB::transaction(function () use ($request, $user, $overtime, $isSubmitting) {
            return $this->performOvertimeUpdate($request, $user, $overtime, $isSubmitting);
        });

        return $this->handlePostOvertimeUpdate($overtime, $user, $isSubmitting);
    }

    private function validateOvertimeUpdate(Request $request, bool $isSubmitting): void
    {
        if ($isSubmitting) {
            $request->validate([
                'title' => 'nullable|string|max:255',
                'items' => 'required|array|min:1',
                'items.*.date' => 'required|date',
                'items.*.start_time' => self::RULE_REQ_STRING,
                'items.*.end_time' => self::RULE_REQ_STRING,
                'items.*.reason' => self::RULE_REQ_STRING,
                'signature' => 'nullable|string',
            ]);
        } else {
            $request->validate([
                'title' => 'nullable|string|max:255',
                'items' => 'nullable|array',
                'items.*.date' => 'required|date',
                'items.*.start_time' => self::RULE_REQ_STRING,
                'items.*.end_time' => self::RULE_REQ_STRING,
                'items.*.reason' => self::RULE_REQ_STRING,
            ]);
        }
    }

    private function performOvertimeUpdate(Request $request, User $user, Overtime $overtime, bool $isSubmitting): Overtime
    {
        $companyId = $user->company_id;

        // Update main record
        $updateData = ['title' => $request->title ?? $overtime->title];

        if ($isSubmitting) {
            $updateData['signature'] = $request->signature;
            $workflowResult = ApprovalService::initApproval('overtime', $companyId, $user);

            if ($workflowResult) {
                $updateData['status'] = $workflowResult['status'];
                $updateData['current_approval_step'] = $workflowResult['current_approval_step'];
            } else {
                $updateData['status'] = 'pending';
            }
        }

        $overtime->update($updateData);

        // Replace items
        if ($request->has('items') && is_array($request->items)) {
            $overtime->items()->delete();
            foreach ($request->items as $item) {
                OvertimeItem::create([
                    'overtime_id' => $overtime->id,
                    'date' => $item['date'],
                    'start_time' => $item['start_time'],
                    'end_time' => $item['end_time'],
                    'reason' => $item['reason'],
                ]);
            }
        }

        $overtime->load('items');

        return $overtime;
    }

    private function handlePostOvertimeUpdate(Overtime $overtime, User $user, bool $isSubmitting): \Illuminate\Http\JsonResponse
    {
        $companyId = $user->company_id;
        $action = $isSubmitting ? 'OVERTIME_SUBMISSION' : 'OVERTIME_DRAFT_UPDATE';
        $desc = $isSubmitting
            ? "Mengajukan lembur dari draf: " . ($overtime->title ?? '-')
            : "Memperbarui draf lembur: " . ($overtime->title ?? '-');

        ActivityLog::create([
            'user_id' => $user->id,
            'company_id' => $companyId,
            'action' => $action,
            'description' => $desc,
            'model_type' => self::MODEL_OVERTIME,
            'model_id' => $overtime->id,
        ]);

        if ($isSubmitting) {
            if (!$this->handleOvertimeWorkflowNotification($user, $companyId)) {
                $this->notify($user, self::NOTIFICATION_OVERTIME_SUCCESS, "Permohonan lembur Anda sedang menunggu persetujuan.", 'info');
            }

            return $this->successResponse($overtime, 'Lembur berhasil diajukan.');
        }

        return $this->successResponse($overtime, 'Draf lembur berhasil diperbarui.');
    }

    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $overtime = Overtime::findOrFail($id);

        // ── Dynamic Workflow Path ──
        if ($overtime->current_approval_step !== null) {
            $result = ApprovalService::processApproval(
                'overtime', $overtime->company_id, $user, $overtime->user, $overtime->current_approval_step, 'approve'
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

            $overtime->update($updateData);

            ActivityLog::create([
                'user_id' => $user->id,
                'company_id' => $user->company_id,
                'action' => 'OVERTIME_APPROVAL',
                'description' => "Menyetujui lembur {$overtime->user->name}",
                'model_type' => self::MODEL_OVERTIME,
                'model_id' => $overtime->id,
            ]);

            if ($result['is_final'] && $result['status'] === 'approved') {
                $this->notify($overtime->user, 'LEMBUR DISETUJUI', "Permohonan lembur Anda telah DISETUJUI.", 'success');

                return $this->successResponse($overtime, 'Permohonan lembur disetujui.');
            }

            if (isset($result['approvers'])) {
                foreach ($result['approvers'] as $nextApprover) {
                    $this->notify($nextApprover, 'LEMBUR MENUNGGU PERSETUJUAN', "Pengajuan lembur {$overtime->user->name} menunggu persetujuan Anda. Tahap: {$result['step_label']}.", 'warning', self::ROUTE_APPROVALS);
                }
            }
            $this->notify($overtime->user, 'LEMBUR DALAM PROSES', "Pengajuan lembur Anda disetujui di tahap sebelumnya. Menunggu: {$result['step_label']}.", 'info');

            return $this->successResponse($overtime, "Di-approve. Menunggu: {$result['step_label']}.");
        }

        // ── Fallback: Default logic ──
        return $this->handleFallbackDecision($request, $overtime, 'approve');
    }

    public function reject(Request $request, $id)
    {
        $user = $request->user();
        $overtime = Overtime::findOrFail($id);

        // ── Dynamic Workflow Path ──
        if ($overtime->current_approval_step !== null) {
            $result = ApprovalService::processApproval(
                'overtime', $overtime->company_id, $user, $overtime->user, $overtime->current_approval_step, 'reject'
            );

            if ($result === null) {
                return $this->errorResponse('Workflow tidak ditemukan.', 400);
            }
            if (isset($result['error'])) {
                return $this->errorResponse($result['error'], 403);
            }

            $overtime->update([
                'status' => 'rejected',
                'current_approval_step' => null,
                'approved_by' => $user->id,
                'remark' => $request->remark,
            ]);

            ActivityLog::create([
                'user_id' => $user->id,
                'company_id' => $user->company_id,
                'action' => 'OVERTIME_REJECTION',
                'description' => "Menolak lembur {$overtime->user->name}",
                'model_type' => self::MODEL_OVERTIME,
                'model_id' => $overtime->id,
            ]);

            $this->notify($overtime->user, 'LEMBUR DITOLAK', "Mohon maaf, permohonan lembur Anda telah DITOLAK.", 'danger');

            return $this->successResponse($overtime, 'Permohonan lembur ditolak.');
        }

        // ── Fallback: Default logic ──
        return $this->handleFallbackDecision($request, $overtime, 'reject');
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

    /**
     * Handle fallback approve/reject when no dynamic workflow is configured.
     * Consolidates duplicate logic from approve() and reject() fallback paths.
     */
    private function handleFallbackDecision(Request $request, Overtime $overtime, string $decision): \Illuminate\Http\JsonResponse
    {
        abort_if(! $request->user()->hasPermission('approve-overtimes'), 403, self::MSG_FORBIDDEN);

        $isApproval = $decision === 'approve';
        $status = $isApproval ? 'approved' : 'rejected';
        $action = $isApproval ? 'OVERTIME_APPROVAL' : 'OVERTIME_REJECTION';
        $actionLabel = $isApproval ? 'Menyetujui' : 'Menolak';
        $notifTitle = $isApproval ? 'LEMBUR DISETUJUI' : 'LEMBUR DITOLAK';
        $notifMsg = $isApproval
            ? "Permohonan lembur Anda telah DISETUJUI oleh Admin."
            : "Mohon maaf, permohonan lembur Anda telah DITOLAK.";
        $notifType = $isApproval ? 'success' : 'danger';
        $responseMsg = $isApproval ? 'Permohonan lembur disetujui.' : 'Permohonan lembur ditolak.';

        $overtime->update([
            'status' => $status,
            'approved_by' => $request->user()->id,
            'remark' => $request->remark,
        ]);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'company_id' => $request->user()->company_id,
            'action' => $action,
            'description' => "$actionLabel lembur {$overtime->user->name}",
            'model_type' => self::MODEL_OVERTIME,
            'model_id' => $overtime->id,
        ]);

        $this->notify($overtime->user, $notifTitle, $notifMsg, $notifType);

        return $this->successResponse($overtime, $responseMsg);
    }

    private function handleOvertimeWorkflowNotification(User $user, int $companyId)
    {
        $workflowResult = ApprovalService::initApproval('overtime', $companyId, $user);

        if ($workflowResult && isset($workflowResult['approvers'])) {
            $this->notify($user, self::NOTIFICATION_OVERTIME_SUCCESS, "Permohonan lembur Anda telah diajukan. Menunggu: {$workflowResult['step_label']}.", 'info');
            foreach ($workflowResult['approvers'] as $approver) {
                $this->notify($approver, 'PENGAJUAN LEMBUR PERLU PERSETUJUAN', "{$user->name} telah mengajukan lembur. Mohon segera tinjau.", 'warning', self::ROUTE_APPROVALS);
            }
            return true;
        }

        return false;
    }
}
