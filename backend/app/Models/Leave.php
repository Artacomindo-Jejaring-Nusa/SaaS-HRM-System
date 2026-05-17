<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Leave extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'user_id', 'company_id', 'start_date', 'end_date',
        'type', 'reason', 'status', 'approved_by', 'signature', 'remark',
        'supervisor_approved_by', 'supervisor_approved_at', 'supervisor_remark',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function supervisorApprover()
    {
        return $this->belongsTo(User::class, 'supervisor_approved_by');
    }

    public function hrApprover()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
