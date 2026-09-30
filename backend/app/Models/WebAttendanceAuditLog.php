<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebAttendanceAuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'action',
        'previous_auto_validate',
        'new_auto_validate',
        'previous_expires_at',
        'new_expires_at',
        'changed_by',
        'notes',
        'ip_address',
    ];

    protected $casts = [
        'previous_auto_validate' => 'boolean',
        'new_auto_validate' => 'boolean',
        'previous_expires_at' => 'datetime',
        'new_expires_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function changer()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
