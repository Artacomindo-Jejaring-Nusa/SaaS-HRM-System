<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Traits\Auditable;
use App\Traits\EncryptsSensitiveFields;
use App\Models\Notification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, Auditable, EncryptsSensitiveFields, \App\Traits\HasKemnakerLeave, \App\Traits\HasUserRelations {
        \App\Traits\HasUserRelations::notifications insteadof Notifiable;
    }

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
        'auto_validate_web_attendance', 'auto_validate_until', 'auto_validate_updated_by', 'auto_validate_updated_at',
    ];

    protected $casts = [
        'face_embedding' => 'array',
        'face_registered_at' => 'datetime',
        'face_approved_at' => 'datetime',
        'auto_validate_web_attendance' => 'boolean',
        'auto_validate_until' => 'datetime',
        'auto_validate_updated_at' => 'datetime',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'face_embedding', // Vektor biometrik 512-d tidak boleh terexpose di API response
    ];

    protected $appends = ['profile_photo_url', 'face_registered_photo_url', 'is_face_approved', 'is_manager', 'can_access_manager_portal', 'permission_slugs', 'kemnaker_leave_balance', 'is_eligible_for_leave', 'is_web_auto_validated'];

    public function getIsWebAutoValidatedAttribute(): bool
    {
        if (!$this->auto_validate_web_attendance) {
            return false;
        }

        if ($this->auto_validate_until) {
            return \Carbon\Carbon::parse($this->auto_validate_until)->endOfDay()->isFuture();
        }

        return true;
    }

    public function isWebAttendanceAutoValidated(): bool
    {
        return $this->is_web_auto_validated;
    }

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

        return $this->hasExplicitManagerAccess()
            || $this->hasApprovalPermissions()
            || $this->subordinates()->exists()
            || $this->hasManagerRoleKeyword();
    }

    private function hasExplicitManagerAccess(): bool
    {
        return isset($this->attributes['can_access_manager_portal']) && $this->attributes['can_access_manager_portal'] == 1;
    }

    private function hasApprovalPermissions(): bool
    {
        $permissions = [
            'view-manager-portal', 'manage-approvals', 'approve-leaves', 'approve-permits',
            'approve-overtimes', 'approve-reimbursements', 'approve-fund-requests',
            'approve-vehicle-logs', 'approve-shift-swaps', 'approve-project-costs',
            'manage-attendance-corrections', 'approve-attendance-corrections',
        ];

        foreach ($permissions as $perm) {
            if ($this->hasPermission($perm)) {
                return true;
            }
        }

        return false;
    }

    private function hasManagerRoleKeyword(): bool
    {
        $roleName = $this->relationLoaded('role') ? strtolower($this->role?->name ?? '') : '';
        if (!$roleName) {
            return false;
        }

        $keywords = ['manager', 'supervisor', 'admin', 'hrd', 'hr', 'lead', 'kadiv', 'head', 'atasan', 'spv', 'direktur', 'director', 'coo', 'ceo', 'boc', 'management'];
        foreach ($keywords as $keyword) {
            if (str_contains($roleName, $keyword)) {
                return true;
            }
        }

        return false;
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
