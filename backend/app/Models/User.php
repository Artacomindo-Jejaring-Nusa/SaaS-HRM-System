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
    use HasApiTokens, HasFactory, Notifiable, Auditable, EncryptsSensitiveFields, \App\Traits\HasKemnakerLeave;

    protected array $encryptedFields = ['ktp_no', 'bank_account_no', 'bpjs_kesehatan_no', 'bpjs_ketenagakerjaan_no'];

    protected string $auditModule = 'employee';
    protected array $auditMasked = ['ktp_no', 'bank_account_no', 'bpjs_kesehatan_no', 'bpjs_ketenagakerjaan_no', 'basic_salary'];
    protected array $auditExclude = ['password', 'remember_token', 'fcm_token', 'face_embedding', 'updated_at', 'created_at'];

    protected $fillable = [
        'name', 'email', 'password', 'company_id', 'office_id', 'role_id', 'supervisor_id', 'device_id',
        'can_access_manager_portal',
        'profile_photo_path', 'face_embedding',
        'nik', 'ktp_no', 'phone', 'emergency_contact_name', 'emergency_contact_phone', 'address',
        'place_of_birth', 'date_of_birth', 'gender', 'marital_status', 'religion', 'blood_type',
        'join_date', 'fcm_token', 'leave_balance', 'is_wfh',
        'wfh_start_date', 'wfh_end_date', 'employment_status', 'work_location', 'email_verified_at',
        'attendance_type', 'is_tracking_enabled',
        'ptkp_status', 'bpjs_kesehatan_no', 'bpjs_ketenagakerjaan_no',
        'bank_name', 'bank_account_no', 'bank_account_name', 'cost_center', 'basic_salary',
        'fixed_allowance', 'working_days_per_week', 'payroll_type',
        'leave_period_start', 'leave_accrued', 'leave_used', 'leave_expand_used', 'leave_expand_last_month',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = ['profile_photo_url', 'is_manager', 'can_access_manager_portal', 'permission_slugs', 'kemnaker_leave_balance', 'is_eligible_for_leave'];

    public function getProfilePhotoUrlAttribute()
    {
        return $this->profile_photo_path ? asset('storage/'.$this->profile_photo_path) : null;
    }

    public function getCanAccessManagerPortalAttribute(): bool
    {
        if ($this->role_id === 1) {
            return true;
        }

        if (array_key_exists('can_access_manager_portal', $this->attributes) && $this->attributes['can_access_manager_portal'] !== null) {
            return (bool) $this->attributes['can_access_manager_portal'];
        }

        return $this->hasPermission('view-manager-portal');
    }

    public function getIsManagerAttribute()
    {
        return $this->can_access_manager_portal;
    }

    public function getPermissionSlugsAttribute(): array
    {
        if ($this->role_id === 1) {
            return Permission::pluck('slug')->toArray();
        }

        $this->loadMissing('role.permissions');
        if (! $this->role || ! $this->role->relationLoaded('permissions')) {
            return [];
        }

        return $this->role->permissions->pluck('slug')->toArray();
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_wfh' => 'boolean',
            'is_tracking_enabled' => 'boolean',
            'can_access_manager_portal' => 'boolean',
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
        // Master Admin (Role ID 1) bypass all
        if ($this->role_id === 1) {
            return true;
        }

        $this->loadMissing('role.permissions');

        if (! $this->role) {
            return false;
        }

        if ($this->role->relationLoaded('permissions')) {
            return $this->role->permissions->contains('slug', $slug);
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
}
