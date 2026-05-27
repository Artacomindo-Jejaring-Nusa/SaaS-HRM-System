<?php

namespace Tests\Unit;

use App\Models\User;
use App\Models\Company;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserTest extends TestCase
{
    private function seedRoles()
    {
        Role::firstOrCreate(['id' => 1], ['name' => 'Super Admin']);
        Role::firstOrCreate(['id' => 2], ['name' => 'Employee']);
    }

    use RefreshDatabase;

    /** @test */
    public function test_user_can_be_created_with_fillable_fields()
    {
        $company = Company::create(['name' => 'Test Company']);
        $user = User::factory()->create([
            'company_id' => $company->id,
            'name' => 'John Doe',
            'email' => 'john@example.com',
        ]);

        $this->assertDatabaseHas('users', [
            'name' => 'John Doe',
            'email' => 'john@example.com',
        ]);
    }

    /** @test */
    public function test_user_belongs_to_company()
    {
        $company = Company::create(['name' => 'Test Company']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $this->assertEquals($company->id, $user->company->id);
    }

    /** @test */
    public function test_user_has_many_attendances()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $this->assertCount(0, $user->attendances);
    }

    /** @test */
    public function test_user_has_many_leaves()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $this->assertCount(0, $user->leaves);
    }

    /** @test */
    public function test_profile_photo_url_returns_null_when_no_photo()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create([
            'company_id' => $company->id,
            'profile_photo_path' => null,
        ]);

        $this->assertNull($user->profile_photo_url);
    }

    /** @test */
    public function test_profile_photo_url_returns_asset_url_when_photo_exists()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create([
            'company_id' => $company->id,
            'profile_photo_path' => 'photos/avatar.jpg',
        ]);

        $this->assertStringContainsString('photos/avatar.jpg', $user->profile_photo_url);
    }

    /** @test */
    public function test_password_is_hidden_in_array()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $this->assertArrayNotHasKey('password', $user->toArray());
    }

    /** @test */
    public function test_master_admin_can_access_all_companies()
    {
        $this->seedRoles();
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create([
            'company_id' => $company->id,
            'role_id' => 1,
        ]);

        $this->assertTrue($user->canAccessAllCompanies());
    }

    /** @test */
    public function test_regular_user_cannot_access_all_companies()
    {
        $this->seedRoles();
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create([
            'company_id' => $company->id,
            'role_id' => 2,
        ]);

        $this->assertFalse($user->canAccessAllCompanies());
    }

    /** @test */
    public function test_user_has_subordinates_relation()
    {
        $company = Company::create(['name' => 'Test Co']);
        $supervisor = User::factory()->create(['company_id' => $company->id]);
        $subordinate = User::factory()->create([
            'company_id' => $company->id,
            'supervisor_id' => $supervisor->id,
        ]);

        $this->assertCount(1, $supervisor->subordinates);
        $this->assertEquals($subordinate->id, $supervisor->subordinates->first()->id);
    }
}
