<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaveSubmissionTest extends TestCase
{
    use RefreshDatabase;

    protected $company;

    protected $user;

    protected function setUp(): void
    {
        parent::setUp();
        // Setup initial data
        $this->company = Company::create(['name' => 'PT Jelantik Cipta']);
        $this->user = User::factory()->create([
            'company_id' => $this->company->id,
            'role_id' => 2, // Karyawan biasa
            'leave_balance' => 12, // Punya 12 hari cuti
        ]);
    }

    /** @test */
    public function it_returns_422_when_validation_fails()
    {
        // Act: Mencoba submit cuti tanpa data lengkap (harus gagal validasi)
        $response = $this->actingAs($this->user, 'sanctum')->postJson('/api/leaves', []);

        // Assert: Pastikan status 422 Unprocessable Entity dan ada error validasi
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['start_date', 'end_date', 'type', 'signature']);
    }

    /** @test */
    public function it_returns_400_when_leave_balance_is_insufficient()
    {
        // Arrange: User mencoba ambil cuti 15 hari, padahal saldo cuma 12
        $payload = [
            'start_date' => now()->addDays(1)->format('Y-m-d'),
            'end_date' => now()->addDays(15)->format('Y-m-d'),
            'type' => 'Cuti Tahunan',
            'reason' => 'Liburan panjang',
            'signature' => 'base64_string_here',
        ];

        // Act
        $response = $this->actingAs($this->user, 'sanctum')->postJson('/api/leaves', $payload);

        // Assert: Pastikan ditolak sistem dengan status 400
        $response->assertStatus(400)
            ->assertJson([
                'status' => 'error',
                'message' => 'Sisa cuti tahunan Anda tidak mencukupi (termasuk cuti yang masih pending/menunggu).',
            ]);
    }

    /** @test */
    public function it_successfully_submits_leave_request_when_balance_is_sufficient()
    {
        // Arrange: Cuti 3 hari
        $payload = [
            'start_date' => now()->addDays(1)->format('Y-m-d'),
            'end_date' => now()->addDays(3)->format('Y-m-d'),
            'type' => 'Cuti Tahunan',
            'reason' => 'Acara keluarga',
            'signature' => 'base64_string_here',
        ];

        // Act
        $response = $this->actingAs($this->user, 'sanctum')->postJson('/api/leaves', $payload);

        // Assert: Berhasil (201 Created)
        $response->assertStatus(201)
            ->assertJson([
                'status' => 'success',
                'message' => 'Permohonan cuti berhasil diajukan.',
            ]);

        // Verifikasi database insert
        $this->assertDatabaseHas('leaves', [
            'user_id' => $this->user->id,
            'type' => 'Cuti Tahunan',
            'status' => 'pending_hr', // Karena tidak punya supervisor
        ]);
    }
}
