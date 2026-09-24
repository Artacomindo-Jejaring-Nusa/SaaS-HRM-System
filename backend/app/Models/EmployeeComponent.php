<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeComponent extends Model
{
    protected $fillable = [
        'component_id',
        'user_id',
        'role_id',
        'is_global',
        'custom_amount',
        'is_active',
    ];

    protected $casts = [
        'is_global' => 'boolean',
        'is_active' => 'boolean',
        'custom_amount' => 'decimal:2',
    ];

    public function component()
    {
        return $this->belongsTo(PayrollComponent::class, 'component_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function role()
    {
        return $this->belongsTo(Role::class, 'role_id');
    }
}
