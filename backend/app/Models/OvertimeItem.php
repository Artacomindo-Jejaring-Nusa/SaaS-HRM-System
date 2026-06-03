<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OvertimeItem extends Model
{
    protected $fillable = [
        'overtime_id',
        'date',
        'start_time',
        'end_time',
        'reason',
    ];

    public function overtime()
    {
        return $this->belongsTo(Overtime::class);
    }
}
