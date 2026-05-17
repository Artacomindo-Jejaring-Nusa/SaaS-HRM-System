<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'user_id', 'title', 'content'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
