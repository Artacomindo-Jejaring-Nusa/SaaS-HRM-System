<?php

namespace App\Http\Controllers;

use App\Exports\ShiftSwapExport;
use App\Models\Schedule;
use App\Models\ShiftSwap;
use App\Models\User;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;

class ShiftSwapController extends Controller
{
    use Notifiable;

    public function index(Request $request)
    {
        if (! $request->user()->hasPermission('view-shift-swaps')) {
            return response()->json(['status' => 'error', 'message' => 'Anda tidak memiliki hak akses untuk melihat data ini.'], 403);
        }
        $user = $request->user();
        $query = ShiftSwap::with(['requester', 'receiver', 'requesterSchedule.shift', 'receiverSchedule.shift'])
            ->where('company_id', $user->company_id);

        if (! $user->is_manager) {
            $query->where(function ($q) use ($user) {
                $q->where('requester_id', $user->id)
                    ->orWhere('receiver_id', $user->id);
            });
        }

        return response()->json([
            'status' => 'success',
            'data' => $query->orderBy('created_at', 'desc')->paginate(10),
        ]);
    }

    public function store(Request $request)
    {
        if (! $request->user()->hasPermission('apply-shift-swaps')) {
            return response()->json(['status' => 'error', 'message' => 'Anda tidak memiliki hak akses untuk mengajukan tukar shift.'], 403);
        }
        $request->validate([
            'receiver_id' => 'required|exists:users,id',
            'requester_schedule_id' => 'required|exists:schedules,id',
            'receiver_schedule_id' => 'required|exists:schedules,id',
            'reason' => 'required|string',
        ]);

        $user = $request->user();

        // 1. Cek validasi jadwal milik A dan B
        $reqSched = Schedule::find($request->requester_schedule_id);
        $resSched = Schedule::find($request->receiver_schedule_id);

        if ($reqSched->user_id !== $user->id) {
            return response()->json(['status' => 'error', 'message' => 'Jadwal asal bukan milik Anda.'], 403);
        }

        if ($resSched->user_id != $request->receiver_id) {
            return response()->json(['status' => 'error', 'message' => 'Jadwal tujuan bukan milik penerima.'], 400);
        }

        $swap = ShiftSwap::create([
            'company_id' => $user->company_id,
            'requester_id' => $user->id,
            'receiver_id' => $request->receiver_id,
            'requester_schedule_id' => $request->requester_schedule_id,
            'receiver_schedule_id' => $request->receiver_schedule_id,
            'reason' => $request->reason,
            'status' => 'pending_receiver',
        ]);

        // Kirim Notifikasi ke Receiver
        $receiver = User::find($request->receiver_id);
        $this->notify(
            $receiver,
            'PENGAJUAN TUKAR SHIFT',
            "{$user->name} mengajak Anda tukar shift pada tanggal {$reqSched->date} dengan jadwal {$resSched->date}.",
            'info',
            '/dashboard/shift-swap'
        );

        return response()->json(['status' => 'success', 'data' => $swap, 'message' => 'Permintaan tukar shift dikirim.']);
    }

