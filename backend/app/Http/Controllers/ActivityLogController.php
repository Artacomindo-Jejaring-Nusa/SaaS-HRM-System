<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $query = ActivityLog::where('company_id', $request->user()->company_id)
            ->with('user');

        // Search by description or user name
        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('description', 'like', "%{$request->search}%")
                    ->orWhere('action', 'like', "%{$request->search}%")
                    ->orWhereHas('user', function ($qu) use ($request) {
                        $qu->where('name', 'like', "%{$request->search}%");
                    });
            });
        }

        // Filter by action type
        if ($request->action_type) {
            $query->where('action', $request->action_type);
        }

        // Filter by date range
        if ($request->start_date && $request->end_date) {
            $query->whereBetween('created_at', [$request->start_date.' 00:00:00', $request->end_date.' 23:59:59']);
        }

        $logs = $query->orderBy('id', 'desc')->paginate(10);

        return $this->successResponse($logs, 'Riwayat aktivitas berhasil diambil.');
    }
}
