<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    private function createTestUser()
    {
        $company = Company::create(['name' => 'PT Test Company']);
        $user = User::factory()->create([
            'company_id' => $company->id,
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
        ]);

        return [$company, $user];
    }

    /** @test */
    public function test_login_requires_email_and_password()
    {
        $response = $this->postJson('/api/login', []);
        $response->assertStatus(401);
    }

    /** @test */
    public function test_login_fails_with_wrong_credentials()
    {
        [$company, $user] = $this->createTestUser();

        $response = $this->postJson('/api/login', [
            'email' => 'test@example.com',
            'password' => 'wrongpassword',
            'company_name' => $company->name,
        ]);

        $response->assertStatus(401);
    }

    /** @test */
    public function test_login_fails_with_nonexistent_company()
    {
        $response = $this->postJson('/api/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
            'company_name' => 'Nonexistent Company XYZ',
        ]);

        $response->assertStatus(401);
    }

    /** @test */
    public function test_login_success_returns_token()
    {
        [$company, $user] = $this->createTestUser();

        $response = $this->postJson('/api/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
            'company_name' => $company->name,
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'status',
            'data' => ['access_token'],
        ]);
    }

    /** @test */
    public function test_health_check_endpoint()
    {
        $response = $this->getJson('/api/health');
        $response->assertStatus(200);
        $response->assertJsonFragment(['status' => 'healthy']);
    }

    /** @test */
    public function test_search_companies_endpoint()
    {
        Company::create(['name' => 'PT Artacom']);
        Company::create(['name' => 'PT Digital']);

        $response = $this->getJson('/api/companies/search?q=Artacom');
        $response->assertStatus(200);
    }

    /** @test */
    public function test_logout_requires_authentication()
    {
        $response = $this->postJson('/api/logout');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_get_user_requires_authentication()
    {
        $response = $this->getJson('/api/user');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_authenticated_user_can_access_profile()
    {
        [$company, $user] = $this->createTestUser();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/user');

        $response->assertStatus(200);
    }
}