    public function respond(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:approved_by_receiver,rejected',
            'remark' => 'nullable|string',
        ]);

        $swap = ShiftSwap::with(['requester', 'receiver', 'requesterSchedule.shift', 'receiverSchedule.shift'])->findOrFail($id);
        if ($swap->receiver_id !== $request->user()->id) {
            return response()->json(['status' => 'error', 'message' => 'Akses ditolak.'], 403);
        }

        $swap->update([
            'status' => $request->status === 'approved_by_receiver' ? 'pending_manager' : 'rejected',
            'remark' => $request->remark,
        ]);

        // Notifikasi ke Requester
        $this->notify(
            $swap->requester,
            'TUKAR SHIFT '.($request->status === 'approved_by_receiver' ? 'DITERIMA' : 'DITOLAK'),
            'Penerima ('.$swap->receiver->name.') telah '.($request->status === 'approved_by_receiver' ? 'menerima' : 'menolak').' permintaan tukar shift Anda.',
            $request->status === 'approved_by_receiver' ? 'success' : 'danger'
        );

        // Jika diterima receiver, notify manager / supervisor
        if ($request->status === 'approved_by_receiver') {
            // 1. Prioritaskan Supervisor langsung si peminta
            $approver = null;
            if ($swap->requester->supervisor_id) {
                $approver = User::find($swap->requester->supervisor_id);
            }

            // 2. Jika tidak ada supervisor, cari user yang punya role 'Manager' atau 'Supervisor'
            if (! $approver) {
                $approver = User::where('company_id', $swap->company_id)
                    ->whereHas('role', function ($q) {
                        $q->whereIn('name', ['Manager', 'Supervisor', 'HRD', 'Management']);
                    })
                    ->first();
            }

            if ($approver) {
                $this->notify($approver, 'APPROVAL TUKAR SHIFT', "Ada permintaan tukar shift antara {$swap->requester->name} dan {$swap->receiver->name} menunggu persetujuan Anda.", 'warning');
            }
        }

        return response()->json(['status' => 'success', 'message' => 'Status berhasil diupdate.']);
    }

    public function approve(Request $request, $id)
    {
        if (! $request->user()->hasPermission('approve-shift-swaps')) {
            return response()->json(['status' => 'error', 'message' => 'Hanya Atasan/Manager yang dapat menyetujui tukar shift.'], 403);
        }
        $request->validate(['status' => 'required|in:approved,rejected']);

        $swap = ShiftSwap::findOrFail($id);

        // Security: Hanya Manager/Supervisor
        if (! $request->user()->is_manager) {
            return response()->json(['status' => 'error', 'message' => 'Hanya Manager yang dapat melakukan approval.'], 403);
        }

        DB::beginTransaction();
        try {
            if ($request->status === 'approved') {
                $swap->update([
                    'status' => 'approved',
                    'approved_by' => $request->user()->id,
                ]);

                // PROSES SWAP: Tukar shift_id di tabel schedules
                $reqSched = Schedule::find($swap->requester_schedule_id);
                $resSched = Schedule::find($swap->receiver_schedule_id);

                $tempShiftId = $reqSched->shift_id;
                $reqSched->update(['shift_id' => $resSched->shift_id]);
                $resSched->update(['shift_id' => $tempShiftId]);

                $msg = 'Permintaan tukar shift telah disetujui Manager. Jadwal sudah diperbarui.';
            } else {
                $swap->update(['status' => 'rejected']);
                $msg = 'Permintaan tukar shift ditolak oleh Manager.';
            }

            DB::commit();

            // Notify both parties
            $this->notify($swap->requester, 'FINAL TUKAR SHIFT', $msg, $request->status === 'approved' ? 'success' : 'danger');
            $this->notify($swap->receiver, 'FINAL TUKAR SHIFT', $msg, $request->status === 'approved' ? 'success' : 'danger');

            return response()->json(['status' => 'success', 'message' => $msg]);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(['status' => 'error', 'message' => 'Gagal memproses swap: '.$e->getMessage()], 500);
        }
    }

    public function report(Request $request)
    {
        if (! $request->user()->hasPermission('view-shift-swap-reports')) {
            return response()->json(['status' => 'error', 'message' => 'Hanya HRD/Manager yang dapat melihat laporan audit ini.'], 403);
        }
        $query = ShiftSwap::with(['requester', 'receiver', 'approver', 'requesterSchedule.shift', 'receiverSchedule.shift'])
            ->where(function ($q) use ($request) {
                $q->whereHas('requester', function ($sq) use ($request) {
                    $sq->where('company_id', $request->user()->company_id);
                })->orWhereHas('receiver', function ($sq) use ($request) {
                    $sq->where('company_id', $request->user()->company_id);
                });
            });

        if ($request->start_date) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->end_date) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }
        if ($request->user_id) {
            $query->where(function ($q) use ($request) {
                $q->where('requester_id', $request->user_id)
                    ->orWhere('receiver_id', $request->user_id);
            });
        }
        if ($request->status) {
            $query->where('status', $request->status);
        }

        $report = $query->latest()->paginate($request->per_page ?? 10);

        return response()->json(['status' => 'success', 'data' => $report]);
    }

    public function export(Request $request)
    {
        if (! $request->user()->hasPermission('export-shift-swaps')) {
            return response()->json(['status' => 'error', 'message' => 'Anda tidak memiliki hak akses untuk mengunduh laporan ini.'], 403);
        }
        $user = $request->user();
        $fileName = 'Laporan_Tukar_Shift_'.now()->format('Y_m_d_His').'.xlsx';

        return Excel::download(
            new ShiftSwapExport(
                $user->company_id,
                $request->user_id,
                $request->start_date,
                $request->end_date,
                $request->status
            ),
            $fileName
        );
    }
}
