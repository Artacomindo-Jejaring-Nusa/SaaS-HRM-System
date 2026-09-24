<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ComponentTrigger extends Model
{
    protected $fillable = [
        'component_id',
        'trigger_type', // 'recurring_monthly', 'fixed_calendar_date', 'date_range', 'employee_anniversary', 'manual'
        'config',
    ];

    protected $casts = [
        'config' => 'array',
    ];

    public function component()
    {
        return $this->belongsTo(PayrollComponent::class, 'component_id');
    }
}
