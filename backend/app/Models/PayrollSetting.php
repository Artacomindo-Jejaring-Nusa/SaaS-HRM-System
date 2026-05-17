<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollSetting extends Model
{
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
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
