<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FundRequest extends Model
{
    use BelongsToCompany, HasFactory;

    protected $fillable = [
        'company_id',
        'user_id',
        'employee_name',
        'title',
        'amount',
        'reason',
        'divisi',
        'tujuan',
        'priority',
        'signature',
        'items',
        'status',
        'current_approval_step',
        'supervisor_id',
        'hrd_id',
        'supervisor_approved_at',
        'hrd_approved_at',
        'rejected_at',
        'reject_reason',
        'attachment',
    ];

    protected $casts = [
        'items' => 'array',
        'company_id' => 'integer',
        'user_id' => 'integer',
        'current_approval_step' => 'integer',
        'amount' => 'float',
    ];

    protected $appends = [
        'current_step_info',
    ];

    public function getCurrentStepInfoAttribute()
    {
        if (empty($this->current_approval_step) || empty($this->company_id)) {
            return null;
        }

        try {
            return \App\Services\ApprovalService::getCurrentStepInfo(
                'fund_request',
                (int) $this->company_id,
                (int) $this->current_approval_step,
                $this->user
            );
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function supervisor()
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function hrd()
    {
        return $this->belongsTo(User::class, 'hrd_id');
    }
}
