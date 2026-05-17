<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id', 'user_id', 'action',
        'description', 'model_type', 'model_id',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
