<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Company extends Model
{
    protected $fillable = [
        'name', 'email', 'logo', 'address', 'phone', 'default_radius', 'latitude', 'longitude', 'radius_meters',
        'watzap_api_key', 'watzap_number_key', 'watzap_base_url',
    ];

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function offices()
    {
        return $this->hasMany(Office::class);
    }

    public function getEmployeeLimit()
    {
        return $this->employee_limit ?? 999999;
    }
}
