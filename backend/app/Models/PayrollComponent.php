<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class PayrollComponent extends Model
{
    use BelongsToCompany, Auditable;

    protected string $auditModule = 'payroll';

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'type', // 'earning' | 'deduction'
        'calculation_rule', // 'fixed' | 'attendance' | 'percentage' | 'formula' | 'adhoc'
        'default_amount',
        'percentage_value',
        'percentage_basis',
        'formula_expression',
        'is_taxable',
        'is_active',
        'description',
    ];

    protected $casts = [
        'default_amount' => 'decimal:2',
        'percentage_value' => 'decimal:2',
        'is_taxable' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function triggers()
    {
        return $this->hasMany(ComponentTrigger::class, 'component_id');
    }

    public function assignments()
    {
        return $this->hasMany(EmployeeComponent::class, 'component_id');
    }

    public function payslipDetails()
    {
        return $this->hasMany(PayslipDetail::class, 'component_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeEarnings($query)
    {
        return $query->where('type', 'earning');
    }

    public function scopeDeductions($query)
    {
        return $query->where('type', 'deduction');
    }
}
