<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('permissions')) {
            $overtimePermissions = [
                ['name' => 'Tugaskan Lembur', 'slug' => 'assign-overtimes', 'group' => 'Lembur'],
                ['name' => 'Kelola Lembur', 'slug' => 'manage-overtimes', 'group' => 'Lembur'],
            ];

            $createdIds = [];
            foreach ($overtimePermissions as $p) {
                $perm = Permission::firstOrCreate(
                    ['slug' => $p['slug']],
                    ['name' => $p['name'], 'group' => $p['group']]
                );
                $createdIds[] = $perm->id;
            }

            // Grant to Super Admin
            $superAdmins = Role::where('name', 'Super Admin')->orWhere('id', 1)->get();
            foreach ($superAdmins as $admin) {
                $admin->permissions()->syncWithoutDetaching($createdIds);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('permissions')) {
            $perms = Permission::whereIn('slug', ['assign-overtimes', 'manage-overtimes'])->get();
            foreach ($perms as $perm) {
                $perm->roles()->detach();
                $perm->delete();
            }
        }
    }
};
