<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

class AttendanceCorrection extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'user_id', 'company_id', 'attendance_id', 'correction_type',
        'corrected_check_in', 'corrected_check_out',
        'reason', 'status', 'approved_by', 'remark',
    ];

    protected $appends = ['corrected_check_in_time', 'corrected_check_out_time', 'attendance_date'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function attendance()
    {
        return $this->belongsTo(Attendance::class);
    }

    public function getCorrectedCheckInTimeAttribute()
    {
        return $this->corrected_check_in ? Carbon::parse($this->corrected_check_in)->format('H:i') : null;
    }

    public function getCorrectedCheckOutTimeAttribute()
    {
        return $this->corrected_check_out ? Carbon::parse($this->corrected_check_out)->format('H:i') : null;
    }

    public function getAttendanceDateAttribute()
    {
        return $this->attendance ? Carbon::parse($this->attendance->check_in)->format('Y-m-d') : null;
    }
}
