<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function index()
    {
        $roles = Role::withCount('users')->orderBy('id', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $roles,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|unique:roles,name',
        ]);

        $role = Role::create(['name' => $request->name]);

        return response()->json([
            'success' => true,
            'message' => 'Role berhasil dibuat',
            'data' => $role,
        ]);
    }

    public function show($id)
    {
        $role = Role::with('permissions')->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $role,
        ]);
    }

    public function update(Request $request, $id)
    {
        $role = Role::findOrFail($id);

        $request->validate([
            'name' => 'required|unique:roles,name,'.$id,
        ]);

        $role->update(['name' => $request->name]);

        return response()->json([
            'success' => true,
            'message' => 'Role berhasil diupdate',
            'data' => $role,
        ]);
    }

    public function destroy($id)
    {
        $role = Role::findOrFail($id);

        if ((int) $id === 1 || $role->name === 'Super Admin') {
            return response()->json([
                'success' => false,
                'message' => 'Role bawaan Super Admin tidak dapat dihapus',
            ], 403);
        }

        if ($role->users()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Role tidak bisa dihapus karena masih digunakan oleh pegawai',
            ], 422);
        }

        $role->delete();

        return response()->json([
            'success' => true,
            'message' => 'Role berhasil dihapus',
        ]);
    }

    public const SUPERADMIN_ONLY_PERMISSIONS = [
        'create-employees',
        'edit-employees',
        'delete-employees',
        'manage-company',
        'manage-roles',
        'manage-wfh',
        'manage-offices',
        'view-directory',
        'manage-shifts',
        'manage-schedules',
        'manage-holidays',
        'manage-announcements',
        'manage-approvals',
        'manage-documents',
        'manage-kpis',
    ];

    public function permissions()
    {
        $permissions = Permission::whereNotIn('slug', self::SUPERADMIN_ONLY_PERMISSIONS)
            ->get()
            ->groupBy('group');

        return response()->json([
            'success' => true,
            'data' => $permissions,
        ]);
    }

    public function syncPermissions(Request $request, $id)
    {
        $role = Role::findOrFail($id);
        $request->validate([
            'permissions' => 'present|array',
        ]);

        $permissions = $request->permissions ?? [];

        // If not Super Admin role, strictly exclude superadmin-only permissions
        if ((int) $id !== 1 && $role->name !== 'Super Admin') {
            $superAdminOnlyIds = Permission::whereIn('slug', self::SUPERADMIN_ONLY_PERMISSIONS)
                ->pluck('id')
                ->toArray();
            $permissions = array_values(array_diff($permissions, $superAdminOnlyIds));
        }

        $role->permissions()->sync($permissions);

        return response()->json([
            'success' => true,
            'message' => 'Hak akses berhasil diperbarui',
        ]);
    }
}
