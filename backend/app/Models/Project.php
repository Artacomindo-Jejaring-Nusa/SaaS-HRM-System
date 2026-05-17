<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    private const CAST_DECIMAL_2 = 'decimal:2';

    protected $fillable = [
        'company_id', 'name', 'code', 'description', 'client_name', 'location',
        'status', 'total_budget', 'total_cost', 'progress_percentage',
        'start_date', 'end_date', 'actual_start_date', 'actual_end_date',
        'project_manager_id',
    ];

    protected $casts = [
        'total_budget' => self::CAST_DECIMAL_2,
        'total_cost' => self::CAST_DECIMAL_2,
        'progress_percentage' => self::CAST_DECIMAL_2,
        'start_date' => 'date',
        'end_date' => 'date',
        'actual_start_date' => 'date',
        'actual_end_date' => 'date',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function projectManager()
    {
        return $this->belongsTo(User::class, 'project_manager_id');
    }

    public function budgets()
    {
        return $this->hasMany(ProjectBudget::class);
    }

    public function costs()
    {
        return $this->hasMany(ProjectCost::class);
    }

    public function contracts()
    {
        return $this->hasMany(ProjectContract::class);
    }

    public function schedules()
    {
        return $this->hasMany(ProjectSchedule::class)->orderBy('order');
    }

    public function cashFlows()
    {
        return $this->hasMany(ProjectCashFlow::class);
    }

    public function recalculate()
    {
        $this->total_budget = $this->budgets()->sum('total_price');
        $this->total_cost = $this->costs()->where('status', 'approved')->sum('amount');

        $schedules = $this->schedules;
        if ($schedules->count() > 0) {
            $this->progress_percentage = $schedules->avg('progress');
        }

        $this->save();
    }
}
