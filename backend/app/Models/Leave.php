<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Leave extends Model
{
    use BelongsToCompany, Auditable;

    protected $fillable = [
        'user_id', 'company_id', 'start_date', 'end_date',
        'type', 'reason', 'leave_address', 'emergency_phone',
        'status', 'current_approval_step',
        'approved_by', 'signature', 'remark',
        'supervisor_approved_by', 'supervisor_approved_at', 'supervisor_remark',
    ];

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function supervisorApprover(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_approved_by');
    }

    public function hrApprover(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
