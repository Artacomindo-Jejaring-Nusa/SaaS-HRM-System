<?php

namespace Tests\Unit;

use App\Models\Overtime;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OvertimeTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function test_overtime_can_be_created()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $overtime = Overtime::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'date' => '2026-06-01',
            'start_time' => '18:00',
            'end_time' => '21:00',
            'reason' => 'Project deadline',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('overtimes', [
            'user_id' => $user->id,
            'status' => 'pending',
        ]);
    }

    /** @test */
    public function test_overtime_belongs_to_user()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $overtime = Overtime::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'date' => '2026-06-01',
            'start_time' => '18:00',
            'end_time' => '21:00',
            'reason' => 'Urgent work',
            'status' => 'pending',
        ]);

        $this->assertEquals($user->id, $overtime->user->id);
    }

    /** @test */
    public function test_overtime_can_have_approver()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);
        $approver = User::factory()->create(['company_id' => $company->id]);

        $overtime = Overtime::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'date' => '2026-06-01',
            'start_time' => '18:00',
            'end_time' => '21:00',
            'reason' => 'Sprint work',
            'status' => 'approved',
            'approved_by' => $approver->id,
        ]);

        $this->assertEquals($approver->id, $overtime->approver->id);
    }

    /** @test */
    public function test_overtime_status_can_be_rejected()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $overtime = Overtime::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'date' => '2026-06-01',
            'start_time' => '18:00',
            'end_time' => '20:00',
            'reason' => 'Extra work',
            'status' => 'pending',
        ]);

        $overtime->update(['status' => 'rejected', 'remark' => 'Not needed']);
        $this->assertEquals('rejected', $overtime->fresh()->status);
        $this->assertEquals('Not needed', $overtime->fresh()->remark);
    }
}
