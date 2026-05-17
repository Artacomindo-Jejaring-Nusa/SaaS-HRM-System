<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FundRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'user_id',
        'amount',
        'reason',
        'status',
        'supervisor_id',
        'hrd_id',
        'supervisor_approved_at',
        'hrd_approved_at',
        'rejected_at',
        'reject_reason',
        'attachment',
    ];

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
