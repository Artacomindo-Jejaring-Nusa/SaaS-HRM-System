<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Leave extends Model
{
    use Auditable, BelongsToCompany;

    protected $fillable = [
        'user_id', 'company_id', 'start_date', 'end_date',
        'type', 'reason', 'leave_address', 'emergency_phone',
        'status', 'current_approval_step',
        'approved_by', 'signature', 'remark',
        'supervisor_approved_by', 'supervisor_approved_at', 'supervisor_remark',
        'duration_days', 'is_paid', 'kemnaker_article',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function supervisorApprover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_approved_by');
    }

    public function hrApprover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
