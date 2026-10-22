<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Yajra\DataTables\Facades\DataTables;

class EmployeeQueryService
{
    public static function getPaginatedEmployees(Request $request, User $user)
    {
        $query = User::query();

        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        }

        if ($request->is_team === 'true' || $request->is_team === true) {
            self::applyTeamFilter($query, $user);
        }

        if ($request->filled('role_id') && $request->role_id !== 'all') {
            $query->where('role_id', $request->role_id);
        }

        if ($request->filled('attendance_type') && $request->attendance_type !== 'all') {
            $query->where('attendance_type', $request->attendance_type);
        }

        $employees = $query
            ->when($request->search, fn ($q) => self::applySearchFilter($q, (string) $request->search))
            ->when($request->id, fn ($q) => $q->where('id', $request->id))
            ->with(['role.permissions', 'supervisor', 'office'])
            ->orderBy('name', 'asc')
            ->paginate($request->per_page ?? 10);

        self::maskSensitiveFields($employees, $user);

        return $employees;
    }

    public static function applyTeamFilter($query, User $user): void
    {
        $isGlobalAdmin = $user->role_id === 1 || $user->hasRole('Super Admin');
        $isCompanyAdmin = $user->hasRole(['Admin', 'HRD', 'Direktur']) || $user->canAccessAllCompanies();

        if ($isGlobalAdmin || $isCompanyAdmin || $user->hasPermission('manage-tasks') || $user->hasPermission('assign-tasks') || $user->hasPermission('assign-overtimes') || $user->hasPermission('manage-overtimes')) {
            $query->where('id', '!=', $user->id);

            return;
        }

        $allSubordinateIds = self::resolveSubordinateIds($user->id);

        if (! empty($allSubordinateIds)) {
            $query->whereIn('id', $allSubordinateIds);
        } else {
            $query->where('supervisor_id', $user->id);
        }
    }

    public static function resolveSubordinateIds(int $userId): array
    {
        $allIds = [];
        $currentLevelIds = User::where('supervisor_id', $userId)->pluck('id')->toArray();

        while (! empty($currentLevelIds)) {
            $allIds = array_merge($allIds, $currentLevelIds);
            $currentLevelIds = User::whereIn('supervisor_id', $currentLevelIds)
                ->whereNotIn('id', $allIds)
                ->pluck('id')
                ->toArray();
        }

        return array_values(array_unique($allIds));
    }

    public static function applySearchFilter($query, string $search): void
    {
        $query->where(function ($qq) use ($search) {
            $qq->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('nik', 'like', "%{$search}%")
                ->orWhereHas('role', function ($r) use ($search) {
                    $r->where('name', 'like', "%{$search}%");
                });
        });
    }

    public static function maskSensitiveFields($employees, User $user): void
    {
        if ($user->hasPermission('view-employees') || $user->hasRole(['Super Admin', 'Admin', 'HRD', 'Manager'])) {
            return;
        }

        $employees->getCollection()->transform(function ($emp) {
            $emp->makeHidden(['basic_salary', 'bank_account_no', 'bank_name', 'ktp_no', 'bpjs_kesehatan_no', 'bpjs_ketenagakerjaan_no']);

            return $emp;
        });
    }

    public static function getDatatablesResponse(Request $request, User $user)
    {
        $query = self::buildDatatablesBaseQuery($user, $request);

        return DataTables::of($query)
            ->with([
                'unverified_count' => User::where('company_id', $user->company_id)->whereNull('email_verified_at')->count(),
            ])
            ->filter(fn ($q) => self::applyDatatablesFilter($q, $request))
            ->make(true);
    }

    public static function buildDatatablesBaseQuery(User $user, Request $request)
    {
        $query = User::with(['role.permissions', 'supervisor', 'office']);

        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        }

        if ($request->is_team === 'true' || $request->is_team === true) {
            $query->where('supervisor_id', $user->id);
        }

        if ($request->filter === 'unverified') {
            $query->whereNull('email_verified_at');
        }

        if ($request->filled('role_id') && $request->role_id !== 'all') {
            $query->where('role_id', $request->role_id);
        }

        if ($request->filled('attendance_type') && $request->attendance_type !== 'all') {
            $query->where('attendance_type', $request->attendance_type);
        }

        return $query;
    }

    public static function applyDatatablesFilter($query, Request $request): void
    {
        if ($request->filled('role_id') && $request->role_id !== 'all') {
            $query->where('role_id', $request->role_id);
        }
        if ($request->filled('attendance_type') && $request->attendance_type !== 'all') {
            $query->where('attendance_type', $request->attendance_type);
        }
        if ($request->has('search') && ! empty($request->search['value'])) {
            $searchTerm = $request->search['value'];
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', "%{$searchTerm}%")
                    ->orWhere('email', 'like', "%{$searchTerm}%")
                    ->orWhere('nik', 'like', "%{$searchTerm}%")
                    ->orWhereHas('role', function ($r) use ($searchTerm) {
                        $r->where('name', 'like', "%{$searchTerm}%");
                    });
            });
        }
    }
}
