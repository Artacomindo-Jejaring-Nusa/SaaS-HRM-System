<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectCashFlow extends Model
{
    protected $fillable = [
        'project_id', 'type', 'category', 'description', 'amount',
        'transaction_date', 'reference_number', 'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'transaction_date' => 'date',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
