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
            $perm = Permission::firstOrCreate(
                ['slug' => 'approve-payroll'],
                ['name' => 'Setujui Payroll', 'group' => 'Payroll']
            );

            // Grant to Super Admin and executive leadership roles if they exist
            $roles = Role::whereIn('name', ['Super Admin', 'Direktur', 'CEO', 'HRD Manager'])->get();
            foreach ($roles as $role) {
                if (! $role->permissions()->where('permissions.id', $perm->id)->exists()) {
                    $role->permissions()->attach($perm->id);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('permissions')) {
            $perm = Permission::where('slug', 'approve-payroll')->first();
            if ($perm) {
                $perm->roles()->detach();
                $perm->delete();
            }
        }
    }
};
