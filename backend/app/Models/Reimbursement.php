<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Reimbursement extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id', 'user_id', 'title', 'amount',
        'description', 'status', 'approved_by', 'attachment', 'remark',
    ];

    protected $casts = [
        'attachment' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
