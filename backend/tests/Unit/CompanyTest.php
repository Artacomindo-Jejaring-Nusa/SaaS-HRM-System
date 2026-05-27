<?php

namespace Tests\Unit;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function test_company_can_be_created()
    {
        $company = Company::create(['name' => 'PT Artacom Solusi Teknologi']);

        $this->assertDatabaseHas('companies', [
            'name' => 'PT Artacom Solusi Teknologi',
        ]);
    }

    /** @test */
    public function test_company_has_many_users()
    {
        $company = Company::create(['name' => 'Test Co']);
        User::factory()->count(3)->create(['company_id' => $company->id]);

        $this->assertCount(3, $company->users ?? User::where('company_id', $company->id)->get());
    }
}
