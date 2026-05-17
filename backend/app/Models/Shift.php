<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Shift extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'name', 'start_time', 'end_time'];

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }
}
