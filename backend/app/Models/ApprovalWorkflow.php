<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ApprovalWorkflow extends Model
{
    use BelongsToCompany, HasFactory;

    protected $fillable = [
        'company_id',
        'module_key',
        'name',
        'description',
        'icon',
        'is_active',
        'is_custom',
        'category',
        'flow_json',
        'scope_type',
        'scope_id',
        'priority',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_custom' => 'boolean',
        'priority' => 'integer',
        'scope_id' => 'integer',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function steps()
    {
        return $this->hasMany(WorkflowStep::class, 'workflow_id')->orderBy('step_number');
    }

    public function scopeRole()
    {
        return $this->belongsTo(Role::class, 'scope_id');
    }

    public function scopeUser()
    {
        return $this->belongsTo(User::class, 'scope_id');
    }
}
