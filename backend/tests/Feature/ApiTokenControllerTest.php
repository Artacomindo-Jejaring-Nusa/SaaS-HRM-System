<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\User;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiTokenControllerTest extends TestCase
{
    use RefreshDatabase;

    private function createUser()
    {
        $company = Company::create(['name' => 'Test Company']);
        $role = Role::create([
            'name' => 'Super Admin',
            'guard_name' => 'web'
        ]);
        $user = User::factory()->create([
            'company_id' => $company->id,
            'role_id' => $role->id,
        ]);

        return [$company, $user];
    }

    /** @test */
    public function test_api_tokens_index_requires_authentication()
    {
        $response = $this->getJson('/api/api-tokens');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_api_tokens_store_requires_authentication()
    {
        $response = $this->postJson('/api/api-tokens', ['name' => 'Accurate Token']);
        $response->assertStatus(401);
    }

    /** @test */
    public function test_api_tokens_destroy_requires_authentication()
    {
        $response = $this->deleteJson('/api/api-tokens/1');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_user_can_create_api_token()
    {
        [$company, $user] = $this->createUser();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/api-tokens', [
                'name' => 'Finance App',
                'abilities' => ['view-employees', 'view-payroll'],
                'expires_at' => now()->addDays(7)->toDateString()
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'status',
                'message',
                'data' => [
                    'id',
                    'name',
                    'plain_text_token',
                    'abilities',
                    'expires_at'
                ]
            ])
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'name' => 'Finance App',
                    'abilities' => ['view-employees', 'view-payroll']
                ]
            ]);

        // Assert database has the token with prefix
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'name' => 'integration:Finance App'
        ]);
    }

    /** @test */
    public function test_user_can_list_only_integration_tokens()
    {
        [$company, $user] = $this->createUser();

        // Create integration token
        $user->createToken('integration:Active Token', ['view-employees']);
        // Create session token (no prefix)
        $user->createToken('auth_token', ['*']);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/api-tokens');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Active Token');
    }

    /** @test */
    public function test_user_can_revoke_integration_token()
    {
        [$company, $user] = $this->createUser();

        $token = $user->createToken('integration:To Delete', ['view-employees']);

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/api-tokens/' . $token->accessToken->id);

        $response->assertStatus(200);

        $this->assertDatabaseMissing('personal_access_tokens', [
            'id' => $token->accessToken->id
        ]);
    }

    /** @test */
    public function test_user_cannot_revoke_non_integration_token()
    {
        [$company, $user] = $this->createUser();

        $token = $user->createToken('auth_token', ['*']);

        $response = $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/api-tokens/' . $token->accessToken->id);

        $response->assertStatus(404);

        $this->assertDatabaseHas('personal_access_tokens', [
            'id' => $token->accessToken->id
        ]);
    }

    /** @test */
    public function test_user_cannot_revoke_other_users_integration_token()
    {
        [$company, $user1] = $this->createUser();
        $user2 = User::factory()->create([
            'company_id' => $company->id,
            'role_id' => 1,
        ]);

        $token = $user2->createToken('integration:User 2 Token', ['view-employees']);

        $response = $this->actingAs($user1, 'sanctum')
            ->deleteJson('/api/api-tokens/' . $token->accessToken->id);

        $response->assertStatus(404);

        $this->assertDatabaseHas('personal_access_tokens', [
            'id' => $token->accessToken->id
        ]);
    }
}
