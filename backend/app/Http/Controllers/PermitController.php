<?php

namespace App\Http\Controllers;

use App\Models\Permit;
use App\Models\User;
use App\Services\ApprovalService;
use App\Services\FCMService;
use App\Traits\Notifiable;
use Carbon\Carbon;
use Illuminate\Http\Request;

class PermitController extends Controller
{
    use Notifiable;

    private const ROUTE_APPROVALS = '/dashboard/approvals';

    public function index(Request $request)
    {
        $query = Permit::with('user');
        $user = $request->user();

        // Load role relation to ensure is_manager works
        if (! $user->relationLoaded('role')) {
            $user->load('role');
        }

        if ($user->role_id === 1) {
            // Master Admin sees all
        } elseif ($user->is_manager || $user->hasPermission('approve-leaves')) {
            $query->where('company_id', $user->company_id);

            // If strictly a manager/supervisor (not HRD/Admin), see only subordinates
            if (! $user->hasPermission('approve-leaves') && in_array($user->role->name, ['Manager', 'Supervisor'])) {
                $subordinateIds = User::where('supervisor_id', $user->id)->pluck('id');
                $query->whereIn('user_id', $subordinateIds);
            }
        } else {
            $query->where('user_id', $user->id)
                ->where('company_id', $user->company_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $permits = $query->orderBy('id', 'desc')->paginate(10);

        return response()->json([
            'status' => 'success',
            'message' => 'Data perizinan berhasil diambil.',
            'data' => $permits,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date'   => 'nullable|date|after_or_equal:start_date',
            'type'       => 'required|string',
            'category'   => 'required|string|in:I,S,L', // Karyawan tidak bisa pilih A
            'reason'     => 'nullable|string',
            'signature'  => 'required|string',           // Base64 signature
        ]);

        $user      = $request->user();
        $companyId = $user->company_id;

        [$category, $isDeducted] = $this->resolveCategoryAndDeduction($request);

        $categoryLabels = ['I' => 'Izin', 'A' => 'Alpha/Mangkir', 'S' => 'Sakit', 'L' => 'Lainnya'];
        $categoryLabel  = $categoryLabels[$category] ?? $category;
        $alphaNote      = $category === 'A' ? ' ⚠️ Otomatis dikategorikan Alpha (pengajuan setelah jam 13:00).' : '';

        $workflowResult = ApprovalService::initApproval('permit', $companyId, $user);

        $permit = $this->createPermitRecord($request, $user, $companyId, $category, $isDeducted, $workflowResult);

        if ($workflowResult) {
            $this->notifyDynamicWorkflow($user, $request, $categoryLabel, $alphaNote, $workflowResult);
        } else {
            $this->notifyFallbackWorkflow($user, $request, $companyId, $categoryLabel, $alphaNote);
        }

        return $this->successResponse($permit, 'Permohonan izin berhasil diajukan.', 201);
    }

    /**
     * Determine the final category and whether salary should be deducted.
     */
    private function resolveCategoryAndDeduction(Request $request): array
    {
        $category   = $request->category;
        $isDeducted = false;

        // Auto-Alpha: izin diajukan setelah jam 13:00 untuk hari ini
        $now       = Carbon::now();
        $startDate = Carbon::parse($request->start_date);
        if ($startDate->isToday() && $now->hour >= 13) {
            return ['A', true];
        }

        // Sakit tanpa surat dokter → potong gaji (HRD bisa override saat approve)
        if ($category === 'S') {
            $isDeducted = true;
        }

        return [$category, $isDeducted];
    }

    /**
     * Create and persist the Permit record.
     */
    private function createPermitRecord(
        Request $request,
        $user,
        int $companyId,
        string $category,
        bool $isDeducted,
        ?array $workflowResult
    ): Permit {
        $data = [
            'user_id'              => $user->id,
            'company_id'           => $companyId,
            'start_date'           => $request->start_date,
            'end_date'             => $request->end_date,
            'type'                 => $request->type,
            'category'             => $category,
            'has_doctor_note'      => false,
            'is_deducted'          => $isDeducted,
            'reason'               => $request->reason,
            'signature'            => $request->signature,
            'status'               => $workflowResult ? $workflowResult['status'] : 'pending',
            'current_approval_step'=> $workflowResult ? $workflowResult['current_approval_step'] : null,
        ];

        return Permit::create($data);
    }

    /**
     * Send notifications when a dynamic workflow is active.
     */
    private function notifyDynamicWorkflow($user, Request $request, string $categoryLabel, string $alphaNote, array $workflowResult): void
    {
        $this->notify(
            $user,
            'PENGAJUAN IZIN BERHASIL',
            "Permohonan izin [{$categoryLabel}] ({$request->type}) Anda telah diajukan. Menunggu: {$workflowResult['step_label']}.{$alphaNote}",
            'info'
        );

        foreach ($workflowResult['approvers'] as $approver) {
            $this->notify(
                $approver,
                'PENGAJUAN IZIN PERLU PERSETUJUAN',
                "{$user->name} telah mengajukan izin [{$categoryLabel}] ({$request->type}) pada {$request->start_date}. Mohon segera tinjau.",
                'warning',
                self::ROUTE_APPROVALS
            );
        }
    }

    /**
     * Send notifications when using the hardcoded fallback workflow.
     */
    private function notifyFallbackWorkflow($user, Request $request, int $companyId, string $categoryLabel, string $alphaNote): void
    {
        $this->notify(
            $user,
            'PENGAJUAN IZIN BERHASIL',
            "Permohonan izin [{$categoryLabel}] ({$request->type}) Anda telah diajukan dan sedang menunggu persetujuan.{$alphaNote}",
            'info'
        );

        if ($user->supervisor_id && $user->supervisor) {
            $this->notify(
                $user->supervisor,
                'PENGAJUAN IZIN PERLU PERSETUJUAN',
                "{$user->name} telah mengajukan izin [{$categoryLabel}] ({$request->type}) pada {$request->start_date}. Mohon segera tinjau.",
                'warning',
                self::ROUTE_APPROVALS
            );
            return;
        }

        // No supervisor → notify HRD/Admin directly
        $hrds = User::where('company_id', $companyId)
            ->where('id', '!=', $user->id)
            ->whereHas('role', fn ($q) => $q->where('name', 'HRD')->orWhere('name', 'Admin'))
            ->get();

        foreach ($hrds as $hrd) {
            $this->notify(
                $hrd,
                'PENGAJUAN IZIN BARU (HRD)',
                "{$user->name} telah mengajukan izin [{$categoryLabel}] ({$request->type}) pada {$request->start_date}. Karyawan tidak memiliki Supervisor, mohon segera tinjau.",
                'warning',
                self::ROUTE_APPROVALS
            );
        }
    }

    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $permit = Permit::where(function ($q) use ($user) {
            if ($user->role_id !== 1) {
                $q->where('company_id', $user->company_id);
            }
        })->findOrFail($id);

        // ── HRD/Admin Override: kategori, surat dokter, potongan ──
        $overrideData = [];
        if ($request->has('category') && in_array($request->category, ['I', 'A', 'S', 'L'])) {
            $overrideData['category'] = $request->category;
        }
        if ($request->has('has_doctor_note')) {
            $overrideData['has_doctor_note'] = (bool) $request->has_doctor_note;
        }

        // Recalculate is_deducted based on final category & doctor note
        $finalCategory = $overrideData['category'] ?? $permit->category;
        $finalDoctorNote = $overrideData['has_doctor_note'] ?? $permit->has_doctor_note;

        if ($finalCategory === 'A') {
            $overrideData['is_deducted'] = true;  // Alpha selalu potong
        } elseif ($finalCategory === 'S') {
            $overrideData['is_deducted'] = !$finalDoctorNote;  // Sakit + surat = tidak potong
        } elseif ($finalCategory === 'I') {
            $overrideData['is_deducted'] = false;  // Izin biasa tidak potong
        } else {
            $overrideData['is_deducted'] = false;  // Lainnya tidak potong
        }

        // ── Dynamic Workflow Path ──
        if ($permit->current_approval_step !== null) {
            $result = ApprovalService::processApproval(
                'permit', $permit->company_id, $user, $permit->user, $permit->current_approval_step, 'approve'
            );

            if ($result === null) {
                return $this->errorResponse('Workflow tidak ditemukan.', 400);
            }
            if (isset($result['error'])) {
                return $this->errorResponse($result['error'], 403);
            }

            $updateData = array_merge($overrideData, [
                'status' => $result['status'],
                'current_approval_step' => $result['current_approval_step'],
            ]);

            if ($result['is_final'] && $result['status'] === 'approved') {
                $updateData['approved_by'] = $user->id;
                $updateData['remark'] = $request->remark;
            }

            $permit->update($updateData);

            if ($result['is_final'] && $result['status'] === 'approved') {
                $this->notify(
                    $permit->user,
                    'IZIN DISETUJUI',
                    "Permohonan izin ({$permit->type}) Anda untuk tanggal {$permit->start_date} telah DISETUJUI.",
                    'success'
                );
                FCMService::sendNotification($permit->user, 'Permohonan Izin Disetujui', 'Izin Anda telah DISETUJUI.');

                return $this->successResponse(null, 'Permohonan izin disetujui.');
            }

            // Notify next step
            if (isset($result['approvers'])) {
                foreach ($result['approvers'] as $nextApprover) {
                    $this->notify($nextApprover, 'IZIN MENUNGGU PERSETUJUAN', "Pengajuan izin {$permit->user->name} menunggu persetujuan Anda. Tahap: {$result['step_label']}.", 'warning', '/dashboard/approvals');
                }
            }
            $this->notify($permit->user, 'IZIN DALAM PROSES', "Pengajuan izin Anda telah disetujui di tahap sebelumnya. Menunggu: {$result['step_label']}.", 'info');

            return $this->successResponse(null, "Di-approve. Menunggu: {$result['step_label']}.");
        }

        // ── Fallback: Default logic (Supervisor → HRD flow) ──
        $isSupervisor = $permit->user->supervisor_id === $user->id;
        $isHR = $user->hasPermission('approve-permits') || $user->hasPermission('approve-leaves') || $user->role_id === 1;

        // Check if user has HRD/Admin role
        if (! $isHR && $user->role) {
            $isHR = in_array($user->role->name, ['HRD', 'Admin', 'Super Admin']);
        }

        if ($permit->status === 'pending' && $isSupervisor && ! $isHR) {
            // Supervisor approves → forward to HRD
            $permit->update(array_merge($overrideData, [
                'status' => 'pending_hr',
                'supervisor_approved_by' => $user->id,
                'supervisor_approved_at' => now(),
                'supervisor_remark' => $request->remark,
            ]));

            $this->notify(
                $permit->user,
                'IZIN DI-APPROVE ATASAN',
                "Izin ({$permit->type}) Anda telah disetujui oleh atasan. Menunggu persetujuan HRD.",
                'info'
            );

            // Notify HRD/Admin
            $hrds = User::where('company_id', $permit->company_id)
                ->whereHas('role', function ($q) {
                    $q->where('name', 'HRD')->orWhere('name', 'Admin');
                })
                ->get();
            foreach ($hrds as $hrd) {
                $this->notify(
                    $hrd,
                    'IZIN MENUNGGU PERSETUJUAN HRD',
                    "Izin {$permit->user->name} ({$permit->type}) telah disetujui Supervisor. Mohon segera proses.",
                    'warning',
                    '/dashboard/approvals'
                );
            }

            return $this->successResponse(null, 'Di-approve oleh atasan. Menunggu proses HRD.');
        }

        // HRD/Admin or no-supervisor flow → directly approve
        $permit->update(array_merge($overrideData, [
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'remark' => $request->remark,
        ]));

        $this->notify(
            $permit->user,
            'IZIN DISETUJUI',
            "Permohonan izin ({$permit->type}) Anda untuk tanggal {$permit->start_date} telah DISETUJUI.",
            'success'
        );

        FCMService::sendNotification(
            $permit->user,
            'Permohonan Izin Disetujui',
            'Izin Anda telah DISETUJUI.'
        );

        return $this->successResponse(null, 'Permohonan izin disetujui.');

    }

    public function reject(Request $request, $id)
    {
        $user = $request->user();
        $permit = Permit::findOrFail($id);

        // ── Dynamic Workflow Path ──
        if ($permit->current_approval_step !== null) {
            $result = ApprovalService::processApproval(
                'permit', $permit->company_id, $user, $permit->user, $permit->current_approval_step, 'reject'
            );

            if ($result === null) {
                return $this->errorResponse('Workflow tidak ditemukan.', 400);
            }
            if (isset($result['error'])) {
                return $this->errorResponse($result['error'], 403);
            }

            $permit->update([
                'status' => 'rejected',
                'current_approval_step' => null,
                'approved_by' => $user->id,
                'remark' => $request->remark,
            ]);

            $this->notify($permit->user, 'IZIN DITOLAK', "Mohon maaf, permohonan izin ({$permit->type}) Anda telah DITOLAK.", 'danger');
            FCMService::sendNotification($permit->user, 'Permohonan Izin Ditolak', 'Mohon maaf, izin Anda DITOLAK.');

            return $this->successResponse(null, 'Permohonan izin ditolak.');
        }

        // ── Fallback: Default logic ──
        $permit->update([
            'status' => 'rejected',
            'approved_by' => $request->user()->id,
            'remark' => $request->remark,
        ]);

        $this->notify(
            $permit->user,
            'IZIN DITOLAK',
            "Mohon maaf, permohonan izin ({$permit->type}) Anda telah DITOLAK.",
            'danger'
        );

        FCMService::sendNotification(
            $permit->user,
            'Permohonan Izin Ditolak',
            'Mohon maaf, izin Anda DITOLAK.'
        );

        return $this->successResponse(null, 'Permohonan izin ditolak.');
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $permit = Permit::where(function ($q) use ($user) {
            if ($user->role_id !== 1) {
                $q->where('company_id', $user->company_id);
            }
        })->findOrFail($id);

        if ($permit->status !== 'pending' && $user->role_id !== 1) {
            return $this->errorResponse('Izin yang sudah diproses tidak bisa dihapus.', 403);
        }

        $permit->delete();

        return $this->successResponse(null, 'Izin berhasil dihapus.');
    }
}
