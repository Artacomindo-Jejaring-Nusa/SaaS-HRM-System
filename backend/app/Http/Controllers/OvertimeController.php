<?php

namespace App\Http\Controllers;

use App\Exports\OvertimeExport;
use App\Models\ActivityLog;
use App\Models\Overtime;
use App\Models\OvertimeItem;
use App\Models\User;
use App\Services\ApprovalService;
use App\Services\EmployeeQueryService;
use App\Traits\Notifiable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;

use App\Traits\HandlesOvertimeAssignment;
use App\Traits\HandlesOvertimeWorkflow;

class OvertimeController extends Controller
{
    use HandlesOvertimeAssignment, HandlesOvertimeWorkflow, Notifiable;

    private const MSG_FORBIDDEN = 'Akses ditolak.';

    private const MODEL_OVERTIME = 'App\Models\Overtime';

    private const RULE_REQ_STRING = 'required|string';

    private const NOTIFICATION_OVERTIME_SUCCESS = 'PENGAJUAN LEMBUR BERHASIL';

    private const ROUTE_OVERTIMES = '/dashboard/overtimes';

    public function index(Request $request)
    {
        $query = Overtime::with(['user.role', 'assigner.role', 'division', 'approver', 'items']);
        $user = $request->user();

        $this->applyIndexScope($query, $user, $request->get('type'));
        $this->applyIndexFilters($query, $request);

        $perPage = $request->get('per_page', 10);
        $overtimes = $query->orderBy('date', 'desc')->orderBy('created_at', 'desc')->paginate($perPage);

        return $this->successResponse($overtimes, 'Data lembur berhasil diambil.');
    }

    private function applyIndexScope($query, User $user, ?string $type): void
    {
        if ($type === 'assigned' || $type === 'sent') {
            $query->where('assigned_by', $user->id);

            return;
        }

        if ($type === 'received') {
            $query->where('user_id', $user->id);

            return;
        }

        $this->applyCompanyOrSubordinateScope($query, $user);
    }

    private function applyCompanyOrSubordinateScope($query, User $user): void
    {
        $isSuperAdmin = $user->isSuperAdmin() || $user->role_id === 1 || $user->canAccessAllCompanies();
        if ($isSuperAdmin) {
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $query->where('company_id', $user->company_id);
            }

            return;
        }

