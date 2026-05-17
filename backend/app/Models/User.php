<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name', 'email', 'password', 'company_id', 'office_id', 'role_id', 'supervisor_id', 'device_id',
        'profile_photo_path', 'face_embedding',
        'nik', 'ktp_no', 'phone', 'emergency_contact_name', 'emergency_contact_phone', 'address',
        'place_of_birth', 'date_of_birth', 'gender', 'marital_status', 'religion', 'blood_type',
        'join_date', 'fcm_token', 'leave_balance', 'is_wfh',
        'wfh_start_date', 'wfh_end_date', 'employment_status', 'work_location', 'email_verified_at',
        'attendance_type',
        'ptkp_status', 'bpjs_kesehatan_no', 'bpjs_ketenagakerjaan_no',
        'bank_name', 'bank_account_no', 'bank_account_name', 'cost_center', 'basic_salary',
        'fixed_allowance', 'working_days_per_week', 'payroll_type',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = ['profile_photo_url', 'is_manager'];

    public function getProfilePhotoUrlAttribute()
    {
        return $this->profile_photo_path ? asset('storage/'.$this->profile_photo_path) : null;
    }

    public function getIsManagerAttribute()
    {
        if (! $this->relationLoaded('role')) {
            return false;
        }
        if (! $this->role) {
            return false;
        }
        $roleName = $this->role->name;

        // Broad list of roles that count as management/HR for data visibility
        $managerRoles = [
            'Manager', 'Supervisor', 'HRD', 'HRD Manager', 'Management',
            'Direktur', 'Direktur Utama', 'CEO', 'Super Admin', 'Admin',
        ];

        return in_array($roleName, $managerRoles) || str_contains(strtolower($roleName), 'manager');
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_wfh' => 'boolean',
            'wfh_start_date' => 'date',
            'wfh_end_date' => 'date',
            'date_of_birth' => 'date',
        ];
    }

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

    public function hasPermission($slug)
    {
        if (! $this->relationLoaded('role')) {
            // If role is not loaded and we are in strict mode, this might still fail
            // if we access $this->role. But PermissionMiddleware now handles this.
            // For other cases, we can try to use role_id if it's the master admin.
            if ($this->role_id === 1) {
                return true;
            }

            return false;
        }

        if (! $this->role) {
            return false;
        }

        // Master Admin (Role ID 1) bypass all
        if ($this->role_id === 1) {
            return true;
        }

        return $this->role->permissions()->where('slug', $slug)->exists();
    }

    /**
     * Determine if user should skip tenant filtering (Admin mode)
     */
    public function canAccessAllCompanies()
    {
        // Only the actual Provider Master Admin (ID 1) can see all data
        return $this->role_id === 1;
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
}
