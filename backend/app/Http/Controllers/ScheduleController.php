<?php

namespace App\Http\Controllers;

use App\Exports\ScheduleExport;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class ScheduleController extends Controller
{
    public function index(Request $request)
    {
        $query = Schedule::with(['user', 'shift']);

        // Filter by company's users
        $user = $request->user();

        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->whereHas('user', function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            });
        }

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->date) {
            $query->where('date', $request->date);
        } elseif ($request->start_date && $request->end_date) {
            $query->whereBetween('date', [$request->start_date, $request->end_date]);
        } elseif ($request->month && $request->year) {
            $query->whereMonth('date', $request->month)
                ->whereYear('date', $request->year);
        } else {
            // Default: Show only from current year onwards
            $query->whereYear('date', '>=', now()->year);
        }

        return $this->successResponse($query->paginate($request->per_page ?? 10), 'Daftar jadwal berhasil diambil.');
    }

    public function store(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'shift_id' => 'required|exists:shifts,id',
            'date' => 'required|date',
        ]);

        // Cek apakah user ada di perusahaan yang sama
        $user = User::findOrFail($request->user_id);
        if ($user->company_id !== $request->user()->company_id) {
            return $this->errorResponse('Anda tidak bisa membuat jadwal untuk karyawan luar perusahaan.', 403);
        }

        $schedule = Schedule::updateOrCreate(
            ['user_id' => $request->user_id, 'date' => $request->date],
            ['shift_id' => $request->shift_id]
        );

        return $this->successResponse($schedule, 'Jadwal berhasil diperbarui.', 201);
    }

    public function destroy($id)
    {
        $schedule = Schedule::findOrFail($id);
        $schedule->delete();

        return $this->successResponse(null, 'Jadwal berhasil dihapus.');
    }

    public function export(Request $request)
    {
        $user = $request->user();
        $fileName = 'schedule_report_'.now()->format('Y_m_d_His').'.xlsx';

        return Excel::download(
            new ScheduleExport(
                $user->company_id,
                $request->user_id,
                $request->start_date,
                $request->end_date
            ),
            $fileName
        );
    }
}
