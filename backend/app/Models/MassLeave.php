<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MassLeave extends Model
{
    use BelongsToCompany, HasFactory;

    protected $fillable = [
        'company_id',
        'name',
        'type',
        'start_date',
        'end_date',
        'is_deduction',
        'all_employees',
        'employee_ids',
    ];

    protected $casts = [
        'is_deduction' => 'boolean',
        'all_employees' => 'boolean',
        'employee_ids' => 'array',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
