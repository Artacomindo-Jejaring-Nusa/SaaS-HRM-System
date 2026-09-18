<?php

namespace App\Http\Controllers;

use App\Events\EmployeeLocationUpdated;
use App\Models\EmployeeTrack;
use App\Models\User;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class TrackingController extends Controller
{
    /**
     * Store new tracking location from Mobile App
     */
    public function store(Request $request)
    {
        $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'accuracy' => 'nullable|numeric',
            'battery_level' => 'nullable|integer',
            'recorded_at' => 'nullable|date',
        ]);

        $user = $request->user();

        // If tracking is disabled for this user/division, stop saving and inform client
        if ($user->is_tracking_enabled === false) {
            return response()->json([
                'status' => 'disabled',
                'message' => 'Live tracking dinonaktifkan untuk akun atau divisi Anda.',
                'is_tracking_enabled' => false,
            ]);
        }

        $track = EmployeeTrack::create([
            'user_id' => $user->id,
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
            'accuracy' => $request->accuracy,
            'battery_level' => $request->battery_level,
            'recorded_at' => $request->recorded_at ? Carbon::parse($request->recorded_at) : now(),
        ]);

        // Broadcast to WebSocket clients in real-time
        try {
            broadcast(new EmployeeLocationUpdated($track))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('WebSocket broadcast failed for live tracking: ' . $e->getMessage());
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Location updated successfully',
            'data' => $track->load(['user.role', 'user.company'])
        ]);
    }

    /**
     * Get live tracking for Dashboard
     * Returns the latest location per user for today with filter support
     */
    public function live(Request $request)
    {
        $user = $request->user();

        // Security check: Only Super Admin can access live tracking
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');
        if (! $isSuperAdmin && ! $user->hasPermission('view-live-tracking')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak. Fitur Live Tracking hanya untuk Super Admin.',
            ], 403);
        }

        $today = Carbon::today();
        
        $query = EmployeeTrack::with([
            'user:id,name,nik,profile_photo_path,company_id,role_id,phone,email',
            'user.role:id,name',
            'user.company:id,name'
        ])
        ->whereDate('recorded_at', $today)
        ->whereIn('id', function ($query) use ($today) {
            $query->selectRaw('MAX(id)')
                  ->from('employee_tracks')
                  ->whereDate('recorded_at', $today)
                  ->groupBy('user_id');
        });

        // Company filter
        if ($user->company_id && !$user->canAccessAllCompanies()) {
            $query->whereHas('user', function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            });
        } elseif ($request->filled('company_id') && $request->company_id !== 'all') {
            $query->whereHas('user', function ($q) use ($request) {
                $q->where('company_id', $request->company_id);
            });
        }

        // Role / Position filter
        if ($request->filled('role_id') && $request->role_id !== 'all') {
            $query->whereHas('user', function ($q) use ($request) {
                $q->where('role_id', $request->role_id);
            });
        }

        // Text Search filter (Name / NIK)
        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('nik', 'like', "%{$search}%");
            });
        }

        $tracks = $query->get();

        // Also include users who checked in today in attendances if not already in employee_tracks
        $trackedUserIds = $tracks->pluck('user_id')->toArray();
        $attendancesToday = \App\Models\Attendance::with([
            'user:id,name,nik,profile_photo_path,company_id,role_id,phone,email',
            'user.role:id,name',
            'user.company:id,name'
        ])
        ->whereDate('check_in', $today)
        ->whereNotNull('latitude_in')
        ->whereNotNull('longitude_in')
        ->whereNotIn('user_id', $trackedUserIds)
        ->get();

        foreach ($attendancesToday as $att) {
            if ($user->company_id && !$user->canAccessAllCompanies() && $att->company_id !== $user->company_id) {
                continue;
            }
            if ($request->filled('company_id') && $request->company_id !== 'all' && $att->company_id != $request->company_id) {
                continue;
            }
            if ($request->filled('role_id') && $request->role_id !== 'all' && $att->user?->role_id != $request->role_id) {
                continue;
            }
            if ($request->filled('search')) {
                $search = strtolower($request->search);
                $userName = strtolower($att->user?->name ?? '');
                $userNik = strtolower($att->user?->nik ?? '');
                if (!str_contains($userName, $search) && !str_contains($userNik, $search)) {
                    continue;
                }
            }

            $fakeTrack = new EmployeeTrack([
                'user_id' => $att->user_id,
                'latitude' => $att->latitude_out ?? $att->latitude_in,
                'longitude' => $att->longitude_out ?? $att->longitude_in,
                'accuracy' => 10,
                'battery_level' => 100,
                'recorded_at' => $att->check_out ?? $att->check_in,
            ]);
            $fakeTrack->id = $att->id * -1; // Temporary negative ID
            $fakeTrack->setRelation('user', $att->user);
            $tracks->push($fakeTrack);
        }

        $now = now();
        $activeCount = 0;
        $idleCount = 0;
        $offlineCount = 0;
        $lowBatteryCount = 0;

        // Transform and add realtime metrics
        $transformedTracks = $tracks->map(function ($track) use ($now, &$activeCount, &$idleCount, &$offlineCount, &$lowBatteryCount) {
            if ($track->user) {
                $track->user->profile_photo_url = $track->user->profile_photo_url;
            }

            $recordedAt = Carbon::parse($track->recorded_at);
            $diffMinutes = (int) round($recordedAt->diffInMinutes($now));

            // Determine status
            if ($diffMinutes <= 5) {
                $status = 'active'; // Online & Aktif
                $statusLabel = 'Aktif (Online)';
                $activeCount++;
            } elseif ($diffMinutes <= 30) {
                $status = 'idle'; // Diam
                $statusLabel = 'Diam (Idle)';
                $idleCount++;
            } else {
                $status = 'offline'; // Tidak aktif
                $statusLabel = 'Offline';
                $offlineCount++;
            }

            if ($track->battery_level !== null && $track->battery_level <= 20) {
                $lowBatteryCount++;
            }

            $track->status = $status;
            $track->status_label = $statusLabel;
            $track->minutes_ago = $diffMinutes;
            $track->formatted_time = $recordedAt->format('H:i');

            return $track;
        });

        // Filter by status if specified
        if ($request->filled('status') && in_array($request->status, ['active', 'idle', 'offline'])) {
            $transformedTracks = $transformedTracks->where('status', $request->status)->values();
        }

        return response()->json([
            'status' => 'success',
            'data' => $transformedTracks,
            'summary' => [
                'total_tracked' => $tracks->count(),
                'active_count' => $activeCount,
                'idle_count' => $idleCount,
                'offline_count' => $offlineCount,
                'low_battery_count' => $lowBatteryCount,
            ]
        ]);
    }

    /**
     * Get track history for a specific user today
     */
    public function history(Request $request, $userId)
    {
        $user = $request->user();

        // Security check: Only Super Admin can access live tracking history
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');
        if (! $isSuperAdmin && ! $user->hasPermission('view-live-tracking')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak. Fitur Live Tracking hanya untuk Super Admin.',
            ], 403);
        }

        if ($user->company_id && !$user->canAccessAllCompanies()) {
            $targetUser = User::find($userId);
            if (!$targetUser || $targetUser->company_id !== $user->company_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Unauthorized'
                ], 403);
            }
        }

        $date = $request->get('date', Carbon::today()->toDateString());

        $tracks = EmployeeTrack::where('user_id', $userId)
            ->whereDate('recorded_at', $date)
            ->orderBy('recorded_at', 'asc')
            ->get();

        // Calculate total distance traveled (Haversine formula in KM)
        $totalDistanceKm = 0;
        for ($i = 0; $i < count($tracks) - 1; $i++) {
            $lat1 = deg2rad((float)$tracks[$i]->latitude);
            $lon1 = deg2rad((float)$tracks[$i]->longitude);
            $lat2 = deg2rad((float)$tracks[$i + 1]->latitude);
            $lon2 = deg2rad((float)$tracks[$i + 1]->longitude);

            $dlat = $lat2 - $lat1;
            $dlon = $lon2 - $lon1;

            $a = sin($dlat / 2) * sin($dlat / 2) +
                 cos($lat1) * cos($lat2) *
                 sin($dlon / 2) * sin($dlon / 2);
            $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
            $r = 6371; // Earth radius in km

            $totalDistanceKm += ($r * $c);
        }

        $firstPoint = $tracks->first();
        $lastPoint = $tracks->last();
        $durationMinutes = ($firstPoint && $lastPoint) 
            ? Carbon::parse($firstPoint->recorded_at)->diffInMinutes(Carbon::parse($lastPoint->recorded_at))
            : 0;

        return response()->json([
            'status' => 'success',
            'data' => $tracks,
            'summary' => [
                'total_points' => $tracks->count(),
                'total_distance_km' => round($totalDistanceKm, 2),
                'duration_minutes' => $durationMinutes,
                'start_time' => $firstPoint ? Carbon::parse($firstPoint->recorded_at)->format('H:i') : null,
                'last_time' => $lastPoint ? Carbon::parse($lastPoint->recorded_at)->format('H:i') : null,
            ]
        ]);
    }

    /**
     * Get user's own live tracking status for mobile app
     */
    public function myStatus(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'status' => 'success',
            'is_tracking_enabled' => (bool)($user->is_tracking_enabled ?? true),
        ]);
    }

    /**
     * Get Tracking Configuration Settings (Divisions and Employees) for Super Admin
     */
    public function getSettings(Request $request)
    {
        $user = $request->user();
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');
        if (! $isSuperAdmin && ! $user->hasPermission('view-live-tracking')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak. Fitur ini hanya untuk Super Admin.',
            ], 403);
        }

        // Get roles/divisions with stats
        $rolesQuery = \App\Models\Role::withCount(['users' => function ($q) use ($user) {
            if ($user->company_id && !$user->canAccessAllCompanies()) {
                $q->where('company_id', $user->company_id);
            }
        }]);

        $roles = $rolesQuery->get()->map(function ($role) use ($user) {
            $userQuery = User::where('role_id', $role->id);
            if ($user->company_id && !$user->canAccessAllCompanies()) {
                $userQuery->where('company_id', $user->company_id);
            }
            $enabledCount = (clone $userQuery)->where('is_tracking_enabled', true)->count();
            $totalCount = $userQuery->count();

            return [
                'id' => $role->id,
                'name' => $role->name,
                'is_tracking_enabled' => (bool)($role->is_tracking_enabled ?? true),
                'total_users' => $totalCount,
                'enabled_users' => $enabledCount,
                'disabled_users' => $totalCount - $enabledCount,
            ];
        });

        // Get individual users
        $usersQuery = User::with(['role:id,name', 'company:id,name', 'office:id,name'])
            ->select('id', 'name', 'nik', 'email', 'phone', 'profile_photo_path', 'company_id', 'role_id', 'office_id', 'is_tracking_enabled');

        if ($user->company_id && !$user->canAccessAllCompanies()) {
            $usersQuery->where('company_id', $user->company_id);
        }

        if ($request->filled('role_id') && $request->role_id !== 'all') {
            $usersQuery->where('role_id', $request->role_id);
        }

        if ($request->filled('status') && in_array($request->status, ['enabled', 'disabled'])) {
            $usersQuery->where('is_tracking_enabled', $request->status === 'enabled');
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $usersQuery->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('nik', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $usersQuery->orderBy('name')->get()->map(function ($u) {
            $u->is_tracking_enabled = (bool)($u->is_tracking_enabled ?? true);
            return $u;
        });

        $totalUsers = User::when($user->company_id && !$user->canAccessAllCompanies(), fn($q) => $q->where('company_id', $user->company_id))->count();
        $totalEnabled = User::when($user->company_id && !$user->canAccessAllCompanies(), fn($q) => $q->where('company_id', $user->company_id))->where('is_tracking_enabled', true)->count();

        return response()->json([
            'status' => 'success',
            'data' => [
                'roles' => $roles,
                'users' => $users,
                'summary' => [
                    'total_users' => $totalUsers,
                    'total_enabled' => $totalEnabled,
                    'total_disabled' => $totalUsers - $totalEnabled,
                ]
            ]
        ]);
    }

    /**
     * Toggle tracking for a single user
     */
    public function toggleUser(Request $request, $userId)
    {
        $user = $request->user();
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');
        if (! $isSuperAdmin && ! $user->hasPermission('view-live-tracking')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak.',
            ], 403);
        }

        $targetUser = User::when($user->company_id && !$user->canAccessAllCompanies(), fn($q) => $q->where('company_id', $user->company_id))->findOrFail($userId);

        $newStatus = $request->has('is_tracking_enabled') 
            ? (bool)$request->is_tracking_enabled 
            : !($targetUser->is_tracking_enabled ?? true);

        $targetUser->update(['is_tracking_enabled' => $newStatus]);

        \App\Models\ActivityLog::create([
            'company_id' => $targetUser->company_id,
            'user_id' => $user->id,
            'action' => 'UPDATE_TRACKING_SETTING',
            'description' => "Super Admin {$user->name} mengubah status live tracking user {$targetUser->name} menjadi: " . ($newStatus ? 'AKTIF' : 'NONAKTIF'),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "Live tracking untuk {$targetUser->name} berhasil " . ($newStatus ? 'diaktifkan' : 'dinonaktifkan'),
            'data' => [
                'user_id' => $targetUser->id,
                'is_tracking_enabled' => $newStatus,
            ]
        ]);
    }

    /**
     * Toggle tracking for an entire role/division
     */
    public function toggleRole(Request $request, $roleId)
    {
        $user = $request->user();
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');
        if (! $isSuperAdmin && ! $user->hasPermission('view-live-tracking')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak.',
            ], 403);
        }

        $role = \App\Models\Role::findOrFail($roleId);

        $newStatus = $request->has('is_tracking_enabled') 
            ? (bool)$request->is_tracking_enabled 
            : !($role->is_tracking_enabled ?? true);

        $role->update(['is_tracking_enabled' => $newStatus]);

        // Bulk update users in that role
        $usersQuery = User::where('role_id', $roleId);
        if ($user->company_id && !$user->canAccessAllCompanies()) {
            $usersQuery->where('company_id', $user->company_id);
        }
        $affected = $usersQuery->update(['is_tracking_enabled' => $newStatus]);

        \App\Models\ActivityLog::create([
            'company_id' => $user->company_id,
            'user_id' => $user->id,
            'action' => 'UPDATE_ROLE_TRACKING_SETTING',
            'description' => "Super Admin {$user->name} mengubah status live tracking divisi {$role->name} ({$affected} pegawai) menjadi: " . ($newStatus ? 'AKTIF' : 'NONAKTIF'),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "Live tracking divisi {$role->name} ({$affected} pegawai) berhasil " . ($newStatus ? 'diaktifkan' : 'dinonaktifkan'),
            'data' => [
                'role_id' => $role->id,
                'is_tracking_enabled' => $newStatus,
                'affected_users' => $affected,
            ]
        ]);
    }

    /**
     * Bulk update tracking status for multiple users or roles
     */
    public function bulkUpdate(Request $request)
    {
        $user = $request->user();
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');
        if (! $isSuperAdmin && ! $user->hasPermission('view-live-tracking')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak.',
            ], 403);
        }

        $request->validate([
            'is_tracking_enabled' => 'required|boolean',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'integer|exists:users,id',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'integer|exists:roles,id',
        ]);

        $status = (bool)$request->is_tracking_enabled;
        $totalAffected = 0;

        if (!empty($request->user_ids)) {
            $query = User::whereIn('id', $request->user_ids);
            if ($user->company_id && !$user->canAccessAllCompanies()) {
                $query->where('company_id', $user->company_id);
            }
            $totalAffected += $query->update(['is_tracking_enabled' => $status]);
        }

        if (!empty($request->role_ids)) {
            \App\Models\Role::whereIn('id', $request->role_ids)->update(['is_tracking_enabled' => $status]);
            $query = User::whereIn('role_id', $request->role_ids);
            if ($user->company_id && !$user->canAccessAllCompanies()) {
                $query->where('company_id', $user->company_id);
            }
            $totalAffected += $query->update(['is_tracking_enabled' => $status]);
        }

        return response()->json([
            'status' => 'success',
            'message' => "Pengaturan live tracking berhasil diperbarui untuk {$totalAffected} pegawai.",
            'data' => [
                'is_tracking_enabled' => $status,
                'affected_count' => $totalAffected,
            ]
        ]);
    }
}
