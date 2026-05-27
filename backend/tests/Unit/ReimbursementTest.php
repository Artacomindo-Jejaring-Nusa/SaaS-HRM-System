<?php

namespace Tests\Unit;

use App\Models\Reimbursement;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReimbursementTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function test_reimbursement_can_be_created()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $reimbursement = Reimbursement::create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'title' => 'Transport Cost',
            'amount' => 150000,
            'description' => 'Taxi to client site',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('reimbursements', [
            'title' => 'Transport Cost',
            'amount' => 150000,
            'status' => 'pending',
        ]);
    }

    /** @test */
    public function test_reimbursement_belongs_to_user()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $reimbursement = Reimbursement::create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'title' => 'Lunch',
            'amount' => 50000,
            'status' => 'pending',
        ]);

        $this->assertEquals($user->id, $reimbursement->user->id);
    }

    /** @test */
    public function test_reimbursement_attachment_is_cast_to_array()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $reimbursement = Reimbursement::create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'title' => 'Office Supplies',
            'amount' => 200000,
            'status' => 'pending',
            'attachment' => ['receipt1.jpg', 'receipt2.jpg'],
        ]);

        $this->assertIsArray($reimbursement->fresh()->attachment);
        $this->assertCount(2, $reimbursement->fresh()->attachment);
    }

    /** @test */
    public function test_reimbursement_status_can_be_approved()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $reimbursement = Reimbursement::create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'title' => 'Travel',
            'amount' => 500000,
            'status' => 'pending',
        ]);

        $reimbursement->update(['status' => 'approved']);
        $this->assertEquals('approved', $reimbursement->fresh()->status);
    }
}
