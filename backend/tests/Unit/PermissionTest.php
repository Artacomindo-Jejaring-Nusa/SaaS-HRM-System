<?php

namespace Tests\Unit;

use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PermissionTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function test_a_user_with_role_can_check_permission()
    {
        $company = Company::create(['name' => 'Test Co']);
        $role = Role::create(['name' => 'Test Admin']);
        $permission = Permission::create(['name' => 'View Test', 'slug' => 'view-test', 'group' => 'Test']);

        $role->permissions()->attach($permission->id);

        $user = User::factory()->create([
            'role_id' => $role->id,
            'company_id' => $company->id,
        ]);

        $this->assertTrue($user->hasPermission('view-test'));
    }
}
