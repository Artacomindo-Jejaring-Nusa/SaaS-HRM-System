<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class PayrollBatch extends Model
{
    use BelongsToCompany;
    protected $fillable = [
        'company_id',
        'period_month',
        'period_year',
        'total_employees',
        'total_gross',
        'total_deductions',
        'total_net',
        'status',
        'created_by',
        'approved_by',
        'submitted_at',
        'approved_at',
        'rejection_note',
        'notes',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function salaries()
    {
        return $this->hasMany(Salary::class, 'batch_id');
    }

    /**
     * Recalculate batch totals from related salaries
     */
    public function recalculateTotals()
    {
        $salaries = $this->salaries;

        $this->update([
            'total_employees' => $salaries->count(),
            'total_gross' => $salaries->sum('total_earnings'),
            'total_deductions' => $salaries->sum('total_deductions'),
            'total_net' => $salaries->sum('net_salary'),
        ]);
    }
}
