<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Reimbursement extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id', 'user_id', 'employee_name', 'title', 'amount',
        'description', 'status', 'current_approval_step',
        'approved_by', 'attachment', 'remark', 'signature',
        'items', 'divisi', 'tujuan', 'priority',
    ];

    protected $casts = [
        'attachment' => 'array',
        'items' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
