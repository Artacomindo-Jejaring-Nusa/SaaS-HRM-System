<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class ShiftSwap extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id', 'requester_id', 'receiver_id', 'requester_schedule_id',
        'receiver_schedule_id', 'status', 'reason', 'approved_by', 'remark',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    public function requesterSchedule()
    {
        return $this->belongsTo(Schedule::class, 'requester_schedule_id');
    }

    public function receiverSchedule()
    {
        return $this->belongsTo(Schedule::class, 'receiver_schedule_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
