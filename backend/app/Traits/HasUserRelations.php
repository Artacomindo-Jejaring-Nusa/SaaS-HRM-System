<?php

namespace App\Traits;

use App\Models\Attendance;
use App\Models\Company;
use App\Models\Leave;
use App\Models\Notification;
use App\Models\Office;
use App\Models\Overtime;
use App\Models\Permit;
use App\Models\Role;
use App\Models\Salary;
use App\Models\Schedule;
use App\Models\User;

trait HasUserRelations
{
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function office()
    {
        return $this->belongsTo(Office::class);
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function supervisor()
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function subordinates()
    {
        return $this->hasMany(User::class, 'supervisor_id');
    }

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    public function salaries()
    {
        return $this->hasMany(Salary::class);
    }

    public function overtimes()
    {
        return $this->hasMany(Overtime::class);
    }

    public function leaves()
    {
        return $this->hasMany(Leave::class);
    }

    public function permits()
    {
        return $this->hasMany(Permit::class);
    }

    public function faceApprover()
    {
        return $this->belongsTo(User::class, 'face_approved_by');
    }
}
