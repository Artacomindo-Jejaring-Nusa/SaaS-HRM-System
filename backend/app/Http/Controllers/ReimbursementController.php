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
            'items' => 'nullable|array',
            'divisi' => 'nullable|string',
            'tujuan' => 'nullable|string',
            'priority' => 'nullable|string',
        ]);

        $paths = [];
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                // Compress and scale (1000px for receipt readability)
                $path = 'reimbursements/'.Str::random(40).'.jpg';
                $img = Image::decode($file);
                $img->scale(width: 1000);
                Storage::disk('public')->put($path, (string) $img->encodeUsingFileExtension('jpg', 80));
                $paths[] = $path;
            }
        }

        $user = $request->user();
        $companyId = $user->company_id;

        // ── Dynamic Workflow Check ──
        $workflowResult = ApprovalService::initApproval('reimbursement', $companyId, $user);

        if ($workflowResult) {
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
                'items' => $request->items,
                'divisi' => $request->divisi,
                'tujuan' => $request->tujuan,
                'priority' => $request->priority ?? 'Normal',
            ]);

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
                    '/dashboard/approvals'
                );
            }
        } else {
            // ── Fallback: Default logic ──
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

            // 1. Notify the Submitting User (Confirmation)
            $this->notify(
                $user,
                'PENGAJUAN REIMBURSEMENT',
                "Klaim reimbursement Anda '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.').' telah diajukan.',
                'info',
                self::URL_DASHBOARD_REIMBURSEMENTS
            );

            // 2. Notify User's Supervisor
            if ($user->supervisor_id) {
                $supervisor = $user->supervisor;
                if ($supervisor) {
                    $this->notify(
                        $supervisor,
                        'KLAIM REIMBURSEMENT BAWAHAN',
                        "Karyawan {$user->name} mengajukan klaim '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.').'. Mohon segera tinjau.',
                        'warning',
                        '/dashboard/approvals'
                    );
                }
            }

            // 3. Notify Admins/Approvers/Finance in the same company
            // Approver roles: Super Admin (7), HRD (2), Finance (10), HRD Manager (8)
            $admins = User::where('company_id', $companyId)
                ->whereIn('role_id', [7, 2, 10, 8])
                ->where('id', '!=', $user->id)
                ->where('id', '!=', $user->supervisor_id) // Don't notify twice
                ->get();

            foreach ($admins as $admin) {
                $this->notify(
                    $admin,
                    'KLAIM REIMBURSEMENT BARU (ADMIN)',
                    "Karyawan {$user->name} mengajukan klaim '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.').'.',
                    'warning',
                    '/dashboard/approvals'
                );
            }
        }

        $this->logActivity('SUBMIT_REIMBURSEMENT', "Mengajukan reimbursement '{$request->title}' senilai Rp ".number_format($request->amount, 0, ',', '.'), $reimbursement);

        return $this->successResponse($reimbursement, 'Klaim berhasil diajukan.', 201);
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
                    $this->notify($nextApprover, 'REIMBURSEMENT MENUNGGU PERSETUJUAN', "Klaim '{$reimbursement->title}' dari {$reimbursement->user->name} menunggu persetujuan Anda. Tahap: {$result['step_label']}.", 'warning', '/dashboard/approvals');
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

    public function destroy(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('delete-reimbursements'), 403, self::MSG_FORBIDDEN);
        $reimbursement = Reimbursement::findOrFail($id);

        if ($reimbursement->status !== 'pending') {
            return $this->errorResponse('Klaim yang sudah diproses tidak bisa dihapus.', 403);
        }

        $id_deleted = $reimbursement->id;
        $title_deleted = $reimbursement->title;
        $reimbursement->delete();

        $this->logActivity('DELETE_REIMBURSEMENT', "Menghapus pengajuan reimbursement '{$title_deleted}' (ID: {$id_deleted})");

        return $this->successResponse(null, 'Klaim berhasil dihapus.');
    }
}
