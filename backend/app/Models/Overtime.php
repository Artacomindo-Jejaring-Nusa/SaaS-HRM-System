<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Overtime extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'user_id',
        'company_id',
        'date',
        'start_time',
        'end_time',
        'reason',
        'status',
        'approved_by',
        'remark',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
