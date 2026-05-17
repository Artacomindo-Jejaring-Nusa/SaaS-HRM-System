<?php

namespace Tests\Unit;

use App\Models\Company;
use App\Models\PerformanceReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PerformanceReviewTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function test_it_can_publish_a_kpi_review()
    {
        $company = Company::create(['name' => 'Test Co']);
        $user = User::factory()->create(['company_id' => $company->id]);
        $reviewer = User::factory()->create(['company_id' => $company->id]);

        $review = PerformanceReview::create([
            'user_id' => $user->id,
            'reviewer_id' => $reviewer->id,
            'company_id' => $company->id,
            'period' => '2026-04',
            'score_total' => 85.5,
            'status' => 'published',
        ]);

        $this->assertEquals('published', $review->status);
        $this->assertEquals(85.5, $review->score_total);
    }
}
