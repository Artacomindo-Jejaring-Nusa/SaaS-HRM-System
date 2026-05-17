<?php

namespace App\Http\Controllers;

use App\Exports\AttendanceCorrectionExport;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\User;
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

        $correction = AttendanceCorrection::create([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
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
        $adminQuery = User::where('company_id', $user->company_id)
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

        return $this->successResponse($correction, 'Pengajuan koreksi absen berhasil diajukan.', 201);
    }

    /**
     * Approve a correction request (HR/Supervisor only).
     */
    public function approve(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('approve-leaves'), 403, 'Akses ditolak.');

        $correction = AttendanceCorrection::with('attendance')->findOrFail($id);

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
     * Reject a correction request (HR/Supervisor only).
     */
    public function reject(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('approve-leaves'), 403, 'Akses ditolak.');

        $correction = AttendanceCorrection::with('attendance')->findOrFail($id);

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
