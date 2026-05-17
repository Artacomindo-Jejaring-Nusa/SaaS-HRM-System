<?php

namespace App\Http\Controllers;

use App\Models\Permit;
use App\Models\User;
use App\Services\FCMService;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class PermitController extends Controller
{
    use Notifiable;

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
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'type' => 'required|string',
            'reason' => 'nullable|string',
            'signature' => 'required|string', // Base64 signature
        ]);

        $permit = Permit::create([
            'user_id' => $request->user()->id,
            'company_id' => $request->user()->company_id,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'type' => $request->type,
            'reason' => $request->reason,
            'signature' => $request->signature,
            'status' => 'pending',
        ]);

        $this->notify(
            $request->user(),
            'PENGAJUAN IZIN BERHASIL',
            "Permohonan izin ({$request->type}) Anda telah diajukan dan sedang menunggu persetujuan.",
            'info'
        );

        // Notify Admins
        $admins = User::where('company_id', $request->user()->company_id)
            ->where(function ($q) {
                // Anyone who is Admin OR has manager rights (like HR)
                $q->where('role_id', '>', 1)
                    ->whereHas('role', function ($q2) {
                        $q2->where('name', 'HRD')->orWhere('name', 'Admin');
                    });
            })
            ->get();

        foreach ($admins as $admin) {
            $this->notify(
                $admin,
                'PENGAJUAN IZIN BARU (ADMIN)',
                "{$request->user()->name} telah mengajukan izin ({$request->type}) pada {$request->start_date}.",
                'warning'
            );
        }

        return $this->successResponse($permit, 'Permohonan izin berhasil diajukan.', 201);
    }

    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $permit = Permit::where(function ($q) use ($user) {
            if ($user->role_id !== 1) {
                $q->where('company_id', $user->company_id);
            }
        })->findOrFail($id);

        $permit->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'remark' => $request->remark,
        ]);

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
        $permit = Permit::findOrFail($id);

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
