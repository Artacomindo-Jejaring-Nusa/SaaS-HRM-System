<?php

namespace App\Traits;

use App\Models\Leave;
use App\Models\User;
use Illuminate\Http\Request;

trait HandlesLeaveCreation
{
    private function validateLeaveRequest(Request $request, ?array $typeMeta, int $requestedDays): ?string
    {
        if ($typeMeta && isset($typeMeta['days']) && $typeMeta['days'] > 0 && $requestedDays > $typeMeta['days']) {
            return "Durasi cuti {$request->type} melebihi batas maksimal UU Ketenagakerjaan ({$typeMeta['days']} hari).";
        }

        return null;
    }

    private function handleDynamicWorkflowLeave(array $leaveAttributes, array $workflowResult, User $user, Request $request): Leave
    {
        $leaveAttributes['status'] = $workflowResult['status'];
        $leaveAttributes['current_approval_step'] = $workflowResult['current_approval_step'];

        if (! empty($workflowResult['auto_approved'])) {
            $leaveAttributes['remark'] = 'Disetujui otomatis (Alur persetujuan dinonaktifkan)';
        }

        $leave = Leave::create($leaveAttributes);

        if (! empty($workflowResult['auto_approved'])) {
            self::processLeaveApprovalDeduction();
            $this->notify(
                $user,
                'Pengajuan Cuti Disetujui Otomatis',
                "Halo, permohonan cuti Anda ({$request->type}) untuk tanggal {$request->start_date} s/d {$request->end_date} telah DISETUJUI OTOMATIS karena alur persetujuan dinonaktifkan.",
                'success'
            );
        } else {
            $this->notify(
                $user,
                'Pengajuan Cuti Berhasil',
                "Halo, permohonan cuti Anda ({$request->type}) untuk tanggal {$request->start_date} s/d {$request->end_date} telah berhasil diajukan. Status: Menunggu {$workflowResult['step_label']}.",
                'info'
            );

            foreach ($workflowResult['approvers'] as $approver) {
                $this->notify(
                    $approver,
                    'Persetujuan Cuti Karyawan',
                    "Halo Bapak/Ibu, ada permohonan cuti baru dari {$user->name} ({$request->type}) untuk tanggal {$request->start_date} s/d {$request->end_date}. Mohon kesediaannya untuk meninjau pengajuan ini. Terima kasih.",
                    'warning',
                    self::ROUTE_APPROVALS
                );
            }
        }

        return $leave;
    }

    private function handleFallbackLeave(array $leaveAttributes, User $user, Request $request, int $companyId): Leave
    {
        $status = $user->supervisor_id ? 'pending_supervisor' : 'pending_hr';
        $leaveAttributes['status'] = $status;

        $leave = Leave::create($leaveAttributes);

        $this->notify(
            $user,
            'Pengajuan Cuti Berhasil',
            "Halo, permohonan cuti Anda ({$request->type}) untuk tanggal {$request->start_date} s/d {$request->end_date} telah berhasil diajukan dan saat ini sedang menunggu persetujuan. Terima kasih.",
            'info'
        );

        if ($user->supervisor_id && $user->supervisor) {
            $this->notify(
                $user->supervisor,
                'Persetujuan Cuti Bawahan',
                "Halo Bapak/Ibu, ada permohonan cuti baru dari {$user->name} ({$request->type}) mulai tanggal {$request->start_date}. Mohon kesediaannya untuk meninjau pengajuan ini. Terima kasih.",
                'warning',
                self::ROUTE_APPROVALS
            );
        }

        if (! $user->supervisor_id) {
            $hrds = User::where('company_id', $companyId)
                ->where('id', '!=', $user->id)
                ->whereHrdOrAdmin('approve-leaves')
                ->get();

            foreach ($hrds as $hrd) {
                $this->notify(
                    $hrd,
                    'Pengajuan Cuti Baru (HRD)',
                    "Halo tim HRD, ada permohonan cuti baru dari {$user->name} ({$request->type}) mulai tanggal {$request->start_date}. Dikarenakan karyawan tidak memiliki Supervisor langsung, mohon kesediaannya untuk memeriksa pengajuan ini. Terima kasih.",
                    'warning',
                    self::ROUTE_APPROVALS
                );
            }
        }

        return $leave;
    }
}
