<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskActivity extends Model
{
    protected $table = 'task_activities';

    protected $fillable = [
        'task_id',
        'activity_name',
        'description',
        'sort_order',
        'status',
        'has_before_photo',
        'has_after_photo',
        'completed_at',
    ];

    protected $casts = [
        'has_before_photo' => 'boolean',
        'has_after_photo' => 'boolean',
        'completed_at' => 'datetime',
    ];

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function evidence()
    {
        return $this->hasOne(TaskEvidence::class);
    }

    /**
     * Calculate progress percentage for parent task
     */
    public static function calculateTaskProgress($taskId)
    {
        $totalActivities = self::where('task_id', $taskId)->count();

        if ($totalActivities === 0) {
            return 0;
        }

        $completedActivities = self::where('task_id', $taskId)
            ->where('status', 'completed')
            ->count();

        return round(($completedActivities / $totalActivities) * 100, 2);
    }

    /**
     * Check if activity has complete evidence
     */
    public function hasCompleteEvidence()
    {
        return $this->evidence && $this->evidence->photo_after_path;
    }
}
