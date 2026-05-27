<?php

namespace Tests\Unit;

use App\Models\Task;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function test_task_can_be_created()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);
        $assigner = User::factory()->create(['company_id' => $company->id]);

        $task = Task::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'assigned_by' => $assigner->id,
            'title' => 'Fix Bug #123',
            'description' => 'Fix the login page bug',
            'deadline' => '2026-07-01',
            'status' => 'ongoing',
            'priority' => 'high',
        ]);

        $this->assertDatabaseHas('tasks', [
            'title' => 'Fix Bug #123',
            'priority' => 'high',
        ]);
    }

    /** @test */
    public function test_task_belongs_to_user()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $task = Task::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'title' => 'Create Report',
            'status' => 'pending',
            'priority' => 'medium',
        ]);

        $this->assertEquals($user->id, $task->user->id);
    }

    /** @test */
    public function test_task_has_assigner_relation()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);
        $assigner = User::factory()->create(['company_id' => $company->id]);

        $task = Task::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'assigned_by' => $assigner->id,
            'title' => 'Deploy App',
            'status' => 'pending',
            'priority' => 'high',
        ]);

        $this->assertEquals($assigner->id, $task->assigner->id);
    }

    /** @test */
    public function test_task_has_activities_relation()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);

        $task = Task::create([
            'user_id' => $user->id,
            'company_id' => $company->id,
            'title' => 'Setup CI/CD',
            'status' => 'pending',
            'priority' => 'low',
        ]);

        $this->assertCount(0, $task->activities);
    }

    /** @test */
    public function test_task_fillable_fields_are_correct()
    {
        $task = new Task();
        $fillable = $task->getFillable();

        $this->assertContains('title', $fillable);
        $this->assertContains('status', $fillable);
        $this->assertContains('priority', $fillable);
        $this->assertContains('deadline', $fillable);
        $this->assertContains('user_id', $fillable);
    }
}
