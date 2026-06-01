<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToCompany;
use App\Traits\EncryptsSensitiveFields;
use Illuminate\Database\Eloquent\Model;

class Salary extends Model
{
    use BelongsToCompany, Auditable, EncryptsSensitiveFields;

    protected array $encryptedFields = ['bank_account_no'];

    protected string $auditModule = 'payroll';
    protected array $auditMasked = ['bank_account_no', 'net_salary'];
    protected array $auditExclude = ['updated_at', 'created_at', 'details'];
    protected $fillable = [
        'user_id',
        'company_id',
        'batch_id',
        'month',
        'year',
        'basic_salary',
        'allowance',
        'deduction',
        'net_salary',
        'status',
        'details',

        // Employee context
        'department',
        'working_days',
        'total_working_days',

        // Earnings
        'earning_bpjs_kes_premium',
        'earning_position_allowance',
        'earning_attendance_allowance',
        'earning_communication_allowance',
        'earning_shift_premium',
        'earning_shift_meal',
        'earning_overtime',
        'earning_operational',
        'earning_diligence_bonus',
        'earning_backpay',
        'earning_others',
        'earning_others_note',

        // Deductions
        'deduction_bpjs_jht',
        'deduction_bpjs_jp',
        'deduction_bpjs_kes',
        'deduction_absence',
        'deduction_late',
        'deduction_tax',

        // Totals
        'total_earnings',
        'total_deductions',

        // Payment info
        'bank_name',
        'bank_account_no',
        'cost_center',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function batch()
    {
        return $this->belongsTo(PayrollBatch::class, 'batch_id');
    }

    /**
     * Calculate all totals based on individual components
     */
    public function calculateTotals()
    {
        $this->total_earnings = $this->basic_salary
            + $this->earning_bpjs_kes_premium
            + $this->earning_position_allowance
            + $this->earning_attendance_allowance
            + $this->earning_communication_allowance
            + $this->earning_shift_premium
            + $this->earning_shift_meal
            + $this->earning_overtime
            + $this->earning_operational
            + $this->earning_diligence_bonus
            + $this->earning_backpay
            + $this->earning_others;

        $this->total_deductions = $this->deduction_bpjs_jht
            + $this->deduction_bpjs_jp
            + $this->deduction_bpjs_kes
            + $this->deduction_absence
            + $this->deduction_late
            + $this->deduction_tax;

        // Legacy columns kept in sync
        $this->allowance = $this->total_earnings - $this->basic_salary;
        $this->deduction = $this->total_deductions;
        $this->net_salary = $this->total_earnings - $this->total_deductions;

        return $this;
    }
}
