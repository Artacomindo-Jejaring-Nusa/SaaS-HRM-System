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

        $shifts = $query->paginate(10);

        return $this->successResponse($shifts, 'Daftar shift berhasil diambil.');
    }

    public function store(Request $request)
    {
        abort_if(! $request->user()->hasPermission('manage-shifts'), 403, self::MSG_FORBIDDEN);
        $request->validate([
            'name' => 'required|string',
            'start_time' => 'required',
            'end_time' => 'required',
        ]);

        $shift = Shift::create([
            'company_id' => $request->user()->company_id,
            'name' => $request->name,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
        ]);

        return $this->successResponse($shift, 'Shift berhasil dibuat.', 201);
    }

    public function update(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('manage-shifts'), 403, self::MSG_FORBIDDEN);
        $shift = Shift::findOrFail($id);
        $shift->update($request->all());

        return $this->successResponse($shift, 'Shift berhasil diperbarui.');
    }

    public function destroy(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('manage-shifts'), 403, self::MSG_FORBIDDEN);
        $shift = Shift::findOrFail($id);
        $shift->delete();

        return $this->successResponse(null, 'Shift berhasil dihapus.');
    }
}
