<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProfileRequest extends Model
{
    protected $fillable = [
        'user_id',
        'company_id',
        'old_data',
        'new_data',
        'status',
        'approved_by',
    ];

    protected $casts = [
        'old_data' => 'array',
        'new_data' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
