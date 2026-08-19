<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Traits\Auditable;
use App\Traits\EncryptsSensitiveFields;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, Auditable, EncryptsSensitiveFields;

    protected array $encryptedFields = ['ktp_no', 'bank_account_no', 'bpjs_kesehatan_no', 'bpjs_ketenagakerjaan_no'];

    protected string $auditModule = 'employee';
    protected array $auditMasked = ['ktp_no', 'bank_account_no', 'bpjs_kesehatan_no', 'bpjs_ketenagakerjaan_no', 'basic_salary'];
    protected array $auditExclude = ['password', 'remember_token', 'fcm_token', 'face_embedding', 'updated_at', 'created_at'];

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
        'leave_period_start', 'leave_accrued', 'leave_used', 'leave_expand_used', 'leave_expand_last_month',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = ['profile_photo_url', 'is_manager', 'kemnaker_leave_balance', 'is_eligible_for_leave'];

    public function getProfilePhotoUrlAttribute()
    {
        return $this->profile_photo_path ? asset('storage/'.$this->profile_photo_path) : null;
    }

    public function getIsManagerAttribute()
    {
        $this->loadMissing('role');
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
            'leave_expand_last_month' => 'date',
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

    /**
     * Scope a query to only include HRD or Admin users (or users with specific permission).
     */
    public function scopeWhereHrdOrAdmin($query, string $permissionSlug)
    {
        return $query->where(function ($q) use ($permissionSlug) {
            $q->whereHas('role', function ($r) {
                $r->where('name', 'like', '%HRD%')
                  ->orWhere('name', 'like', '%Admin%');
            })->orWhereHas('role.permissions', function ($p) use ($permissionSlug) {
                $p->where('slug', $permissionSlug);
            });
        });
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

    // ── Kemnaker Leave Helpers & Accessors ──

    public function getIsEligibleForLeaveAttribute(): bool
    {
        if (!$this->join_date) {
            return false;
        }
        return \Carbon\Carbon::parse($this->join_date)->diffInYears(now()) >= 1;
    }

    public function getCurrentLeavePeriod(): array
    {
        if (!$this->join_date) {
            return ['start' => null, 'end' => null];
        }
        $joinDate = \Carbon\Carbon::parse($this->join_date);
        $currentYear = now()->year;
        
        // Anniversary date in the current year
        $anniversaryThisYear = \Carbon\Carbon::create($currentYear, $joinDate->month, $joinDate->day);
        
        if (now()->lt($anniversaryThisYear)) {
            // Anniversary is later this year, so active period started last year
            $start = \Carbon\Carbon::create($currentYear - 1, $joinDate->month, $joinDate->day)->startOfDay();
            $end = \Carbon\Carbon::create($currentYear, $joinDate->month, $joinDate->day)->subDay()->endOfDay();
        } else {
            // Anniversary was already reached this year
            $start = $anniversaryThisYear->copy()->startOfDay();
            $end = $anniversaryThisYear->copy()->addYear()->subDay()->endOfDay();
        }
        
        return [
            'start' => $start,
            'end' => $end
        ];
    }

    public function getAccruedLeaveCount(): int
    {
        if (!$this->is_eligible_for_leave) {
            return 0;
        }
        $period = $this->getCurrentLeavePeriod();
        if (!$period['start']) {
            return 0;
        }
        
        // Months elapsed in current period
        $months = $period['start']->diffInMonths(now());
        
        // Cap at 12 days per period. Accrues 1 day per month (including the first month)
        return min(12, $months + 1);
    }

    public function getKemnakerLeaveBalanceAttribute(): int
    {
        if (!$this->is_eligible_for_leave) {
            return 0;
        }
        
        $accrued = $this->getAccruedLeaveCount();
        
        // Total approved annual leaves in current period
        $period = $this->getCurrentLeavePeriod();
        $used = $this->leaves()
            ->where('type', 'Cuti Tahunan')
            ->where('status', 'approved')
            ->whereBetween('start_date', [$period['start'], $period['end']])
            ->get()
            ->sum(function ($l) {
                return \Carbon\Carbon::parse($l->start_date)->diffInDays(\Carbon\Carbon::parse($l->end_date)) + 1;
            });
            
        return max(0, $accrued - $used);
    }

    public function canUseExpandMendadak(): bool
    {
        if (!$this->is_eligible_for_leave) {
            return false;
        }
        
        // If they have not used the expand in the current month, they can use it
        if ($this->leave_expand_last_month) {
            $last = \Carbon\Carbon::parse($this->leave_expand_last_month);
            if ($last->year === now()->year && $last->month === now()->month) {
                return false;
            }
        }
        
        return true;
    }
}
