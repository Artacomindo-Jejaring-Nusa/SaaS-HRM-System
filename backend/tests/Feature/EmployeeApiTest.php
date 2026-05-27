<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\User;
use App\Models\Role;
use App\Models\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeApiTest extends TestCase
{
    use RefreshDatabase;

    private function createAdminUser()
    {
        $company = Company::create(['name' => 'Test Company']);
        $user = User::factory()->create([
            'company_id' => $company->id,
            'role_id' => 1, // Super Admin
        ]);

        return [$company, $user];
    }

    /** @test */
    public function test_employees_list_requires_authentication()
    {
        $response = $this->getJson('/api/employees');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_dashboard_requires_authentication()
    {
        $response = $this->getJson('/api/dashboard/summary');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_attendance_heatmap_requires_auth()
    {
        $response = $this->getJson('/api/attendance/heatmap');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_leave_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/leave');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_overtimes_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/overtimes');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_reimbursements_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/reimbursements');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_tasks_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/tasks');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_announcements_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/announcements');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_company_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/company');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_holidays_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/holidays');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_notifications_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/notifications');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_projects_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/projects');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_vehicle_logs_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/vehicle-logs');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_kpi_reviews_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/kpi-reviews');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_shift_swap_endpoint_requires_auth()
    {
        $response = $this->getJson('/api/shift-swap');
        $response->assertStatus(401);
    }
}
