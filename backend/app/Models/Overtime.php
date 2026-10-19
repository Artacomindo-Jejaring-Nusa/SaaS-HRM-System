<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Overtime extends Model
{
    use Auditable, BelongsToCompany;

    protected $fillable = [
        'user_id',
        'company_id',
        'assigned_by',
        'division_id',
        'title',
        'date',
        'start_time',
        'end_time',
        'reason',
        'status',
        'current_approval_step',
        'approved_by',
        'remark',
        'signature',
        'rejection_reason',
        'responded_at',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
        'date' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function assigner()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function division()
    {
        return $this->belongsTo(Role::class, 'division_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function items()
    {
        return $this->hasMany(OvertimeItem::class);
    }
}
