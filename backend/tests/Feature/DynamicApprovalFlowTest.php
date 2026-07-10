<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\ApprovalWorkflow;
use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class DynamicApprovalFlowTest extends TestCase
{
    use RefreshDatabase;

    private $company;
    private $employee;
    private $supervisor;
    private $hrManager;
    private $ceo;
    private $masterAdminRole;
    private $hrdRole;
    private $ceoRole;
    private $karyawanRole;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();

        // Create company
        $this->company = Company::create(['name' => 'Test Company']);

        // Create roles in order so Master Admin has ID 1
        $this->masterAdminRole = Role::create(['name' => 'Master Admin']); // ID 1
        $this->karyawanRole = Role::create(['name' => 'Karyawan']); // ID 2
        $this->hrdRole = Role::create(['name' => 'HRD Manager']); // ID 3
        $this->ceoRole = Role::create(['name' => 'CEO']); // ID 4

        // Create and attach permissions to all roles
        $permissions = [
            'apply-leaves',
            'apply-permits',
            'apply-overtimes',
            'apply-reimbursements',
            'apply-attendances',
            'approve-leaves',
            'approve-permits',
            'approve-overtimes',
            'approve-reimbursements',
            'manage-attendance-corrections',
        ];

        foreach ($permissions as $permName) {
            $perm = Permission::create([
                'name' => $permName,
                'slug' => $permName,
                'group' => 'Test'
            ]);
            $this->karyawanRole->permissions()->attach($perm->id);
            $this->hrdRole->permissions()->attach($perm->id);
            $this->ceoRole->permissions()->attach($perm->id);
        }

        // Create CEO
        $this->ceo = User::factory()->create([
            'name' => 'CEO User',
            'company_id' => $this->company->id,
            'role_id' => $this->ceoRole->id,
        ]);

        // Create Supervisor
        $this->supervisor = User::factory()->create([
            'name' => 'Supervisor User',
            'company_id' => $this->company->id,
            'role_id' => $this->karyawanRole->id,
            'supervisor_id' => $this->ceo->id,
        ]);

        // Create HR Manager
        $this->hrManager = User::factory()->create([
            'name' => 'HR Manager User',
            'company_id' => $this->company->id,
            'role_id' => $this->hrdRole->id,
        ]);

        // Create Employee
        $this->employee = User::factory()->create([
            'name' => 'Employee User',
            'company_id' => $this->company->id,
            'role_id' => $this->karyawanRole->id,
            'supervisor_id' => $this->supervisor->id,
            'leave_balance' => 12,
        ]);
    }

    /** @test */
    public function test_leave_fallback_logic_when_no_workflow_is_configured()
    {
        $payload = [
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-03',
            'type' => 'Cuti Tahunan',
            'reason' => 'Liburan',
            'signature' => 'data:image/png;base64,mocksignaturedata',
        ];

        // 1. Submit leave
        $response = $this->actingAs($this->employee)
            ->postJson('/api/leave', $payload);

        $response->assertStatus(201);
        $leaveId = $response->json('data.id');

        // Check fallback status should be 'pending_supervisor' since employee has a supervisor
        $this->assertDatabaseHas('leaves', [
            'id' => $leaveId,
            'status' => 'pending_supervisor',
            'current_approval_step' => null,
        ]);

        // 2. Approve by supervisor
        $approveResponse = $this->actingAs($this->supervisor)
            ->postJson("/api/leave/{$leaveId}/approve", ['remark' => 'Approved by supervisor']);

        $approveResponse->assertStatus(200);
        $this->assertDatabaseHas('leaves', [
            'id' => $leaveId,
            'status' => 'pending_hr',
        ]);

        // 3. Approve by HR manager
        $hrResponse = $this->actingAs($this->hrManager)
            ->postJson("/api/leave/{$leaveId}/approve", ['remark' => 'Approved by HR']);

        $hrResponse->assertStatus(200);
        $this->assertDatabaseHas('leaves', [
            'id' => $leaveId,
            'status' => 'approved',
        ]);

        // Check leave balance deducted (12 - 3 days = 9)
        $this->assertEquals(9, $this->employee->fresh()->leave_balance);
    }

    /** @test */
    public function test_leave_dynamic_workflow_with_multiple_steps()
    {
        // Configure a 3-step dynamic workflow for 'leave'
        $workflow = ApprovalWorkflow::create([
            'company_id' => $this->company->id,
            'module_key' => 'leave',
            'name' => 'Standard Leave Flow',
            'is_active' => true,
        ]);

        $workflow->steps()->createMany([
            [
                'step_number' => 1,
                'approver_type' => 'supervisor',
                'sla_hours' => 24,
            ],
            [
                'step_number' => 2,
                'approver_type' => 'role',
                'approver_role_id' => $this->hrdRole->id,
                'sla_hours' => 24,
            ],
            [
                'step_number' => 3,
                'approver_type' => 'user',
                'approver_user_id' => $this->ceo->id,
                'sla_hours' => 24,
            ],
        ]);

        $payload = [
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-03',
            'type' => 'Cuti Tahunan',
            'reason' => 'Mudik',
            'signature' => 'data:image/png;base64,mocksignaturedata',
        ];

        // 1. Submit leave
        $response = $this->actingAs($this->employee)
            ->postJson('/api/leave', $payload);

        $response->assertStatus(201);
        $leaveId = $response->json('data.id');

        // Should be pending at step 1
        $this->assertDatabaseHas('leaves', [
            'id' => $leaveId,
            'status' => 'pending',
            'current_approval_step' => 1,
        ]);

        // 2. Supervisor approves step 1
        $response = $this->actingAs($this->supervisor)
            ->postJson("/api/leave/{$leaveId}/approve");

        $response->assertStatus(200);
        $this->assertDatabaseHas('leaves', [
            'id' => $leaveId,
            'status' => 'pending',
            'current_approval_step' => 2,
        ]);

        // 3. HR approves step 2
        $response = $this->actingAs($this->hrManager)
            ->postJson("/api/leave/{$leaveId}/approve");

        $response->assertStatus(200);
        $this->assertDatabaseHas('leaves', [
            'id' => $leaveId,
            'status' => 'pending',
            'current_approval_step' => 3,
        ]);

        // 4. CEO approves final step 3
        $response = $this->actingAs($this->ceo)
            ->postJson("/api/leave/{$leaveId}/approve", ['remark' => 'Enjoy your holiday']);

        $response->assertStatus(200);
        $this->assertDatabaseHas('leaves', [
            'id' => $leaveId,
            'status' => 'approved',
            'current_approval_step' => null,
            'approved_by' => $this->ceo->id,
            'remark' => 'Enjoy your holiday',
        ]);

        // Balance should be updated
        $this->assertEquals(9, $this->employee->fresh()->leave_balance);
    }

    /** @test */
    public function test_unauthorized_approver_cannot_approve_workflow_step()
    {
        $workflow = ApprovalWorkflow::create([
            'company_id' => $this->company->id,
            'module_key' => 'leave',
            'name' => 'Leave Flow',
            'is_active' => true,
        ]);

        $workflow->steps()->create([
            'step_number' => 1,
            'approver_type' => 'user',
            'approver_user_id' => $this->ceo->id,
            'sla_hours' => 24,
        ]);

        $payload = [
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-03',
            'type' => 'Cuti Tahunan',
            'reason' => 'Holiday',
            'signature' => 'data:image/png;base64,mocksignaturedata',
        ];

        // 1. Submit leave
        $response = $this->actingAs($this->employee)
            ->postJson('/api/leave', $payload);

        $leaveId = $response->json('data.id');

        // 2. Supervisor (not CEO) tries to approve step 1
        $response = $this->actingAs($this->supervisor)
            ->postJson("/api/leave/{$leaveId}/approve");

        $response->assertStatus(403);
        $response->assertJsonPath('status', 'error');

        // Status should still be pending
        $this->assertDatabaseHas('leaves', [
            'id' => $leaveId,
            'status' => 'pending',
            'current_approval_step' => 1,
        ]);
    }

    /** @test */
    public function test_rejection_flow_immediately_rejects_workflow()
    {
        $workflow = ApprovalWorkflow::create([
            'company_id' => $this->company->id,
            'module_key' => 'leave',
            'name' => 'Leave Flow',
            'is_active' => true,
        ]);

        $workflow->steps()->createMany([
            [
                'step_number' => 1,
                'approver_type' => 'supervisor',
                'sla_hours' => 24,
            ],
            [
                'step_number' => 2,
                'approver_type' => 'user',
                'approver_user_id' => $this->ceo->id,
                'sla_hours' => 24,
            ],
        ]);

        $payload = [
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-03',
            'type' => 'Cuti Tahunan',
            'reason' => 'Holiday',
            'signature' => 'data:image/png;base64,mocksignaturedata',
        ];

        // 1. Submit leave
        $response = $this->actingAs($this->employee)
            ->postJson('/api/leave', $payload);

        $leaveId = $response->json('data.id');

        // 2. Supervisor rejects at step 1
        $response = $this->actingAs($this->supervisor)
            ->postJson("/api/leave/{$leaveId}/reject", ['remark' => 'Busy schedule']);

        $response->assertStatus(200);

        // Workflow should be fully rejected, current_approval_step set to null
        $this->assertDatabaseHas('leaves', [
            'id' => $leaveId,
            'status' => 'rejected',
            'current_approval_step' => null,
            'approved_by' => $this->supervisor->id,
            'remark' => 'Busy schedule',
        ]);
    }

    /** @test */
    public function test_permit_dynamic_workflow()
    {
        $workflow = ApprovalWorkflow::create([
            'company_id' => $this->company->id,
            'module_key' => 'permit',
            'name' => 'Permit Flow',
            'is_active' => true,
        ]);

        $workflow->steps()->create([
            'step_number' => 1,
            'approver_type' => 'role',
            'approver_role_id' => $this->hrdRole->id,
            'sla_hours' => 24,
        ]);

        $payload = [
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-02',
            'type' => 'Izin Sakit',
            'category' => 'S',
            'reason' => 'Demam',
            'signature' => 'data:image/png;base64,mocksignaturedata',
        ];

        $response = $this->actingAs($this->employee)
            ->postJson('/api/permits', $payload);

        $response->assertStatus(201);
        $permitId = $response->json('data.id');

        $this->assertDatabaseHas('permits', [
            'id' => $permitId,
            'status' => 'pending',
            'current_approval_step' => 1,
        ]);

        // HR Manager approves
        $response = $this->actingAs($this->hrManager)
            ->postJson("/api/permits/{$permitId}/approve", ['remark' => 'Approved HR']);

        $response->assertStatus(200);
        $this->assertDatabaseHas('permits', [
            'id' => $permitId,
            'status' => 'approved',
            'current_approval_step' => null,
            'approved_by' => $this->hrManager->id,
            'remark' => 'Approved HR',
        ]);
    }

    /** @test */
    public function test_overtime_dynamic_workflow()
    {
        $workflow = ApprovalWorkflow::create([
            'company_id' => $this->company->id,
            'module_key' => 'overtime',
            'name' => 'Overtime Flow',
            'is_active' => true,
        ]);

        $workflow->steps()->create([
            'step_number' => 1,
            'approver_type' => 'user',
            'approver_user_id' => $this->ceo->id,
            'sla_hours' => 24,
        ]);

        $payload = [
            'date' => '2026-06-01',
            'start_time' => '17:00',
            'end_time' => '20:00',
            'reason' => 'Laporan bulanan',
        ];

        $response = $this->actingAs($this->employee)
            ->postJson('/api/overtimes', $payload);

        $response->assertStatus(201);
        $overtimeId = $response->json('data.id');

        $this->assertDatabaseHas('overtimes', [
            'id' => $overtimeId,
            'status' => 'pending',
            'current_approval_step' => 1,
        ]);

        // CEO approves
        $response = $this->actingAs($this->ceo)
            ->postJson("/api/overtimes/{$overtimeId}/approve", ['remark' => 'Approved CEO']);

        $response->assertStatus(200);
        $this->assertDatabaseHas('overtimes', [
            'id' => $overtimeId,
            'status' => 'approved',
            'current_approval_step' => null,
            'approved_by' => $this->ceo->id,
            'remark' => 'Approved CEO',
        ]);
    }

    /** @test */
    public function test_reimbursement_dynamic_workflow()
    {
        $workflow = ApprovalWorkflow::create([
            'company_id' => $this->company->id,
            'module_key' => 'reimbursement',
            'name' => 'Reimbursement Flow',
            'is_active' => true,
        ]);

        $workflow->steps()->create([
            'step_number' => 1,
            'approver_type' => 'role',
            'approver_role_id' => $this->hrdRole->id,
            'sla_hours' => 24,
        ]);

        $payload = [
            'title' => 'Bensin Klien',
            'amount' => 150000,
            'description' => 'Reimburse bensin ketemu klien',
        ];

        $response = $this->actingAs($this->employee)
            ->postJson('/api/reimbursements', $payload);

        $response->assertStatus(201);
        $reimbursementId = $response->json('data.id');

        $this->assertDatabaseHas('reimbursements', [
            'id' => $reimbursementId,
            'status' => 'pending',
            'current_approval_step' => 1,
        ]);

        // HR Manager approves
        $response = $this->actingAs($this->hrManager)
            ->postJson("/api/reimbursements/{$reimbursementId}/approve", ['remark' => 'Approved Reimbursement']);

        $response->assertStatus(200);
        $this->assertDatabaseHas('reimbursements', [
            'id' => $reimbursementId,
            'status' => 'approved',
            'current_approval_step' => null,
            'remark' => 'Approved Reimbursement',
        ]);
    }

    /** @test */
    public function test_fund_request_dynamic_workflow()
    {
        $workflow = ApprovalWorkflow::create([
            'company_id' => $this->company->id,
            'module_key' => 'fund_request',
            'name' => 'Fund Request Flow',
            'is_active' => true,
        ]);

        $workflow->steps()->create([
            'step_number' => 1,
            'approver_type' => 'supervisor',
            'sla_hours' => 24,
        ]);

        $payload = [
            'amount' => 500000,
            'reason' => 'Beli ATK Kantor',
        ];

        $response = $this->actingAs($this->employee)
            ->postJson('/api/fund-requests', $payload);

        $response->assertStatus(201);
        $requestId = $response->json('data.id');

        $this->assertDatabaseHas('fund_requests', [
            'id' => $requestId,
            'status' => 'pending',
            'current_approval_step' => 1,
        ]);

        // Supervisor approves
        $response = $this->actingAs($this->supervisor)
            ->postJson("/api/fund-requests/{$requestId}/approve");

        $response->assertStatus(200);
        $this->assertDatabaseHas('fund_requests', [
            'id' => $requestId,
            'status' => 'approved',
            'current_approval_step' => null,
            'hrd_id' => $this->supervisor->id,
        ]);
    }

    /** @test */
    public function test_attendance_correction_dynamic_workflow()
    {
        // 1. Create a dummy attendance record first
        $attendance = Attendance::create([
            'user_id' => $this->employee->id,
            'company_id' => $this->company->id,
            'check_in' => now()->subDay()->setTime(8, 0, 0),
            'check_out' => null,
        ]);

        $workflow = ApprovalWorkflow::create([
            'company_id' => $this->company->id,
            'module_key' => 'attendance_correction',
            'name' => 'Correction Flow',
            'is_active' => true,
        ]);

        $workflow->steps()->create([
            'step_number' => 1,
            'approver_type' => 'user',
            'approver_user_id' => $this->ceo->id,
            'sla_hours' => 24,
        ]);

        $payload = [
            'attendance_id' => $attendance->id,
            'correction_type' => 'missing_checkout',
            'corrected_check_out' => '17:00',
            'reason' => 'Lupa checkout',
        ];

        $response = $this->actingAs($this->employee)
            ->postJson('/api/attendance-corrections', $payload);

        $response->assertStatus(201);
        $correctionId = $response->json('data.id');

        $this->assertDatabaseHas('attendance_corrections', [
            'id' => $correctionId,
            'status' => 'pending',
            'current_approval_step' => 1,
        ]);

        // CEO approves
        $response = $this->actingAs($this->ceo)
            ->postJson("/api/attendance-corrections/{$correctionId}/approve", ['remark' => 'Approved Correction']);

        $response->assertStatus(200);
        $this->assertDatabaseHas('attendance_corrections', [
            'id' => $correctionId,
            'status' => 'approved',
            'current_approval_step' => null,
            'approved_by' => $this->ceo->id,
            'remark' => 'Approved Correction',
        ]);

        // Actual attendance check_out should be updated
        $this->assertNotNull($attendance->fresh()->check_out);
        $this->assertEquals('17:00:00', \Carbon\Carbon::parse($attendance->fresh()->check_out)->format('H:i:s'));
    }
}
