<?php

namespace App\Http\Controllers;

use App\Models\FundRequest;
use App\Models\User;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Laravel\Facades\Image;

class FundRequestController extends Controller
{
    use Notifiable;

    private const ROLE_HRD_MANAGER = 'HRD Manager';

    public function index(Request $request)
    {
        $query = FundRequest::with(['user', 'supervisor', 'hrd']);
        $user = $request->user();

        if ($user->role_id === 1) {
            // Master Admin sees all
        } elseif ($user->is_manager || $user->hasPermission('approve-permits')) {
            $query->where('company_id', $user->company_id);

            // If strictly a manager/supervisor (not HRD/Admin), see only subordinates OR assigned approvals
            $roleName = $user->role ? $user->role->name : '';
            if (! in_array($roleName, ['HRD', self::ROLE_HRD_MANAGER, 'Admin', 'Super Admin'])) {
                $query->where(function ($q) use ($user) {
                    $q->where('supervisor_id', $user->id)
                        ->orWhere('user_id', $user->id)
                        ->orWhereHas('user', function ($qu) use ($user) {
                            $qu->where('supervisor_id', $user->id);
                        });
                });
            }
        } else {
            $query->where('user_id', $user->id);
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        $requests = $query->orderBy('id', 'desc')->paginate(15);

        return response()->json([
            'status' => 'success',
            'data' => $requests,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:1',
            'reason' => 'required|string',
            'attachment' => 'nullable|string', // Base64
        ]);

        $user = $request->user();

        $attachmentPath = null;
        if ($request->attachment) {
            $imageName = 'fund_requests/'.$user->id.'_'.time().'.jpg';
            $img = Image::decode($request->attachment);
            $img->scale(width: 800);
            Storage::disk('public')->put($imageName, (string) $img->encodeUsingFileExtension('jpg', 80));
            $attachmentPath = $imageName;
        }

        $fundRequest = FundRequest::create([
            'company_id' => $user->company_id,
            'user_id' => $user->id,
            'amount' => $request->amount,
            'reason' => $request->reason,
            'attachment' => $attachmentPath,
            'status' => 'pending',
            'supervisor_id' => $user->supervisor_id,
        ]);

        // Notify Supervisor
        if ($user->supervisor_id) {
            $supervisor = User::find($user->supervisor_id);
            if ($supervisor) {
                $this->notify(
                    $supervisor,
                    'PENGAJUAN DANA BARU',
                    "{$user->name} mengajukan dana sebesar Rp ".number_format($request->amount, 0, ',', '.').'. Mohon tinjau.',
                    'warning',
                    '/dashboard/approvals'
                );
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Pengajuan dana berhasil dikirim.',
            'data' => $fundRequest,
        ], 201);
    }

    public function show($id)
    {
        $request = FundRequest::with(['user', 'supervisor', 'hrd'])->findOrFail($id);

        return response()->json(['status' => 'success', 'data' => $request]);
    }

    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $fundRequest = FundRequest::findOrFail($id);

        $isSupervisor = $fundRequest->user->supervisor_id === $user->id;
        $isHR = $user->hasPermission('approve-permits') || in_array($user->role->name, ['HRD', self::ROLE_HRD_MANAGER, 'Admin', 'Super Admin']);

        if ($fundRequest->status === 'pending') {
            if (! $isSupervisor && ! $isHR) {
                return response()->json(['status' => 'error', 'message' => 'Anda tidak memiliki akses untuk menyetujui tahap ini.'], 403);
            }

            // Supervisor Approval (Step 1)
            $fundRequest->update([
                'status' => 'approved_by_supervisor',
                'supervisor_id' => $user->id,
                'supervisor_approved_at' => now(),
            ]);

            // Notify HRD
            $hrds = User::where('company_id', $user->company_id)
                ->whereHas('role', function ($q) {
                    $q->where('name', 'HRD')->orWhere('name', self::ROLE_HRD_MANAGER)->orWhere('name', 'Admin');
                })->get();

            foreach ($hrds as $hrd) {
                $this->notify(
                    $hrd,
                    'PERSETUJUAN DANA (TAHAP HRD)',
                    "Pengajuan dana {$fundRequest->user->name} telah disetujui Supervisor. Menunggu persetujuan akhir Anda.",
                    'warning',
                    '/dashboard/approvals'
                );
            }

            return response()->json(['status' => 'success', 'message' => 'Disetujui oleh Supervisor. Menunggu persetujuan HRD.']);

        } elseif ($fundRequest->status === 'approved_by_supervisor') {
            if (! $isHR) {
                return response()->json(['status' => 'error', 'message' => 'Hanya HRD yang dapat memberikan persetujuan akhir.'], 403);
            }

            // HRD Approval (Final Step)
            $fundRequest->update([
                'status' => 'approved',
                'hrd_id' => $user->id,
                'hrd_approved_at' => now(),
            ]);

            $this->notify(
                $fundRequest->user,
                'PENGAJUAN DANA DISETUJUI',
                'Pengajuan dana Anda sebesar Rp '.number_format($fundRequest->amount, 0, ',', '.').' telah DISETUJUI sepenuhnya.',
                'success'
            );

            return response()->json(['status' => 'success', 'message' => 'Pengajuan dana telah disetujui sepenuhnya.']);
        }

        return response()->json(['status' => 'error', 'message' => 'Status pengajuan tidak valid.'], 400);
    }

    public function reject(Request $request, $id)
    {
        $request->validate(['reject_reason' => 'required|string']);

        $user = $request->user();
        $fundRequest = FundRequest::findOrFail($id);

        $fundRequest->update([
            'status' => 'rejected',
            'rejected_at' => now(),
            'reject_reason' => $request->reject_reason,
        ]);

        $this->notify(
            $fundRequest->user,
            'PENGAJUAN DANA DITOLAK',
            "Pengajuan dana Anda telah DITOLAK. Alasan: {$request->reject_reason}",
            'danger'
        );

        return response()->json(['status' => 'success', 'message' => 'Pengajuan dana ditolak.']);
    }

    public function destroy($id)
    {
        $fundRequest = FundRequest::findOrFail($id);
        if ($fundRequest->status !== 'pending') {
            return response()->json(['status' => 'error', 'message' => 'Pengajuan yang sudah diproses tidak dapat dihapus.'], 403);
        }
        $fundRequest->delete();

        return response()->json(['status' => 'success', 'message' => 'Pengajuan berhasil dihapus.']);
    }
}
