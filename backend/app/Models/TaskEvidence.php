<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskEvidence extends Model
{
    protected $table = 'task_evidences';

    protected $fillable = [
        'task_activity_id',
        'photo_before_path',
        'photo_after_path',
        'notes',
        'submitted_at',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
    ];

    public function taskActivity()
    {
        return $this->belongsTo(TaskActivity::class);
    }

    /**
     * Get photo URLs with full path
     */
    public function getPhotoBeforeUrlAttribute()
    {
        return $this->photo_before_path ? asset('storage/'.$this->photo_before_path) : null;
    }

    public function getPhotoAfterUrlAttribute()
    {
        return $this->photo_after_path ? asset('storage/'.$this->photo_after_path) : null;
    }
}
