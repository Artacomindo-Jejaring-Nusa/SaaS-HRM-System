<?php

namespace App\Traits;

use App\Models\Leave;
use Carbon\Carbon;

trait HasKemnakerLeave
{
    public function getIsEligibleForLeaveAttribute(): bool
    {
        if (!$this->join_date) {
            return false;
        }
        return Carbon::parse($this->join_date)->diffInYears(now()) >= 1;
    }

    public function getCurrentLeavePeriod(): array
    {
        if (!$this->join_date) {
            return ['start' => null, 'end' => null];
        }
        $joinDate = Carbon::parse($this->join_date);
        $currentYear = now()->year;
        
        $anniversaryThisYear = Carbon::create($currentYear, $joinDate->month, $joinDate->day);
        
        if (now()->lt($anniversaryThisYear)) {
            $start = Carbon::create($currentYear - 1, $joinDate->month, $joinDate->day)->startOfDay();
            $end = Carbon::create($currentYear, $joinDate->month, $joinDate->day)->subDay()->endOfDay();
        } else {
            $start = $anniversaryThisYear->copy()->startOfDay();
            $end = $anniversaryThisYear->copy()->addYear()->subDay()->endOfDay();
        }
        
        return [
            'start' => $start,
            'end' => $end,
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
        
        $months = $period['start']->diffInMonths(now());
        
        return min(12, $months + 1);
    }

    public function getKemnakerLeaveBalanceAttribute(): int
    {
        if (!$this->is_eligible_for_leave) {
            return 0;
        }
        
        $accrued = $this->getAccruedLeaveCount();
        $period = $this->getCurrentLeavePeriod();
        $used = $this->leaves()
            ->where('type', 'Cuti Tahunan')
            ->where('status', 'approved')
            ->whereBetween('start_date', [$period['start'], $period['end']])
            ->get()
            ->sum(function ($l) {
                return Carbon::parse($l->start_date)->diffInDays(Carbon::parse($l->end_date)) + 1;
            });
            
        return max(0, $accrued - $used);
    }

    public function canUseExpandMendadak(): bool
    {
        if (!$this->is_eligible_for_leave) {
            return false;
        }
        
        if ($this->leave_expand_last_month) {
            $last = Carbon::parse($this->leave_expand_last_month);
            if ($last->year === now()->year && $last->month === now()->month) {
                return false;
            }
        }
        
        return true;
    }
}
