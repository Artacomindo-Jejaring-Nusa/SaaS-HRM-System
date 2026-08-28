<?php

namespace App\Http\Controllers;

use App\Models\EmployeeTrack;
use Illuminate\Http\Request;
use Carbon\Carbon;

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

        $track = EmployeeTrack::create([
            'user_id' => $request->user()->id,
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
            'accuracy' => $request->accuracy,
            'battery_level' => $request->battery_level,
            'recorded_at' => $request->recorded_at ? Carbon::parse($request->recorded_at) : now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Location updated successfully',
            'data' => $track
        ]);
    }

    /**
     * Get live tracking for Dashboard
     * Returns the latest location per user for today
     */
    public function live(Request $request)
    {
        $user = $request->user();
        $today = Carbon::today();
        
        $query = EmployeeTrack::with('user:id,name,nik,profile_photo_path')
            ->whereDate('recorded_at', $today)
            ->whereIn('id', function ($query) use ($today) {
                $query->selectRaw('MAX(id)')
                      ->from('employee_tracks')
                      ->whereDate('recorded_at', $today)
                      ->groupBy('user_id');
            });

        if ($user->company_id && !$user->canAccessAllCompanies()) {
            $query->whereHas('user', function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            });
        }

        $tracks = $query->get();

        // Map to include profile_photo_url instead of path
        $tracks->transform(function ($track) {
            if ($track->user) {
                $track->user->profile_photo_url = $track->user->profile_photo_url; // Use Laravel Jetstream accessor
            }
            return $track;
        });

        return response()->json([
            'status' => 'success',
            'data' => $tracks
        ]);
    }

    /**
     * Get track history for a specific user today
     */
    public function history(Request $request, $userId)
    {
        $user = $request->user();

        if ($user->company_id && !$user->canAccessAllCompanies()) {
            $targetUser = \App\Models\User::find($userId);
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

        return response()->json([
            'status' => 'success',
            'data' => $tracks
        ]);
    }
}
