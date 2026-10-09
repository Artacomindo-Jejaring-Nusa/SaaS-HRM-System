<?php

namespace App\Http\Controllers;

use App\Models\Reimbursement;
use App\Models\User;
use App\Services\ApprovalService;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;

class ReimbursementController extends Controller
{
    use Notifiable;

    private const MSG_FORBIDDEN = 'Akses ditolak.';
    private const URL_DASHBOARD_REIMBURSEMENTS = '/dashboard/reimbursements';

    public function index(Request $request)
    {
        $query = Reimbursement::with('user');

        $user = $request->user();

        // Logic for Data Isolation:
        // 1. Managers/Admin see all company data by default.
        // 2. Staff (non-manager) only sees their own data.

        if ($user->is_manager) {
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $query->where('company_id', $user->company_id);
            }
        } else {
            $query->where('user_id', $user->id);
        }

        $reimbursements = $query->orderBy('id', 'desc')->paginate(10);

        return $this->successResponse($reimbursements, 'Daftar klaim berhasil diambil.');
    }

    public function store(Request $request)
    {
        if (is_string($request->items)) {
            $request->merge([
                'items' => json_decode($request->items, true)
            ]);
        }

        $request->validate([
            'employee_name' => 'nullable|string',
            'title' => 'required|string',
            'amount' => 'required|numeric',
            'description' => 'nullable|string',
            'attachments' => 'nullable|array',
            'attachments.*' => 'image|max:10240',
            'signature' => 'nullable|string',
            'items' => 'nullable',
            'divisi' => 'nullable|string',
            'tujuan' => 'nullable|string',
            'priority' => 'nullable|string',
        ]);

        $items = is_string($request->items) ? json_decode($request->items, true) : $request->items;
        $paths = $this->uploadAttachments($request);

        $user = $request->user();
        $companyId = $user->company_id;

        // ── Dynamic Workflow Check ──
        $workflowResult = ApprovalService::initApproval('reimbursement', $companyId, $user);

        if ($workflowResult) {
            $reimbursement = $this->createDynamicWorkflowReimbursement($workflowResult, $user, $companyId, $request, $paths, $items);
        } else {
            $reimbursement = $this->createFallbackReimbursement($user, $companyId, $request, $paths);
        }

        $this->logActivity('SUBMIT_REIMBURSEMENT', "Mengajukan reimbursement '{$request->title}' senilai Rp ".number_format($request->amount, 0, ',', '.'), $reimbursement);

        return $this->successResponse($reimbursement, 'Klaim berhasil diajukan.', 201);
    }

    private function uploadAttachments(Request $request): array
    {
        $paths = [];
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $path = 'reimbursements/'.Str::random(40).'.jpg';
                $img = Image::decode($file);
                $img->scale(width: 1000);
                Storage::disk('public')->put($path, (string) $img->encodeUsingFileExtension('jpg', 80));
                $paths[] = $path;
            }
        }
        return $paths;
    }

    private function createDynamicWorkflowReimbursement(array $workflowResult, $user, $companyId, Request $request, array $paths, $items): Reimbursement
    {
        $isAutoApproved = !empty($workflowResult['auto_approved']);
        $reimbursement = Reimbursement::create([
            'company_id' => $companyId,
            'user_id' => $user->id,
            'employee_name' => $request->employee_name,
            'title' => $request->title,
            'amount' => $request->amount,
            'description' => $request->description ?? '',
            'attachment' => $paths,
            'status' => $workflowResult['status'],
            'current_approval_step' => $workflowResult['current_approval_step'],
            'signature' => $request->signature,
            'items' => $items,
            'divisi' => $request->divisi,
            'tujuan' => $request->tujuan,
            'priority' => $request->priority ?? 'Normal',
            'approved_by' => $isAutoApproved ? $user->id : null,
        ]);

        if ($isAutoApproved) {
            $this->notify(
                $user,
                'KLAIM REIMBURSEMENT DISETUJUI OTOMATIS',
                "Klaim reimbursement Anda '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.')." telah DISETUJUI OTOMATIS karena alur persetujuan dinonaktifkan.",
                'success',
                self::URL_DASHBOARD_REIMBURSEMENTS
            );
        } else {
            $this->notify(
                $user,
                'PENGAJUAN REIMBURSEMENT',
                "Klaim reimbursement Anda '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.')." telah diajukan. Menunggu: {$workflowResult['step_label']}.",
                'info',
                self::URL_DASHBOARD_REIMBURSEMENTS
            );

            foreach ($workflowResult['approvers'] as $approver) {
                $this->notify(
                    $approver,
                    'KLAIM REIMBURSEMENT PERLU PERSETUJUAN',
                    "Karyawan {$user->name} mengajukan klaim '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.').'. Mohon segera tinjau.',
                    'warning',
                    self::ROUTE_APPROVALS
                );
            }
        }

        return $reimbursement;
    }

    private function createFallbackReimbursement($user, $companyId, Request $request, array $paths): Reimbursement
    {
        $reimbursement = Reimbursement::create([
            'company_id' => $companyId,
            'user_id' => $user->id,
            'title' => $request->title,
            'amount' => $request->amount,
            'description' => $request->description ?? '',
            'attachment' => $paths,
            'status' => 'pending',
            'signature' => $request->signature,
            'items' => $request->items,
            'divisi' => $request->divisi,
            'tujuan' => $request->tujuan,
            'priority' => $request->priority ?? 'Normal',
        ]);

        $this->notify(
            $user,
            'PENGAJUAN REIMBURSEMENT',
            "Klaim reimbursement Anda '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.').' telah diajukan.',
            'info',
            self::URL_DASHBOARD_REIMBURSEMENTS
        );

        if ($user->supervisor_id && $user->supervisor) {
            $this->notify(
                $user->supervisor,
                'KLAIM REIMBURSEMENT BAWAHAN',
                "Karyawan {$user->name} mengajukan klaim '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.').'. Mohon segera tinjau.',
                'warning',
                self::ROUTE_APPROVALS
            );
        }

        $admins = User::where('company_id', $companyId)
            ->whereIn('role_id', [7, 2, 10, 8])
            ->where('id', '!=', $user->id)
            ->where('id', '!=', $user->supervisor_id)
            ->get();

        foreach ($admins as $admin) {
            $this->notify(
                $admin,
                'KLAIM REIMBURSEMENT BARU (ADMIN)',
                "Karyawan {$user->name} mengajukan klaim '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.').'.',
                'warning',
                self::ROUTE_APPROVALS
            );
        }

        return $reimbursement;
    }

    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $reimbursement = Reimbursement::findOrFail($id);

        // ── Dynamic Workflow Path ──
        if ($reimbursement->current_approval_step !== null) {
            $result = ApprovalService::processApproval(
                'reimbursement', $reimbursement->company_id, $user, $reimbursement->user, $reimbursement->current_approval_step, 'approve'
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
                $updateData['remark'] = $request->remark;
            }

            $reimbursement->update($updateData);

            if ($result['is_final'] && $result['status'] === 'approved') {
                $msg = "Klaim reimbursement Anda '{$reimbursement->title}' sebesar Rp ".number_format($reimbursement->amount, 0, ',', '.').' telah DISETUJUI.';
                if ($request->remark) {
                    $msg .= " Catatan: {$request->remark}";
                }

                $this->notify($reimbursement->user, 'REIMBURSEMENT DISETUJUI', $msg, 'success', self::URL_DASHBOARD_REIMBURSEMENTS);
                $this->logActivity('APPROVE_REIMBURSEMENT', "Menyetujui klaim '{$reimbursement->title}' dari {$reimbursement->user->name}", $reimbursement);

                return $this->successResponse($reimbursement, 'Klaim disetujui.');
            }

            if (isset($result['approvers'])) {
                foreach ($result['approvers'] as $nextApprover) {
                    $this->notify($nextApprover, 'REIMBURSEMENT MENUNGGU PERSETUJUAN', "Klaim '{$reimbursement->title}' dari {$reimbursement->user->name} menunggu persetujuan Anda. Tahap: {$result['step_label']}.", 'warning', self::ROUTE_APPROVALS);
                }
            }
            $this->notify($reimbursement->user, 'REIMBURSEMENT DALAM PROSES', "Klaim '{$reimbursement->title}' Anda disetujui di tahap sebelumnya. Menunggu: {$result['step_label']}.", 'info');

            return $this->successResponse($reimbursement, "Di-approve. Menunggu: {$result['step_label']}.");
        }

        // ── Fallback: Default logic ──
        abort_if(! $request->user()->hasPermission('approve-reimbursements'), 403, self::MSG_FORBIDDEN);

        $reimbursement->update([
            'status' => 'approved',
            'remark' => $request->remark,
        ]);

        $msg = "Klaim reimbursement Anda '{$reimbursement->title}' sebesar Rp ".number_format($reimbursement->amount, 0, ',', '.').' telah DISETUJUI.';
        if ($request->remark) {
            $msg .= " Catatan: {$request->remark}";
        }

        $this->notify(
            $reimbursement->user,
            'REIMBURSEMENT DISETUJUI',
            $msg,
            'success',
            self::URL_DASHBOARD_REIMBURSEMENTS
        );

        $this->logActivity('APPROVE_REIMBURSEMENT', "Menyetujui klaim '{$reimbursement->title}' dari {$reimbursement->user->name}", $reimbursement);

        return $this->successResponse($reimbursement, 'Klaim disetujui.');
    }

    public function reject(Request $request, $id)
    {
        $user = $request->user();
        $reimbursement = Reimbursement::findOrFail($id);

        // ── Dynamic Workflow Path ──
        if ($reimbursement->current_approval_step !== null) {
            $result = ApprovalService::processApproval(
                'reimbursement', $reimbursement->company_id, $user, $reimbursement->user, $reimbursement->current_approval_step, 'reject'
            );

            if ($result === null) {
                return $this->errorResponse('Workflow tidak ditemukan.', 400);
            }
            if (isset($result['error'])) {
                return $this->errorResponse($result['error'], 403);
            }

            $reimbursement->update([
                'status' => 'rejected',
                'current_approval_step' => null,
                'remark' => $request->remark,
            ]);

            $msg = "Mohon maaf, klaim reimbursement Anda '{$reimbursement->title}' telah DITOLAK.";
            if ($request->remark) {
                $msg .= " Alasan: {$request->remark}";
            }

            $this->notify($reimbursement->user, 'REIMBURSEMENT DITOLAK', $msg, 'danger', self::URL_DASHBOARD_REIMBURSEMENTS);
            $this->logActivity('REJECT_REIMBURSEMENT', "Menolak klaim '{$reimbursement->title}' dari {$reimbursement->user->name}", $reimbursement);

            return $this->successResponse($reimbursement, 'Klaim ditolak.');
        }

        // ── Fallback: Default logic ──
        abort_if(! $request->user()->hasPermission('approve-reimbursements'), 403, self::MSG_FORBIDDEN);

        $reimbursement->update([
            'status' => 'rejected',
            'remark' => $request->remark,
        ]);

        $msg = "Mohon maaf, klaim reimbursement Anda '{$reimbursement->title}' telah DITOLAK.";
        if ($request->remark) {
            $msg .= " Alasan: {$request->remark}";
        }

        $this->notify(
            $reimbursement->user,
            'REIMBURSEMENT DITOLAK',
            $msg,
            'danger',
            self::URL_DASHBOARD_REIMBURSEMENTS
        );

        $this->logActivity('REJECT_REIMBURSEMENT', "Menolak klaim '{$reimbursement->title}' dari {$reimbursement->user->name}", $reimbursement);

        return $this->successResponse($reimbursement, 'Klaim ditolak.');
    }

    public function show(Request $request, $id)
    {
        $reimbursement = Reimbursement::with('user')->findOrFail($id);
        $user = $request->user();

        if (!$user->is_manager && $reimbursement->user_id !== $user->id) {
            abort(403, self::MSG_FORBIDDEN);
        }

        return $this->successResponse($reimbursement, 'Detail klaim berhasil diambil.');
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');

        $reimbursement = Reimbursement::where(function ($q) use ($user, $isSuperAdmin) {
            if (!$isSuperAdmin && !$user->canAccessAllCompanies()) {
                $q->where('company_id', $user->company_id);
            }
        })->findOrFail($id);

        $accessError = $this->validateReimbursementCanBeUpdated($reimbursement, $user, $isSuperAdmin);
        if ($accessError !== null) {
            return $this->errorResponse($accessError, 403);
        }

        $request->validate([
            'employee_name' => 'nullable|string',
            'title' => 'required|string',
            'amount' => 'required|numeric',
            'description' => 'nullable|string',
            'attachments' => 'nullable|array',
            'attachments.*' => 'image|max:10240',
            'signature' => 'nullable|string',
            'items' => 'nullable',
            'divisi' => 'nullable|string',
            'tujuan' => 'nullable|string',
            'priority' => 'nullable|string',
        ]);

        $items = is_string($request->items) ? json_decode($request->items, true) : $request->items;
        $existingPaths = $this->normalizeAttachmentList($reimbursement->attachment);
        $newPaths = $this->uploadAttachments($request);
        $paths = array_merge($existingPaths, $newPaths);

        $oldValues = $reimbursement->only(['title', 'amount', 'description', 'divisi', 'tujuan', 'priority']);

        $reimbursement->update([
            'employee_name' => $request->employee_name ?? $reimbursement->employee_name,
            'title' => $request->title,
            'amount' => $request->amount,
            'description' => $request->description ?? '',
            'attachment' => $paths,
            'signature' => $request->signature ?? $reimbursement->signature,
            'items' => $items ?? $reimbursement->items,
            'divisi' => $request->divisi ?? $reimbursement->divisi,
            'tujuan' => $request->tujuan ?? $reimbursement->tujuan,
            'priority' => $request->priority ?? $reimbursement->priority ?? 'Normal',
        ]);

        $newValues = $reimbursement->only(['title', 'amount', 'description', 'divisi', 'tujuan', 'priority']);

        $this->logActivity('UPDATE_REIMBURSEMENT', "Mengubah klaim reimbursement '{$reimbursement->title}' (ID: {$reimbursement->id})", $reimbursement, 'reimbursements', $oldValues, $newValues);

        return $this->successResponse($reimbursement, 'Klaim reimbursement berhasil diperbarui.');
    }

    private function validateReimbursementCanBeUpdated(Reimbursement $reimbursement, $user, bool $isSuperAdmin): ?string
    {
        if (!$isSuperAdmin && $reimbursement->user_id !== $user->id) {
            return self::MSG_FORBIDDEN;
        }

        if (!$isSuperAdmin && $reimbursement->status !== 'pending') {
            return 'Hanya klaim yang masih pending yang dapat diubah.';
        }

        return null;
    }

    private function normalizeAttachmentList(mixed $attachment): array
    {
        if (is_array($attachment)) {
            return $attachment;
        }
        if (!empty($attachment)) {
            return [$attachment];
        }
        return [];
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');

        $reimbursement = Reimbursement::findOrFail($id);

        $error = $this->checkCanDeleteReimbursement($reimbursement, $user, $isSuperAdmin);
        if ($error !== null) {
            if ($error === self::MSG_FORBIDDEN) {
                abort(403, self::MSG_FORBIDDEN);
            }
            return $this->errorResponse($error, 403);
        }

        $id_deleted = $reimbursement->id;
        $title_deleted = $reimbursement->title;
        $oldValues = $reimbursement->toArray();

        $this->deleteAttachmentFiles($reimbursement->attachment);

        $reimbursement->delete();

        $this->logActivity('DELETE_REIMBURSEMENT', "Menghapus pengajuan reimbursement '{$title_deleted}' (ID: {$id_deleted})", null, 'reimbursements', $oldValues, null);

        return $this->successResponse(null, 'Klaim berhasil dihapus.');
    }

    private function checkCanDeleteReimbursement(Reimbursement $reimbursement, $user, bool $isSuperAdmin): ?string
    {
        $isOwner = $reimbursement->user_id === $user->id;
        $canDelete = $user->hasPermission('delete-reimbursements') || $user->hasPermission('approve-reimbursements');

        if (!$isSuperAdmin && !$isOwner && !$canDelete) {
            return self::MSG_FORBIDDEN;
        }

        if (!$isSuperAdmin && $reimbursement->status !== 'pending') {
            return 'Klaim yang sudah diproses tidak bisa dihapus.';
        }

        return null;
    }

    private function deleteAttachmentFiles(mixed $attachment): void
    {
        $files = $this->normalizeAttachmentList($attachment);
        foreach ($files as $filePath) {
            if ($filePath && Storage::disk('public')->exists($filePath)) {
                Storage::disk('public')->delete($filePath);
            }
        }
    }
}
