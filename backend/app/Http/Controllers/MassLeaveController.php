<?php

namespace App\Http\Controllers;

use App\Models\MassLeave;
use App\Models\User;
use App\Traits\Notifiable;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MassLeaveController extends Controller
{
    use Notifiable;

    public function index(Request $request)
    {
        $massLeaves = MassLeave::where('company_id', $request->user()->company_id)
            ->orderBy('start_date', 'desc')
            ->paginate(10);

        return $this->successResponse($massLeaves, 'Daftar cuti bersama berhasil diambil.');
    }

    public function store(Request $request)
    {
        abort_if(! $request->user()->hasPermission('approve-leaves'), 403, 'Akses ditolak.');

        $request->validate([
            'name' => 'required|string',
            'type' => 'required|string',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'is_deduction' => 'required|boolean',
            'all_employees' => 'required|boolean',
            'employee_ids' => 'nullable|array',
        ]);

        return DB::transaction(function () use ($request) {
            $massLeave = MassLeave::create([
                'company_id' => $request->user()->company_id,
                'name' => $request->name,
                'type' => $request->type,
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'is_deduction' => $request->is_deduction,
                'all_employees' => $request->all_employees,
                'employee_ids' => $request->employee_ids,
            ]);

            $days = Carbon::parse($request->start_date)->diffInDays(Carbon::parse($request->end_date)) + 1;

            $query = User::where('company_id', $request->user()->company_id);
            if (! $request->all_employees && ! empty($request->employee_ids)) {
                $query->whereIn('id', $request->employee_ids);
            }

            if ($request->is_deduction) {
                $query->decrement('leave_balance', $days);
            }

            // Notify employees
            $employees = $query->get();
            $deductionText = $request->is_deduction ? ' (Memotong saldo cuti tahunan)' : '';

            foreach ($employees as $employee) {
                $this->notify(
                    $employee,
                    "CUTI BERSAMA: {$request->name}",
                    "Halo {$employee->name}, terdapat informasi Cuti Bersama: *{$request->name}* dari tanggal {$request->start_date} s/d {$request->end_date}.{$deductionText}",
                    'info',
                    '/dashboard/leave',
                    'mail',
                    true,
                    true
                );
            }

            $this->logActivity('CREATE_MASS_LEAVE', "Membuat cuti bersama: {$request->name}");

            return $this->successResponse($massLeave, 'Cuti bersama berhasil dibuat.', 201);
        });
    }

    public function destroy(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('approve-leaves'), 403, 'Akses ditolak.');

        $massLeave = MassLeave::where('company_id', $request->user()->company_id)->findOrFail($id);

        return DB::transaction(function () use ($massLeave) {
            // If it was deduction, we should probably restore?
            // GreatDay behavior varies, but usually deleting a mass leave restores quota if it was a mistake.
            if ($massLeave->is_deduction) {
                $days = Carbon::parse($massLeave->start_date)->diffInDays(Carbon::parse($massLeave->end_date)) + 1;

                $query = User::where('company_id', $massLeave->company_id);

                if (! $massLeave->all_employees && ! empty($massLeave->employee_ids)) {
                    $query->whereIn('id', $massLeave->employee_ids);
                }

                $query->increment('leave_balance', $days);
            }

            $massLeave->delete();

            return $this->successResponse(null, 'Cuti bersama berhasil dihapus.');
        });
    }
}
