<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\WebAttendanceAuditLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AutoValidationController extends Controller
{
    /**
     * Toggle auto-validation status for a single employee.
     */
    public function toggle(Request $request)
    {
        $admin = $request->user();
        if (!$this->isAuthorizedAdmin($admin)) {
            return $this->errorResponse('Akses ditolak. Fitur Validasi Otomatis hanya untuk Super Admin dan HRD.', 403);
        }

        $request->validate([
            'user_id' => 'required|exists:users,id',
            'auto_validate' => 'required|boolean',
            'expires_at' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
        ]);

        $targetUser = User::where('company_id', $admin->company_id)->findOrFail($request->user_id);

        $prevStatus = (bool) $targetUser->auto_validate_web_attendance;
        $newStatus = (bool) $request->auto_validate;
        $prevExpiry = $targetUser->auto_validate_until;
        $newExpiry = $newStatus && $request->expires_at ? Carbon::parse($request->expires_at) : null;

        $targetUser->update([
            'auto_validate_web_attendance' => $newStatus,
            'auto_validate_until' => $newExpiry,
            'auto_validate_updated_by' => $admin->id,
            'auto_validate_updated_at' => now(),
        ]);

        // Record Audit Log
        WebAttendanceAuditLog::create([
            'user_id' => $targetUser->id,
            'action' => $newStatus ? 'enable' : 'disable',
            'previous_auto_validate' => $prevStatus,
            'new_auto_validate' => $newStatus,
            'previous_expires_at' => $prevExpiry,
            'new_expires_at' => $newExpiry,
            'changed_by' => $admin->id,
            'notes' => $request->notes ?? $this->buildAutoValidateNote($newStatus, $newExpiry),
            'ip_address' => $request->ip(),
        ]);

        return $this->successResponse([
            'user' => $targetUser->fresh(),
            'is_web_auto_validated' => $targetUser->isWebAttendanceAutoValidated(),
        ], 'Status Validasi Otomatis karyawan berhasil diperbarui.');
    }

    /**
     * Bulk update auto-validation status for multiple employees.
     */
    public function bulk(Request $request)
    {
        $admin = $request->user();
        if (!$this->isAuthorizedAdmin($admin)) {
            return $this->errorResponse('Akses ditolak. Fitur Validasi Otomatis hanya untuk Super Admin dan HRD.', 403);
        }

        $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'exists:users,id',
            'auto_validate' => 'required|boolean',
            'expires_at' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
        ]);

        $newStatus = (bool) $request->auto_validate;
        $newExpiry = $newStatus && $request->expires_at ? Carbon::parse($request->expires_at) : null;

        $users = User::where('company_id', $admin->company_id)
            ->whereIn('id', $request->user_ids)
            ->get();

        $updatedCount = 0;
        foreach ($users as $user) {
            $prevStatus = (bool) $user->auto_validate_web_attendance;
            $prevExpiry = $user->auto_validate_until;

            $user->update([
                'auto_validate_web_attendance' => $newStatus,
                'auto_validate_until' => $newExpiry,
                'auto_validate_updated_by' => $admin->id,
                'auto_validate_updated_at' => now(),
            ]);

            WebAttendanceAuditLog::create([
                'user_id' => $user->id,
                'action' => $newStatus ? 'bulk_enable' : 'bulk_disable',
                'previous_auto_validate' => $prevStatus,
                'new_auto_validate' => $newStatus,
                'previous_expires_at' => $prevExpiry,
                'new_expires_at' => $newExpiry,
                'changed_by' => $admin->id,
                'notes' => $request->notes ?? ("Aksi Massal: " . $this->buildAutoValidateNote($newStatus, $newExpiry)),
                'ip_address' => $request->ip(),
            ]);

            $updatedCount++;
        }

        return $this->successResponse([
            'updated_count' => $updatedCount,
        ], "Berhasil memperbarui Validasi Otomatis untuk {$updatedCount} karyawan.");
    }

    /**
     * Get Audit Logs for Auto-Validation changes.
     */
    public function auditLogs(Request $request)
    {
        $admin = $request->user();
        if (!$this->isAuthorizedAdmin($admin)) {
            return $this->errorResponse('Akses ditolak.', 403);
        }

        $query = WebAttendanceAuditLog::with(['user:id,name,email,role_id', 'changer:id,name,email'])
            ->whereHas('user', function ($q) use ($admin) {
                $q->where('company_id', $admin->company_id);
            });

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->action) {
            $query->where('action', $request->action);
        }

        if ($request->start_date && $request->end_date) {
            $query->whereDate('created_at', '>=', $request->start_date)
                ->whereDate('created_at', '<=', $request->end_date);
        }

        $logs = $query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 20);

        return $this->successResponse($logs, 'Jejak audit validasi otomatis berhasil diambil.');
    }

    private function isAuthorizedAdmin(User $user): bool
    {
        return $user->role_id === 1
            || $user->canAccessAllCompanies()
            || $user->hasPermission('manage-roles')
            || $user->hasPermission('manage-company')
            || $user->hasPermission('edit-employees')
            || str_contains(strtolower($user->role?->name ?? ''), 'super admin')
            || str_contains(strtolower($user->role?->name ?? ''), 'hrd');
    }

    private function buildAutoValidateNote(bool $status, ?\Carbon\Carbon $expiry): string
    {
        if (!$status) {
            return 'Dinonaktifkan';
        }

        return $expiry ? "Diaktifkan hingga {$expiry->format('d M Y')}" : 'Diaktifkan permanen';
    }
}