        $subordinateIds = EmployeeQueryService::resolveSubordinateIds($user->id);
        if (! empty($subordinateIds)) {
            $query->where(function ($q) use ($user, $subordinateIds) {
                $q->where('user_id', $user->id)
                    ->orWhere('assigned_by', $user->id)
                    ->orWhereIn('user_id', $subordinateIds);
            });
        } else {
            $query->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)->orWhere('assigned_by', $user->id);
            });
        }

        if ($user->company_id) {
            $query->where('company_id', $user->company_id);
        }
    }

    private function applyIndexFilters($query, Request $request): void
    {
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('start_date')) {
            $query->whereDate('date', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->whereDate('date', '<=', $request->end_date);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }
    }

    /**
     * Show a single overtime detail.
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $isSuperAdmin = $user->isSuperAdmin() || $user->role_id === 1;
        $overtime = Overtime::with(['user.role', 'user.office', 'user.company', 'assigner.role', 'division', 'approver', 'items'])->findOrFail($id);

        // Security: only owner, assigner, or manager/superadmin can view
        if (! $user->is_manager && ! $isSuperAdmin && $overtime->user_id !== $user->id && $overtime->assigned_by !== $user->id) {
            return $this->errorResponse(self::MSG_FORBIDDEN, 403);
        }

        return $this->successResponse($overtime, 'Detail lembur.');
    }

    /**
     * Store overtime as SPKL (Surat Perintah Kerja Lembur) or Self-Submission (Pengajuan Mandiri).
     */
    public function store(Request $request)
    {
        $user = $request->user();
        $isAssignment = $request->boolean('is_assignment')
            || $request->filled('division_id')
            || ($request->filled('user_id') && (is_array($request->user_id) || (int) $request->user_id !== (int) $user->id));

        if ($isAssignment) {
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

        // Jalur Pengajuan Lembur Mandiri (masuk ke Approval Workflow Super Admin)
        $isSuperAdmin = $user->isSuperAdmin() || $user->role_id === 1;
        if (! $user->hasPermission('apply-overtimes') && ! $isSuperAdmin) {
            return $this->errorResponse('Akses ditolak. Anda tidak memiliki izin untuk mengajukan lembur.', 403);
        }

        $this->normalizeOvertimeItems($request);
        $this->validateSelfStoreRequest($request);

        $createdOvertime = $this->createSelfSubmittedOvertime($request, $user);

        return $this->successResponse($createdOvertime, 'Permohonan lembur berhasil diajukan dan sedang menunggu persetujuan.', 201);
    }

    private function validateSelfStoreRequest(Request $request): void
    {
        $request->validate([
            'title' => 'nullable|string|max:255',
            'date' => 'required|date',
            'start_time' => 'required|string',
            'end_time' => 'required|string',
            'reason' => 'required|string',
            'signature' => 'nullable|string',
            'items' => 'nullable|array',
            'items.*.date' => 'nullable|date',
            'items.*.start_time' => 'nullable|string',
            'items.*.end_time' => 'nullable|string',
            'items.*.reason' => 'nullable|string',
        ]);
    }

    private function createSelfSubmittedOvertime(Request $request, User $user): Overtime
    {
        $companyId = $user->company_id;
        $workflowResult = ApprovalService::initApproval('overtime', $companyId, $user);

        $status = $workflowResult ? $workflowResult['status'] : 'pending';
        $currentStep = $workflowResult ? $workflowResult['current_approval_step'] : null;

        $overtime = Overtime::create([
            'user_id' => $user->id,
            'company_id' => $companyId,
            'assigned_by' => null,
            'division_id' => null,
            'title' => $request->title ?: 'Pengajuan Lembur - '.$user->name,
            'date' => $request->date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'reason' => $request->reason,
            'signature' => $request->signature,
            'status' => $status,
            'current_approval_step' => $currentStep,
        ]);

        $this->createOvertimeItemsFromRequest($overtime, $request);

        ActivityLog::create([
            'user_id' => $user->id,
            'company_id' => $companyId,
            'action' => 'OVERTIME_SUBMISSION',
            'description' => 'Mengajukan lembur mandiri: '.($overtime->title ?? $overtime->reason),
            'model_type' => self::MODEL_OVERTIME,
            'model_id' => $overtime->id,
        ]);

        if (! $this->handleOvertimeWorkflowNotification($user, $companyId)) {
            $this->notify($user, self::NOTIFICATION_OVERTIME_SUCCESS, 'Permohonan lembur Anda sedang menunggu persetujuan.', 'info');
        }

        $this->notifySuperAdmins(
            $companyId,
            'PENGAJUAN LEMBUR BARU',
            "Karyawan {$user->name} mengajukan lembur: {$overtime->title} pada tanggal {$overtime->date}.",
            'warning',
            self::ROUTE_APPROVALS,
            $user->id
        );

        return $overtime->load(['items', 'user.role']);
    }

    /**
     * Employee response to overtime assignment (Accept / Reject with comment).
     */
    public function respond(Request $request, $id)
    {
        $user = $request->user();
        $overtime = Overtime::with(['user', 'assigner'])->findOrFail($id);

        if ($overtime->user_id !== $user->id) {
            return $this->errorResponse('Akses ditolak. Anda bukan penerima perintah lembur ini.', 403);
        }

        if ($overtime->status !== 'pending') {
            return $this->errorResponse('Perintah lembur ini sudah direspon sebelumnya (Status: '.strtoupper($overtime->status).').', 422);
        }

        $request->validate([
            'action' => 'required|in:accept,reject',
            'reason' => 'required_if:action,reject|nullable|string|max:500',
        ], [
            'reason.required_if' => 'Mohon sertakan alasan/komentar penolakan perintah lembur.',
        ]);

        $msg = $this->processOvertimeResponse($overtime, $user, $request);

        return $this->successResponse($overtime->fresh(['user.role', 'assigner.role', 'items']), $msg);
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

    /**
     * Update a draft overtime. Can also transition from draft to submitted.
     */
    public function update(Request $request, $id)
    {
        $this->normalizeOvertimeItems($request);

        $user = $request->user();
        $overtime = Overtime::findOrFail($id);

        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');

        // Only owner or super admin can edit
        if (! $isSuperAdmin && $overtime->user_id !== $user->id) {
            return $this->errorResponse(self::MSG_FORBIDDEN, 403);
        }

        if (! $isSuperAdmin && ! in_array($overtime->status, ['draft', 'pending', 'pending_supervisor', 'pending_hr'])) {
            return $this->errorResponse('Hanya lembur berstatus draf atau menunggu persetujuan yang bisa diubah.', 403);
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

        $firstItem = null;
        if ($request->has('items') && is_array($request->items) && count($request->items) > 0) {
            $firstItem = $request->items[0];
        }

        if ($firstItem) {
            $updateData['date'] = $request->input('date', $firstItem['date'] ?? null);
            $updateData['start_time'] = $request->input('start_time', $firstItem['start_time'] ?? null);
            $updateData['end_time'] = $request->input('end_time', $firstItem['end_time'] ?? null);
            $updateData['reason'] = $request->input('reason', $firstItem['reason'] ?? null);
        }

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

    private function handlePostOvertimeUpdate(Overtime $overtime, User $user, bool $isSubmitting): JsonResponse
    {
        $companyId = $user->company_id;
        $action = $isSubmitting ? 'OVERTIME_SUBMISSION' : 'OVERTIME_DRAFT_UPDATE';
        $desc = $isSubmitting
            ? 'Mengajukan lembur dari draf: '.($overtime->title ?? '-')
            : 'Memperbarui draf lembur: '.($overtime->title ?? '-');

        ActivityLog::create([
            'user_id' => $user->id,
            'company_id' => $companyId,
            'action' => $action,
            'description' => $desc,
            'model_type' => self::MODEL_OVERTIME,
            'model_id' => $overtime->id,
        ]);

        if ($isSubmitting) {
            if (! $this->handleOvertimeWorkflowNotification($user, $companyId)) {
                $this->notify($user, self::NOTIFICATION_OVERTIME_SUCCESS, 'Permohonan lembur Anda sedang menunggu persetujuan.', 'info');
            }

            $this->notifySuperAdmins(
                $companyId,
                'PENGAJUAN LEMBUR BARU',
                "Karyawan {$user->name} mengajukan lembur: ".($overtime->title ?? $overtime->reason ?? 'Lembur Karyawan').($overtime->date ? " pada tanggal {$overtime->date}." : '.'),
                'warning',
                self::ROUTE_APPROVALS,
                $user->id
            );

            return $this->successResponse($overtime, 'Lembur berhasil diajukan.');
        }

        return $this->successResponse($overtime, 'Draf lembur berhasil diperbarui.');
    }

    public function approve(Request $request, $id)
    {
        $overtime = Overtime::findOrFail($id);

        if ($overtime->current_approval_step !== null) {
            return $this->handleWorkflowDecision($request, $overtime, 'approve');
        }

        return $this->handleFallbackDecision($request, $overtime, 'approve');
    }

    public function reject(Request $request, $id)
    {
        $overtime = Overtime::findOrFail($id);

        if ($overtime->current_approval_step !== null) {
            return $this->handleWorkflowDecision($request, $overtime, 'reject');
        }

        return $this->handleFallbackDecision($request, $overtime, 'reject');
    }

    public function destroy(Request $request, $id)
    {
        $overtime = Overtime::with(['user', 'items'])->findOrFail($id);
        $user = $request->user();
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');

        $isOwner = $overtime->user_id === $user->id;
        $isAssigner = $overtime->assigned_by === $user->id;
        $isManager = $user->hasPermission('delete-overtimes');

        if (! $isSuperAdmin && ! $isOwner && ! $isManager && ! $isAssigner) {
            return $this->errorResponse(self::MSG_FORBIDDEN, 403);
        }

        if (! $isSuperAdmin && ! in_array($overtime->status, ['pending', 'draft'])) {
            return $this->errorResponse('Lembur yang sudah diproses tidak bisa dihapus.', 403);
        }

        $oldValues = $overtime->toArray();
        $this->logActivity('DELETE_OVERTIME', "Menghapus pengajuan lembur #{$overtime->id} (".($overtime->title ?? '-').') oleh '.($overtime->user?->name ?? 'Karyawan'), $overtime, 'overtimes', $oldValues, null);

        $overtime->items()->delete();
        $overtime->delete();

        return $this->successResponse(null, 'Permohonan lembur berhasil dihapus.');
    }

    public function export(Request $request)
    {
        $query = Overtime::with(['user', 'approver', 'items']);
        $user = $request->user();

        // Isolation logic (same as index)
        $this->applyCompanyOrSubordinateScope($query, $user);

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
    private function handleFallbackDecision(Request $request, Overtime $overtime, string $decision): JsonResponse
    {
        $this->authorizeFallbackDecision($request->user(), $overtime);

        $isApproval = $decision === 'approve';
        $status = $isApproval ? 'approved' : 'rejected';
        $action = $isApproval ? 'OVERTIME_APPROVAL' : 'OVERTIME_REJECTION';
        $actionLabel = $isApproval ? 'Menyetujui' : 'Menolak';
        $notifTitle = $isApproval ? 'LEMBUR DISETUJUI' : 'LEMBUR DITOLAK';
        $notifMsg = $isApproval
            ? 'Permohonan lembur Anda telah DISETUJUI oleh Admin.'
            : 'Mohon maaf, permohonan lembur Anda telah DITOLAK.';
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

        $this->notifySuperAdmins(
            $overtime->company_id,
            $isApproval ? 'PENGAJUAN LEMBUR DISETUJUI' : 'PENGAJUAN LEMBUR DITOLAK',
            "Pengajuan lembur {$overtime->user->name} (".($overtime->title ?? '-').') telah '.($isApproval ? 'DISETUJUI' : 'DITOLAK')." oleh {$request->user()->name}.".($request->remark ? " Catatan: {$request->remark}" : ''),
            $notifType,
            self::ROUTE_APPROVALS,
            $request->user()->id
        );

        return $this->successResponse($overtime, $responseMsg);
    }

    private function handleOvertimeWorkflowNotification(User $user, int $companyId)
    {
        $workflowResult = ApprovalService::initApproval('overtime', $companyId, $user);

        if ($workflowResult) {
            if (! empty($workflowResult['auto_approved'])) {
                $this->notify($user, self::NOTIFICATION_OVERTIME_SUCCESS, 'Permohonan lembur Anda telah DISETUJUI OTOMATIS karena alur persetujuan dinonaktifkan.', 'success');

                return true;
            }

            if (isset($workflowResult['approvers'])) {
                $this->notify($user, self::NOTIFICATION_OVERTIME_SUCCESS, "Permohonan lembur Anda telah diajukan. Menunggu: {$workflowResult['step_label']}.", 'info');
                foreach ($workflowResult['approvers'] as $approver) {
                    $this->notify($approver, 'PENGAJUAN LEMBUR PERLU PERSETUJUAN', "{$user->name} telah mengajukan lembur. Mohon segera tinjau.", 'warning', self::ROUTE_APPROVALS);
                }

                return true;
            }
        }

        return false;
    }

    private function authorizeFallbackDecision(User $user, Overtime $overtime): void
    {
        $isSuperAdmin = $user->isSuperAdmin() || $user->role_id === 1 || $user->canAccessAllCompanies();
        if (! $isSuperAdmin) {
            $subordinateIds = EmployeeQueryService::resolveSubordinateIds($user->id);
            if (! in_array($overtime->user_id, $subordinateIds) && $overtime->assigned_by !== $user->id) {
                abort(403, 'Akses ditolak. Anda tidak memiliki izin untuk memproses lembur karyawan ini.');
            }
        }
        abort_if(! $user->hasPermission('approve-overtimes') && ! $isSuperAdmin, 403, self::MSG_FORBIDDEN);
    }
}
