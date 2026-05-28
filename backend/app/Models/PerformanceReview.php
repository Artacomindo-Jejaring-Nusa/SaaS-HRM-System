<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class PerformanceReview extends Model
{
    use BelongsToCompany;
    protected $fillable = [
        'company_id',
        'user_id',
        'reviewer_id',
        'period',
        'score_discipline',
        'score_technical',
        'score_cooperation',
        'score_attitude',
        'score_total',
        'achievements',
        'improvements',
        'comments',
        'status',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
