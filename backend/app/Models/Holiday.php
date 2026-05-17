<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Holiday extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'name', 'date'];
}
