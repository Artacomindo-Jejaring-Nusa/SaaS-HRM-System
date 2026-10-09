<?php

namespace App\Http\Controllers;

use App\Exports\AttendanceCorrectionExport;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\User;
use App\Services\ApprovalService;
use App\Traits\Notifiable;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class AttendanceCorrectionController extends Controller
{
    use Notifiable;

    /**
     * List corrections: Staff sees own, Manager/Admin sees all company.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = AttendanceCorrection::with(['user', 'approver', 'attendance']);

        if ($user->is_manager) {
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $query->where('company_id', $user->company_id);
            }
        } else {
            $query->where('user_id', $user->id);
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        if ($request->start_date && $request->end_date) {
            $query->whereBetween('created_at', [$request->start_date.' 00:00:00', $request->end_date.' 23:59:59']);
        }

        $corrections = $query->orderBy('id', 'desc')->paginate(10);

        return $this->successResponse($corrections, 'Data koreksi absen berhasil diambil.');
    }

    /**
     * Employee submits a correction request.
     */
    public function store(Request $request)
    {
        $request->validate([
            'attendance_id' => 'required|exists:attendances,id',
            'correction_type' => 'required|in:missing_checkout,wrong_time',
            'corrected_check_out' => 'required_if:correction_type,missing_checkout|nullable|date_format:H:i',
            'corrected_check_in' => 'nullable|date_format:H:i',
            'reason' => 'required|string|max:500',
        ]);

        $user = $request->user();
        $attendance = Attendance::findOrFail($request->attendance_id);

        // Security: User can only correct their own attendance
        if ($attendance->user_id !== $user->id) {
            return $this->errorResponse('Anda tidak berhak mengoreksi absen orang lain.', 403);
        }

        // Prevent duplicate pending correction for the same attendance
        $existing = AttendanceCorrection::where('attendance_id', $attendance->id)
            ->where('status', 'pending')
            ->first();

        if ($existing) {
            return $this->errorResponse('Sudah ada pengajuan koreksi yang menunggu persetujuan untuk absen ini.', 400);
        }

        // Build corrected timestamps (combine attendance date + time from form)
        $attendanceDate = Carbon::parse($attendance->check_in)->toDateString();

        $correctedCheckIn = null;
        if ($request->corrected_check_in) {
            $correctedCheckIn = Carbon::parse($attendanceDate.' '.$request->corrected_check_in);
        }

        $correctedCheckOut = null;
        if ($request->corrected_check_out) {
            $correctedCheckOut = Carbon::parse($attendanceDate.' '.$request->corrected_check_out);
        }

        $companyId = $user->company_id;

        // ── Dynamic Workflow Check ──
        $workflowResult = ApprovalService::initApproval('attendance_correction', $companyId, $user);

        if ($workflowResult) {
            $isAutoApproved = !empty($workflowResult['auto_approved']);
            $correction = AttendanceCorrection::create([
                'user_id' => $user->id,
                'company_id' => $companyId,
                'attendance_id' => $attendance->id,
                'correction_type' => $request->correction_type,
                'corrected_check_in' => $correctedCheckIn,
                'corrected_check_out' => $correctedCheckOut,
                'reason' => $request->reason,
                'status' => $workflowResult['status'],
                'current_approval_step' => $workflowResult['current_approval_step'],
                'approved_by' => $isAutoApproved ? $user->id : null,
                'remark' => $isAutoApproved ? 'Disetujui otomatis (Alur persetujuan dinonaktifkan)' : null,
            ]);

            if ($isAutoApproved) {
                // Apply the correction to the actual attendance record immediately
                $applyData = [];
                if ($correctedCheckIn) {
                    $applyData['check_in'] = $correctedCheckIn;
                }
                if ($correctedCheckOut) {
                    $applyData['check_out'] = $correctedCheckOut;
                }
                $attendance->update($applyData);

                $this->notify(
                    $user,
                    'KOREKSI ABSEN DISETUJUI OTOMATIS',
                    "Pengajuan koreksi absen Anda untuk tanggal {$attendanceDate} telah DISETUJUI OTOMATIS dan absensi Anda telah langsung diperbarui.",
                    'success',
                    '/dashboard/attendance-corrections'
                );
            } else {
                $this->notify(
                    $user,
                    'KOREKSI ABSEN DIAJUKAN',
                    "Pengajuan koreksi absen Anda untuk tanggal {$attendanceDate} telah dikirim. Menunggu: {$workflowResult['step_label']}.",
                    'info',
                    null,
                    'notif',
                    false
                );

                foreach ($workflowResult['approvers'] as $approver) {
                    $this->notify(
                        $approver,
                        'KOREKSI ABSEN PERLU PERSETUJUAN',
                        "{$user->name} mengajukan koreksi absen untuk tanggal {$attendanceDate}. Alasan: {$request->reason}",
                        'warning',
                        '/dashboard/attendance-corrections'
                    );
                }
            }
        } else {
            // ── Fallback: Default logic ──
            $correction = AttendanceCorrection::create([
                'user_id' => $user->id,
                'company_id' => $companyId,
                'attendance_id' => $attendance->id,
                'correction_type' => $request->correction_type,
                'corrected_check_in' => $correctedCheckIn,
                'corrected_check_out' => $correctedCheckOut,
                'reason' => $request->reason,
                'status' => 'pending',
            ]);

            // Notify the employee
            $this->notify(
                $user,
                'KOREKSI ABSEN DIAJUKAN',
                "Pengajuan koreksi absen Anda untuk tanggal {$attendanceDate} telah berhasil dikirim dan menunggu persetujuan.",
                'info',
                null,
                'notif',
                false
            );

            // Notify Supervisor
            if ($user->supervisor_id) {
                $supervisor = User::find($user->supervisor_id);
                if ($supervisor) {
                    $this->notify(
                        $supervisor,
                        'KOREKSI ABSEN BAWAHAN',
                        "{$user->name} mengajukan koreksi absen untuk tanggal {$attendanceDate}. Alasan: {$request->reason}",
                        'warning',
                        '/dashboard/attendance-corrections'
                    );
                }
            }

            // Notify Admins/HR (excluding the submitter and the supervisor if already notified)
            $adminQuery = User::where('company_id', $companyId)
                ->where('role_id', '>', 1)
                ->where('id', '!=', $user->id); // Exclude the user who submitted

            if ($user->supervisor_id) {
                $adminQuery->where('id', '!=', $user->supervisor_id); // Don't double-notify supervisor
            }

            $admins = $adminQuery->get();
            foreach ($admins as $admin) {
                /** @var User $admin */
                $this->notify(
                    $admin,
                    'KOREKSI ABSEN BARU',
                    "{$user->name} mengajukan koreksi absen untuk tanggal {$attendanceDate}.",
                    'warning',
                    '/dashboard/attendance-corrections'
                );
            }
        }

        return $this->successResponse($correction, 'Pengajuan koreksi absen berhasil diajukan.', 201);
    }

    /**
     * Approve a correction request.
     */
    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $correction = AttendanceCorrection::with('attendance')->findOrFail($id);

        // ── Dynamic Workflow Path ──
        if ($correction->current_approval_step !== null) {
            $result = ApprovalService::processApproval(
                'attendance_correction', $correction->company_id, $user, $correction->user, $correction->current_approval_step, 'approve'
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

            $correction->update($updateData);

            if ($result['is_final'] && $result['status'] === 'approved') {
                // Apply the correction to the actual attendance record
                $attendance = $correction->attendance;
                $applyData = [];
                if ($correction->corrected_check_in) {
                    $applyData['check_in'] = $correction->corrected_check_in;
                }
                if ($correction->corrected_check_out) {
                    $applyData['check_out'] = $correction->corrected_check_out;
                }
                if (! empty($applyData)) {
                    $attendance->update($applyData);
                }

                $attendanceDate = Carbon::parse($attendance->check_in)->format('Y-m-d');
                $this->notify(
                    $correction->user,
                    'KOREKSI ABSEN DISETUJUI',
                    "Pengajuan koreksi absen Anda untuk tanggal {$attendanceDate} telah DISETUJUI oleh {$user->name}.",
                    'success'
                );

                return $this->successResponse(null, 'Koreksi absen disetujui dan data absen telah diperbarui.');
            }

            // Notify next step
            if (isset($result['approvers'])) {
                foreach ($result['approvers'] as $nextApprover) {
                    $this->notify($nextApprover, 'KOREKSI ABSEN MENUNGGU PERSETUJUAN', "Koreksi absen {$correction->user->name} menunggu persetujuan Anda. Tahap: {$result['step_label']}.", 'warning', '/dashboard/attendance-corrections');
                }
            }
            $this->notify($correction->user, 'KOREKSI ABSEN DALAM PROSES', "Koreksi absen Anda disetujui di tahap sebelumnya. Menunggu: {$result['step_label']}.", 'info');

            return $this->successResponse(null, "Di-approve. Menunggu: {$result['step_label']}.");
        }

        // ── Fallback: Default logic ──
        abort_if(! $request->user()->hasPermission('approve-leaves'), 403, 'Akses ditolak.');

        if ($correction->status !== 'pending') {
            return $this->errorResponse('Koreksi ini sudah diproses sebelumnya.', 400);
        }

        // Update the correction status
        $correction->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'remark' => $request->remark,
        ]);

        // Apply the correction to the actual attendance record
        $attendance = $correction->attendance;
        $updateData = [];

        if ($correction->corrected_check_in) {
            $updateData['check_in'] = $correction->corrected_check_in;
        }

        if ($correction->corrected_check_out) {
            $updateData['check_out'] = $correction->corrected_check_out;
        }

        if (! empty($updateData)) {
            $attendance->update($updateData);
        }

        // Notify the employee
        $attendanceDate = Carbon::parse($attendance->check_in)->format('Y-m-d');
        $this->notify(
            $correction->user,
            'KOREKSI ABSEN DISETUJUI',
            "Pengajuan koreksi absen Anda untuk tanggal {$attendanceDate} telah DISETUJUI oleh {$request->user()->name}.",
            'success'
        );

        return $this->successResponse(null, 'Koreksi absen disetujui dan data absen telah diperbarui.');
    }

    /**
     * Reject a correction request.
     */
    public function reject(Request $request, $id)
    {
        $user = $request->user();
        $correction = AttendanceCorrection::with('attendance')->findOrFail($id);

        // ── Dynamic Workflow Path ──
        if ($correction->current_approval_step !== null) {
            $result = ApprovalService::processApproval(
                'attendance_correction', $correction->company_id, $user, $correction->user, $correction->current_approval_step, 'reject'
            );

            if ($result === null) {
                return $this->errorResponse('Workflow tidak ditemukan.', 400);
            }
            if (isset($result['error'])) {
                return $this->errorResponse($result['error'], 403);
            }

            $correction->update([
                'status' => 'rejected',
                'current_approval_step' => null,
                'approved_by' => $user->id,
                'remark' => $request->remark,
            ]);

            $attendanceDate = Carbon::parse($correction->attendance->check_in)->format('Y-m-d');
            $this->notify(
                $correction->user,
                'KOREKSI ABSEN DITOLAK',
                "Mohon maaf, pengajuan koreksi absen Anda untuk tanggal {$attendanceDate} telah DITOLAK. ".($request->remark ? "Alasan: {$request->remark}" : ''),
                'danger'
            );

            return $this->successResponse(null, 'Koreksi absen ditolak.');
        }

        // ── Fallback: Default logic ──
        abort_if(! $request->user()->hasPermission('approve-leaves'), 403, 'Akses ditolak.');

        if ($correction->status !== 'pending') {
            return $this->errorResponse('Koreksi ini sudah diproses sebelumnya.', 400);
        }

        $correction->update([
            'status' => 'rejected',
            'approved_by' => $request->user()->id,
            'remark' => $request->remark,
        ]);

        $attendanceDate = Carbon::parse($correction->attendance->check_in)->format('Y-m-d');
        $this->notify(
            $correction->user,
            'KOREKSI ABSEN DITOLAK',
            "Mohon maaf, pengajuan koreksi absen Anda untuk tanggal {$attendanceDate} telah DITOLAK. ".($request->remark ? "Alasan: {$request->remark}" : ''),
            'danger'
        );

        return $this->successResponse(null, 'Koreksi absen ditolak.');
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');

        $correction = AttendanceCorrection::with('attendance')->findOrFail($id);

        if (!$isSuperAdmin && $correction->user_id !== $user->id) {
            return $this->errorResponse('Anda tidak berhak mengubah koreksi absen ini.', 403);
        }

        if (!$isSuperAdmin && $correction->status !== 'pending') {
            return $this->errorResponse('Koreksi absen yang sudah diproses tidak bisa diubah.', 400);
        }

        $request->validate([
            'correction_type' => 'required|in:missing_checkout,wrong_time',
            'corrected_check_out' => 'required_if:correction_type,missing_checkout|nullable|date_format:H:i',
            'corrected_check_in' => 'nullable|date_format:H:i',
            'reason' => 'required|string|max:500',
        ]);

        $attendanceDate = Carbon::parse($correction->attendance->check_in)->toDateString();

        $correctedCheckIn = null;
        if ($request->corrected_check_in) {
            $correctedCheckIn = Carbon::parse($attendanceDate.' '.$request->corrected_check_in);
        }

        $correctedCheckOut = null;
        if ($request->corrected_check_out) {
            $correctedCheckOut = Carbon::parse($attendanceDate.' '.$request->corrected_check_out);
        }

        $oldValues = $correction->only(['correction_type', 'corrected_check_in', 'corrected_check_out', 'reason']);

        $correction->update([
            'correction_type' => $request->correction_type,
            'corrected_check_in' => $correctedCheckIn,
            'corrected_check_out' => $correctedCheckOut,
            'reason' => $request->reason,
        ]);

        $newValues = $correction->only(['correction_type', 'corrected_check_in', 'corrected_check_out', 'reason']);

        $this->logActivity('UPDATE_ATTENDANCE_CORRECTION', "Mengubah koreksi absen #{$correction->id} untuk tanggal {$attendanceDate}", $correction, 'attendance_corrections', $oldValues, $newValues);

        return $this->successResponse($correction, 'Koreksi absen berhasil diperbarui.');
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');

        $correction = AttendanceCorrection::with(['user', 'attendance'])->findOrFail($id);

        if (!$isSuperAdmin && $correction->user_id !== $user->id) {
            return $this->errorResponse('Anda tidak berhak menghapus koreksi absen ini.', 403);
        }

        if (!$isSuperAdmin && $correction->status !== 'pending') {
            return $this->errorResponse('Koreksi absen yang sudah diproses tidak bisa dihapus.', 400);
        }

        $attendanceDate = $correction->attendance ? Carbon::parse($correction->attendance->check_in)->format('Y-m-d') : '-';
        $oldValues = $correction->toArray();

        $this->logActivity('DELETE_ATTENDANCE_CORRECTION', "Menghapus pengajuan koreksi absen #{$correction->id} ({$attendanceDate}) oleh " . ($correction->user?->name ?? 'Karyawan'), $correction, 'attendance_corrections', $oldValues, null);

        $correction->delete();

        return $this->successResponse(null, 'Koreksi absen berhasil dihapus.');
    }

    public function export(Request $request)
    {
        $user = $request->user();
        $fileName = 'correction_report_'.now()->format('Y_m_d_His').'.xlsx';

        return Excel::download(
            new AttendanceCorrectionExport(
                $user->company_id,
                $request->user_id,
                $request->status,
                $request->start_date,
                $request->end_date
            ),
            $fileName
        );
    }
}
