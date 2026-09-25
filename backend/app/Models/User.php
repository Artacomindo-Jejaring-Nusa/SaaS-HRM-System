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
    use HasApiTokens, HasFactory, Notifiable, Auditable, EncryptsSensitiveFields, \App\Traits\HasKemnakerLeave, \App\Traits\HasUserRelations;

    protected array $encryptedFields = ['ktp_no', 'bank_account_no', 'bpjs_kesehatan_no', 'bpjs_ketenagakerjaan_no'];

    protected string $auditModule = 'employee';
    protected array $auditMasked = ['ktp_no', 'bank_account_no', 'bpjs_kesehatan_no', 'bpjs_ketenagakerjaan_no', 'basic_salary'];
    protected array $auditExclude = ['password', 'remember_token', 'fcm_token', 'face_embedding', 'updated_at', 'created_at'];

    protected $fillable = [
        'name', 'email', 'password', 'company_id', 'office_id', 'role_id', 'supervisor_id', 'device_id',
        'can_access_manager_portal',
        'profile_photo_path', 'face_embedding',
        'face_status', 'face_registered_photo_path', 'face_rejection_reason',
        'face_registered_at', 'face_approved_at', 'face_approved_by',
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

    protected $casts = [
        'face_embedding' => 'array',
        'face_registered_at' => 'datetime',
        'face_approved_at' => 'datetime',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'face_embedding', // Vektor biometrik 128-d tidak boleh terexpose di API response
    ];

    protected $appends = ['profile_photo_url', 'face_registered_photo_url', 'is_face_approved', 'is_manager', 'can_access_manager_portal', 'permission_slugs', 'kemnaker_leave_balance', 'is_eligible_for_leave'];

    public function getFaceRegisteredPhotoUrlAttribute()
    {
        return $this->face_registered_photo_path ? asset('storage/'.$this->face_registered_photo_path) : null;
    }

    public function getIsFaceApprovedAttribute(): bool
    {
        return $this->face_status === 'approved' && !empty($this->face_embedding);
    }

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

        $roleName = strtolower($this->role?->name ?? '');
        return $this->hasPermission('view-manager-portal')
            || $this->hasPermission('approve-leaves')
            || $this->hasPermission('approve-permits')
            || $this->hasPermission('approve-overtimes')
            || $this->hasPermission('approve-reimbursements')
            || $this->hasPermission('approve-fund-requests')
            || $this->hasPermission('approve-vehicle-logs')
            || $this->hasPermission('approve-shift-swaps')
            || $this->hasPermission('approve-project-costs')
            || str_contains($roleName, 'manager')
            || str_contains($roleName, 'supervisor')
            || str_contains($roleName, 'admin')
            || str_contains($roleName, 'hrd')
            || str_contains($roleName, 'hr')
            || str_contains($roleName, 'direktur')
            || str_contains($roleName, 'director')
            || str_contains($roleName, 'coo')
            || str_contains($roleName, 'ceo')
            || str_contains($roleName, 'boc')
            || str_contains($roleName, 'management');
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
}
