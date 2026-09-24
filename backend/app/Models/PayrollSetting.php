<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class PayrollSetting extends Model
{
    use BelongsToCompany;
    protected $fillable = [
        'company_id',
        'cutoff_day',
        'bpjs_kesehatan_coy_pct',
        'bpjs_kesehatan_emp_pct',
        'bpjs_jht_coy_pct',
        'bpjs_jht_emp_pct',
        'bpjs_jp_coy_pct',
        'bpjs_jp_emp_pct',
        'bpjs_jkm_pct',
        'bpjs_jkk_pct',
        'tax_method',
        'overtime_rate_per_hour',
        'overtime_rate_holiday_per_hour',
        'late_deduction_enabled',
        'late_deduction_base',
        'late_grace_period_minutes',
        'late_deduction_tiers',
        'absence_deduction_enabled',
        'absence_deduction_base',
        'absence_deduction_pct',
        'absence_forfeit_allowance',
    ];

    protected $casts = [
        'late_deduction_enabled' => 'boolean',
        'late_grace_period_minutes' => 'integer',
        'late_deduction_tiers' => 'array',
        'absence_deduction_enabled' => 'boolean',
        'absence_deduction_pct' => 'float',
        'absence_forfeit_allowance' => 'boolean',
    ];

    /**
     * Default tiers for late deduction if not customized yet
     */
    public static function defaultLateTiers(): array
    {
        return [
            [
                'min_minutes' => 1,
                'max_minutes' => 15,
                'penalty_type' => 'percentage', // percentage or fixed
                'penalty_value' => 0.5, // 0.5%
            ],
            [
                'min_minutes' => 16,
                'max_minutes' => 30,
                'penalty_type' => 'percentage',
                'penalty_value' => 1.0, // 1.0%
            ],
            [
                'min_minutes' => 31,
                'max_minutes' => 60,
                'penalty_type' => 'percentage',
                'penalty_value' => 2.5, // 2.5%
            ],
            [
                'min_minutes' => 61,
                'max_minutes' => 9999,
                'penalty_type' => 'percentage',
                'penalty_value' => 5.0, // 5.0%
            ],
        ];
    }

    public function getEffectiveLateTiersAttribute(): array
    {
        return !empty($this->late_deduction_tiers) ? $this->late_deduction_tiers : self::defaultLateTiers();
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
