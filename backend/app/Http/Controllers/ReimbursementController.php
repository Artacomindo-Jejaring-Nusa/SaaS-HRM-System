<?php

namespace App\Http\Controllers;

use App\Models\Reimbursement;
use App\Models\User;
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
        $request->validate([
            'title' => 'required|string',
            'amount' => 'required|numeric',
            'description' => 'required|string',
            'attachments' => 'nullable|array',
            'attachments.*' => 'image|max:10240',
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

        $reimbursement = Reimbursement::create([
            'company_id' => $request->user()->company_id,
            'user_id' => $request->user()->id,
            'title' => $request->title,
            'amount' => $request->amount,
            'description' => $request->description,
            'attachment' => $paths,
            'status' => 'pending',
        ]);

        // 1. Notify the Submitting User (Confirmation)
        $this->notify(
            $request->user(),
            'PENGAJUAN REIMBURSEMENT',
            "Klaim reimbursement Anda '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.').' telah diajukan.',
            'info',
            self::URL_DASHBOARD_REIMBURSEMENTS
        );

        // 2. Notify User's Supervisor
        if ($request->user()->supervisor_id) {
            $supervisor = $request->user()->supervisor;
            if ($supervisor) {
                $this->notify(
                    $supervisor,
                    'KLAIM REIMBURSEMENT BAWAHAN',
                    "Karyawan {$request->user()->name} mengajukan klaim '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.').'. Mohon segera tinjau.',
                    'warning',
                    '/dashboard/approvals'
                );
            }
        }

        // 3. Notify Admins/Approvers/Finance in the same company
        // Approver roles: Super Admin (7), HRD (2), Finance (10), HRD Manager (8)
        $admins = User::where('company_id', $request->user()->company_id)
            ->whereIn('role_id', [7, 2, 10, 8])
            ->where('id', '!=', $request->user()->id)
            ->where('id', '!=', $request->user()->supervisor_id) // Don't notify twice
            ->get();

        foreach ($admins as $admin) {
            $this->notify(
                $admin,
                'KLAIM REIMBURSEMENT BARU (ADMIN)',
                "Karyawan {$request->user()->name} mengajukan klaim '{$request->title}' sebesar Rp ".number_format($request->amount, 0, ',', '.').'.',
                'warning',
                '/dashboard/approvals'
            );
        }

        $this->logActivity('SUBMIT_REIMBURSEMENT', "Mengajukan reimbursement '{$request->title}' senilai Rp ".number_format($request->amount, 0, ',', '.'), $reimbursement);

        return $this->successResponse($reimbursement, 'Klaim berhasil diajukan.', 201);
    }

    public function approve(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('approve-reimbursements'), 403, self::MSG_FORBIDDEN);
        $reimbursement = Reimbursement::findOrFail($id);

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
        abort_if(! $request->user()->hasPermission('approve-reimbursements'), 403, self::MSG_FORBIDDEN);
        $reimbursement = Reimbursement::findOrFail($id);

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
