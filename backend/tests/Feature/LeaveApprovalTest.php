<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Leave;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaveApprovalTest extends TestCase
{
    use RefreshDatabase;

    protected $company;

    protected $hr;

    protected $employee;

    protected function setUp(): void
    {
        parent::setUp();
        $this->company = Company::create(['name' => 'PT Jelantik Cipta']);

        // HR Admin
        $this->hr = User::factory()->create([
            'company_id' => $this->company->id,
            'role_id' => 1, // Admin / HR
        ]);

        // Karyawan
        $this->employee = User::factory()->create([
            'company_id' => $this->company->id,
            'role_id' => 2,
            'leave_balance' => 12, // Saldo awal 12
        ]);
    }

    /** @test */
    public function it_deducts_leave_balance_when_hr_approves_annual_leave()
    {
        // Arrange: Karyawan sudah punya tiket cuti berstatus pending
        $leave = Leave::create([
            'user_id' => $this->employee->id,
            'company_id' => $this->company->id,
            'start_date' => now()->addDays(1)->format('Y-m-d'),
            'end_date' => now()->addDays(2)->format('Y-m-d'), // 2 hari cuti
            'type' => 'Cuti Tahunan',
            'reason' => 'Keperluan keluarga',
            'signature' => 'base64',
            'status' => 'pending_hr',
        ]);

        // Act: HR melakukan approve cuti
        $response = $this->actingAs($this->hr, 'sanctum')
            ->postJson("/api/leaves/{$leave->id}/approve", [
                'remark' => 'Approved by HR',
            ]);

        // Assert: Cek respons sukses
        $response->assertStatus(200);

        // Verifikasi saldo cuti karyawan berkurang menjadi 10 (karena potong 2 hari)
        $this->employee->refresh();
        $this->assertEquals(10, $this->employee->leave_balance, 'Saldo cuti gagal terpotong setelah di-approve');

        // Verifikasi status cuti menjadi approved
        $this->assertDatabaseHas('leaves', [
            'id' => $leave->id,
            'status' => 'approved',
            'approved_by' => $this->hr->id,
        ]);
    }
}
