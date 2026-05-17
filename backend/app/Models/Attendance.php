<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'user_id', 'company_id', 'office_id',
        'check_in', 'check_out',
        'latitude_in', 'longitude_in',
        'latitude_out', 'longitude_out',
        'image_in', 'image_out',
        'status', 'is_suspicious', 'suspicious_reason',
    ];

    protected $casts = [
        'is_suspicious' => 'boolean',
    ];

    protected $appends = ['date', 'check_in_time', 'check_out_time', 'check_in_location', 'image_in_url', 'image_out_url'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function office()
    {
        return $this->belongsTo(Office::class);
    }

    public function getDateAttribute()
    {
        return $this->check_in ? Carbon::parse($this->check_in)->format('Y-m-d') : null;
    }

    public function getCheckInTimeAttribute()
    {
        return $this->check_in ? Carbon::parse($this->check_in)->format('H:i:s') : null;
    }

    public function getCheckOutTimeAttribute()
    {
        return $this->check_out ? Carbon::parse($this->check_out)->format('H:i:s') : null;
    }

    public function getCheckInLocationAttribute()
    {
        if ($this->latitude_in && $this->longitude_in) {
            return $this->latitude_in.', '.$this->longitude_in;
        }

        return 'Sistem Web';
    }

    public function getImageInUrlAttribute()
    {
        return $this->image_in ? asset('storage/'.$this->image_in) : null;
    }

    public function getImageOutUrlAttribute()
    {
        return $this->image_out ? asset('storage/'.$this->image_out) : null;
    }
}
