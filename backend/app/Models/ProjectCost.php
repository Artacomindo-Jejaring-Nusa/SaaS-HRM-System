<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectCost extends Model
{
    protected $fillable = [
        'project_id', 'budget_item_id', 'category', 'description', 'amount',
        'cost_date', 'vendor', 'receipt_number', 'status', 'submitted_by', 'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'cost_date' => 'date',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function budgetItem()
    {
        return $this->belongsTo(ProjectBudget::class, 'budget_item_id');
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }
}
