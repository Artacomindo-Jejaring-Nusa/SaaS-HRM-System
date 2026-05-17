<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectContract extends Model
{
    protected $fillable = [
        'project_id', 'contract_number', 'title', 'vendor_name', 'vendor_contact',
        'contract_value', 'contract_type', 'status', 'start_date', 'end_date',
        'scope_of_work', 'notes',
    ];

    protected $casts = [
        'contract_value' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
