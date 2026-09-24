<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayslipDetail extends Model
{
    protected $fillable = [
        'salary_id',
        'component_id',
        'component_name',
        'type', // 'earning' | 'deduction'
        'calculation_rule',
        'amount',
        'note',
        'is_adhoc',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'is_adhoc' => 'boolean',
    ];

    public function salary()
    {
        return $this->belongsTo(Salary::class, 'salary_id');
    }

    public function component()
    {
        return $this->belongsTo(PayrollComponent::class, 'component_id');
    }
}
