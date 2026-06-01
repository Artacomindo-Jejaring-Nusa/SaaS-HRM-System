<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $query = ActivityLog::where('company_id', $request->user()->company_id)
            ->with('user:id,name,profile_photo_path');

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

        // Filter by module (e.g., 'payroll', 'attendance', 'employee')
        if ($request->module) {
            $query->where('module', $request->module);
        }

        // Filter by specific user
        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        // Filter by date range
        if ($request->start_date && $request->end_date) {
            $query->whereBetween('created_at', [$request->start_date.' 00:00:00', $request->end_date.' 23:59:59']);
        }

        $logs = $query->orderBy('id', 'desc')->paginate($request->per_page ?? 20);

        return $this->successResponse($logs, 'Riwayat aktivitas berhasil diambil.');
    }

    /**
     * Get available modules and action types for filter dropdowns.
     */
    public function filters(Request $request)
    {
        $companyId = $request->user()->company_id;

        $modules = ActivityLog::where('company_id', $companyId)
            ->whereNotNull('module')
            ->distinct()
            ->pluck('module');

        $actions = ActivityLog::where('company_id', $companyId)
            ->distinct()
            ->pluck('action');

        return $this->successResponse([
            'modules' => $modules,
            'actions' => $actions,
        ]);
    }

    /**
     * Export audit logs as CSV for compliance reporting.
     */
    public function export(Request $request)
    {
        $query = ActivityLog::where('company_id', $request->user()->company_id)
            ->with('user:id,name');

        if ($request->start_date && $request->end_date) {
            $query->whereBetween('created_at', [$request->start_date.' 00:00:00', $request->end_date.' 23:59:59']);
        }

        if ($request->module) {
            $query->where('module', $request->module);
        }

        $logs = $query->orderBy('id', 'desc')->limit(5000)->get();

        $csvData = "ID,Waktu,User,Aksi,Modul,Deskripsi,IP Address,User Agent\n";
        foreach ($logs as $log) {
            $csvData .= implode(',', [
                $log->id,
                '"' . $log->created_at . '"',
                '"' . ($log->user->name ?? 'System') . '"',
                '"' . $log->action . '"',
                '"' . ($log->module ?? '-') . '"',
                '"' . str_replace('"', '""', $log->description ?? '') . '"',
                '"' . ($log->ip_address ?? '-') . '"',
                '"' . str_replace('"', '""', substr($log->user_agent ?? '-', 0, 100)) . '"',
            ]) . "\n";
        }

        return response($csvData, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="audit_log_' . now()->format('Y-m-d') . '.csv"',
        ]);
    }
}
