<?php

namespace App\Http\Controllers;

use App\Models\Holiday;
use App\Models\User;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class HolidayController extends Controller
{
    use Notifiable;

    private const MSG_FORBIDDEN = 'Akses ditolak.';

    public function index(Request $request)
    {
        $holidays = Holiday::where(function ($q) use ($request) {
            $q->whereNull('company_id') // National
                ->orWhere('company_id', $request->user()->company_id);
        })->orderBy('date', 'asc')->paginate(10);

        return $this->successResponse($holidays, 'Daftar hari libur berhasil diambil.');
    }

    public function store(Request $request)
    {
        abort_if(! $request->user()->hasPermission('manage-holidays'), 403, self::MSG_FORBIDDEN);
        $request->validate([
            'name' => 'required|string',
            'date' => 'required|date',
            'broadcast' => 'nullable|boolean', // Option to broadcast
        ]);

        $holiday = Holiday::create([
            'company_id' => $request->user()->company_id,
            'name' => $request->name,
            'date' => $request->date,
        ]);

        if ($request->broadcast) {
            $members = User::where('company_id', $request->user()->company_id)->get();
            foreach ($members as $member) {
                $this->notify(
                    $member,
                    "HARI LIBUR: {$request->name}",
                    "Halo {$member->name}, terdapat informasi Hari Libur: *{$request->name}* pada tanggal {$request->date}.",
                    'info',
                    null,
                    'notif',
                    true,
                    true
                );
            }
        }

        $this->logActivity('CREATE_HOLIDAY', "Menambahkan hari libur: {$request->name} ({$request->date})", $holiday);

        return $this->successResponse($holiday, 'Hari libur berhasil ditambahkan.', 201);
    }

    public function update(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('manage-holidays'), 403, self::MSG_FORBIDDEN);
        $holiday = Holiday::where('company_id', $request->user()->company_id)->findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string',
            'date' => 'sometimes|date',
        ]);

        $holiday->update($request->all());

        $this->logActivity('UPDATE_HOLIDAY', "Memperbarui hari libur: {$holiday->name}", $holiday);

        return $this->successResponse($holiday, 'Hari libur berhasil diperbarui.');
    }

    public function destroy(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('manage-holidays'), 403, self::MSG_FORBIDDEN);
        $holiday = Holiday::where('company_id', $request->user()->company_id)->findOrFail($id);
        $name = $holiday->name;

        $holiday->delete();

        $this->logActivity('DELETE_HOLIDAY', "Menghapus hari libur: {$name}");

        return $this->successResponse(null, 'Hari libur berhasil dihapus.');
    }
}
