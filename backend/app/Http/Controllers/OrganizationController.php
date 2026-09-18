<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;

class OrganizationController extends Controller
{
    public function getChart(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        $query = User::with(['role', 'supervisor']);

        if ($companyId && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $companyId);
        } elseif ($request->filled('company_id')) {
            $query->where('company_id', $request->company_id);
        }

        // Ambil semua user di scope tersebut
        $users = $query->get(['id', 'supervisor_id', 'name', 'email', 'role_id', 'profile_photo_path', 'cost_center', 'company_id']);

        // Data processing untuk membentuk flat structure yang siap dijadikan Tree di Frontend
        $mapped = $users->map(function ($u) {
            return [
                'id' => $u->id,
                'supervisor_id' => $u->supervisor_id,
                'name' => $u->name,
                'email' => $u->email,
                'role_id' => $u->role_id,
                'role' => $u->role ? $u->role->name : 'Staff / Member',
                'cost_center' => $u->cost_center,
                'photo' => $u->profile_photo_url,
                'supervisor_name' => $u->supervisor ? $u->supervisor->name : null,
            ];
        });

        $rolesQuery = Role::query();
        if ($companyId && ! $user->canAccessAllCompanies()) {
            $rolesQuery->where(function ($q) use ($companyId) {
                $q->where('company_id', $companyId)->orWhereNull('company_id');
            });
        }
        $roles = $rolesQuery->get(['id', 'name']);

        return $this->successResponse([
            'chart' => $mapped,
            'roles' => $roles,
            'employees' => $users->map(fn($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'role' => $u->role?->name ?? 'Staff / Member'
            ]),
        ], 'Organization chart data retrieved successfully.');
    }

    public function updateNode(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'supervisor_id' => 'nullable|exists:users,id|different:user_id',
            'role_id' => 'nullable|exists:roles,id',
        ]);

        $user = $request->user();
        $query = User::query();
        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        }
        $targetUser = $query->findOrFail($request->user_id);

        if ($request->has('supervisor_id')) {
            $targetUser->supervisor_id = $request->supervisor_id;
        }

        if ($request->has('role_id')) {
            $targetUser->role_id = $request->role_id;
        }

        $targetUser->save();

        return $this->successResponse(
            $targetUser->load(['role', 'supervisor']),
            'Struktur bagan organisasi pegawai berhasil diperbarui.'
        );
    }
}
