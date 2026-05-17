<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    protected $fillable = [
        'user_id',
        'company_id',
        'assigned_by',
        'title',
        'description',
        'deadline',
        'status',
        'priority',
    ];

    protected $appends = ['progress_percentage'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function assigner()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function activities()
    {
        return $this->hasMany(TaskActivity::class)->orderBy('sort_order');
    }

    /**
     * Get progress percentage based on completed activities
     */
    public function getProgressPercentageAttribute()
    {
        return TaskActivity::calculateTaskProgress($this->id);
    }
}
