<?php

namespace Tests\Unit;

use App\Models\Holiday;
use App\Models\Company;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HolidayTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function test_holiday_can_be_created()
    {
        $company = Company::create(['name' => 'Test Co']);

        $holiday = Holiday::create([
            'company_id' => $company->id,
            'name' => 'Hari Raya Idul Fitri',
            'date' => '2026-03-31',
        ]);

        $this->assertDatabaseHas('holidays', [
            'name' => 'Hari Raya Idul Fitri',
            'date' => '2026-03-31',
        ]);
    }

    /** @test */
    public function test_multiple_holidays_can_be_created()
    {
        $company = Company::create(['name' => 'Test Co']);

        Holiday::create(['company_id' => $company->id, 'name' => 'Tahun Baru', 'date' => '2026-01-01']);
        Holiday::create(['company_id' => $company->id, 'name' => 'Hari Kemerdekaan', 'date' => '2026-08-17']);

        $this->assertCount(2, Holiday::where('company_id', $company->id)->get());
    }

    /** @test */
    public function test_holiday_has_required_fillable_fields()
    {
        $holiday = new Holiday();
        $this->assertContains('name', $holiday->getFillable());
        $this->assertContains('date', $holiday->getFillable());
        $this->assertContains('company_id', $holiday->getFillable());
    }
}
