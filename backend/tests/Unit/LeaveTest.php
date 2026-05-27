<?php

namespace Tests\Unit;

use App\Models\Leave;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaveTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function test_leave_can_be_created()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $leave = Leave::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-03',
            'type' => 'annual',
            'reason' => 'Family vacation',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('leaves', [
            'user_id' => $user->id,
            'type' => 'annual',
            'status' => 'pending',
        ]);
    }

    /** @test */
    public function test_leave_belongs_to_user()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $leave = Leave::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-03',
            'type' => 'sick',
            'reason' => 'Flu',
            'status' => 'pending',
        ]);

        $this->assertEquals($user->id, $leave->user->id);
    }

    /** @test */
    public function test_leave_status_can_be_updated()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $leave = Leave::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-02',
            'type' => 'annual',
            'reason' => 'Trip',
            'status' => 'pending',
        ]);

        $leave->update(['status' => 'approved']);
        $this->assertEquals('approved', $leave->fresh()->status);
    }

    /** @test */
    public function test_leave_can_have_supervisor_approver()
    {
        $company = Company::create(['name' => 'Test Co']);
        $supervisor = User::factory()->create(['company_id' => $company->id]);
        $user = User::factory()->create(['company_id' => $company->id]);

        $leave = Leave::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-02',
            'type' => 'annual',
            'reason' => 'Personal',
            'status' => 'approved',
            'supervisor_approved_by' => $supervisor->id,
        ]);

        $this->assertEquals($supervisor->id, $leave->supervisorApprover->id);
    }
}
