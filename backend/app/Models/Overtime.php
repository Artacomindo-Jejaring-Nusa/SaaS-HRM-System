<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Overtime extends Model
{
    use BelongsToCompany, Auditable;

    protected $fillable = [
        'user_id',
        'company_id',
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
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
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

