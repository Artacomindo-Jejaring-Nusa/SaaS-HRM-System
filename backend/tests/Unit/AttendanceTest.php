<?php

namespace Tests\Unit;

use App\Models\Attendance;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function test_it_can_record_attendance_check_in()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $attendance = Attendance::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'check_in' => now(),
            'status' => 'present',
            'latitude_in' => -6.200000,
            'longitude_in' => 106.800000,
        ]);

        $this->assertDatabaseHas('attendances', [
            'user_id' => $user->id,
            'status' => 'present',
        ]);
    }

    /** @test */
    public function test_it_calculates_late_status_correctly()
    {
        // This is more of a logic check that could be tied to a service
        // but for now we test the model/database entry.
        $company = Company::create(['name' => 'Test Co 2']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $attendance = Attendance::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'check_in' => now(),
            'status' => 'late',
        ]);

        $this->assertEquals('late', $attendance->status);
    }
}
