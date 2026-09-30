<?php

namespace App\Http\Controllers;

use App\Models\Shift;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    private const MSG_FORBIDDEN = 'Akses ditolak.';

    public function index(Request $request)
    {
        $query = Shift::query();
        $user = $request->user();

        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        }

        $perPage = (int) ($request->per_page ?? 100);
        $shifts = $query->orderBy('start_time')->paginate($perPage);

        return $this->successResponse($shifts, 'Daftar shift berhasil diambil.');
    }

    public function store(Request $request)
    {
        $authUser = $request->user();
        abort_if(! $authUser->hasPermission('manage-shifts') && ! $authUser->canAccessAllCompanies(), 403, self::MSG_FORBIDDEN);

        $request->validate([
            'name' => 'required|string',
            'start_time' => 'required',
            'end_time' => 'required',
        ]);

        $companyId = $authUser->company_id ?? $request->company_id ?? \App\Models\Company::first()?->id;

        $shift = Shift::create([
            'company_id' => $companyId,
            'name' => $request->name,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
        ]);

        return $this->successResponse($shift, 'Shift berhasil dibuat.', 201);
    }

    public function update(Request $request, $id)
    {
        $authUser = $request->user();
        abort_if(! $authUser->hasPermission('manage-shifts') && ! $authUser->canAccessAllCompanies(), 403, self::MSG_FORBIDDEN);

        $shift = Shift::findOrFail($id);
        if ($authUser->company_id && ! $authUser->canAccessAllCompanies() && $shift->company_id !== $authUser->company_id) {
            return $this->errorResponse('Akses ditolak.', 403);
        }

        $shift->update($request->only(['name', 'start_time', 'end_time']));

        return $this->successResponse($shift, 'Shift berhasil diperbarui.');
    }

    public function destroy(Request $request, $id)
    {
        $authUser = $request->user();
        abort_if(! $authUser->hasPermission('manage-shifts') && ! $authUser->canAccessAllCompanies(), 403, self::MSG_FORBIDDEN);

        $shift = Shift::findOrFail($id);
        if ($authUser->company_id && ! $authUser->canAccessAllCompanies() && $shift->company_id !== $authUser->company_id) {
            return $this->errorResponse('Akses ditolak.', 403);
        }

        $shift->delete();

        return $this->successResponse(null, 'Shift berhasil dihapus.');
    }
}
