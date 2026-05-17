<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProfileRequest;
use App\Models\Role;
use App\Models\User;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class ProfileRequestController extends Controller
{
    use Notifiable;

    public function index(Request $request)
    {
        $requests = ProfileRequest::with('user')->where('status', 'pending')
            ->where('company_id', $request->user()->company_id)
            ->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $requests,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'new_data' => 'required|array',
        ]);

        $changes = $request->new_data;

        $profileRequest = ProfileRequest::create([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'old_data' => $user->only(array_keys($changes)),
            'new_data' => $changes,
            'status' => 'pending',
        ]);

        // Notify user
        $this->notify(
            $user,
            'PENGAJUAN PERUBAHAN PROFIL',
            'Permohonan perubahan data profil Anda sedang menunggu persetujuan admin.',
            'info'
        );

        // Notify Admins and HR
        $adminRoles = Role::whereIn('name', ['Super Admin', 'HRD', 'Manager', 'Management'])->pluck('id');

        $admins = User::where('company_id', $user->company_id)
            ->whereIn('role_id', $adminRoles)
            ->get();

        foreach ($admins as $admin) {
            $this->notify(
                $admin,
                'PERUBAHAN PROFIL BARU',
                "{$user->name} telah mengajukan perubahan data profil sensitif (NIK/Email/Telepon).",
                'warning',
                '/dashboard/profile-requests'
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Permintaan update profil berhasil dikirim dan menunggu persetujuan.',
            'data' => $profileRequest,
        ]);
    }

    public function approve(Request $request, $id)
    {
        $profileRequest = ProfileRequest::findOrFail($id);

        $user = User::findOrFail($profileRequest->user_id);
        $user->update($profileRequest->new_data);

        $profileRequest->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
        ]);

        // Notify user of approval
        $this->notify(
            $user,
            'PERUBAHAN PROFIL DISETUJUI',
            'Permohonan perubahan data profil Anda telah disetujui oleh admin.',
            'success'
        );

        return response()->json([
            'success' => true,
            'message' => 'Update profil disetujui dan data karyawan telah diperbarui.',
        ]);
    }

    public function reject(Request $request, $id)
    {
        $profileRequest = ProfileRequest::findOrFail($id);

        $profileRequest->update([
            'status' => 'rejected',
            'approved_by' => $request->user()->id,
        ]);

        $user = User::findOrFail($profileRequest->user_id);

        // Notify user of rejection
        $this->notify(
            $user,
            'PERUBAHAN PROFIL DITOLAK',
            'Permohonan perubahan data profil Anda ditolak oleh admin.',
            'danger'
        );

        return response()->json([
            'success' => true,
            'message' => 'Update profil ditolak.',
        ]);
    }
}
