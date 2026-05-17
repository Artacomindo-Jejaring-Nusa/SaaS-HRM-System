<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectSchedule extends Model
{
    protected $fillable = [
        'project_id', 'task_name', 'description', 'phase',
        'planned_start', 'planned_end', 'actual_start', 'actual_end',
        'progress', 'status', 'order', 'notes',
    ];

    protected $casts = [
        'planned_start' => 'date',
        'planned_end' => 'date',
        'actual_start' => 'date',
        'actual_end' => 'date',
        'progress' => 'decimal:2',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
