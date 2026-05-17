<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\VehicleLog;
use App\Traits\Notifiable;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;

class VehicleLogController extends Controller
{
    use Notifiable;

    private const MSG_FORBIDDEN = 'Akses ditolak.';
    private const URL_FLEET_LOGS = '/dashboard/fleet-logs';
    private const RULE_NULL_NUM = 'nullable|numeric|min:0';

    /**
     * List all vehicle logs (with data isolation)
     */
    public function index(Request $request)
    {
        $query = VehicleLog::with(['user', 'approver']);
        $user = $request->user();

        if ($user->is_manager) {
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $query->where('company_id', $user->company_id);
            }
        } else {
            $query->where('user_id', $user->id);
        }

        // Filter by status
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filter by plate number
        if ($request->has('plate_number') && $request->plate_number) {
            $query->where('plate_number', 'like', '%'.$request->plate_number.'%');
        }

        // Filter by date range
        if ($request->has('from') && $request->from) {
            $query->whereDate('departure_date', '>=', $request->from);
        }
        if ($request->has('to') && $request->to) {
            $query->whereDate('departure_date', '<=', $request->to);
        }

        $logs = $query->orderBy('id', 'desc')->paginate(10);

        return $this->successResponse($logs, 'Daftar log kendaraan berhasil diambil.');
    }

    /**
     * Show detail of a specific vehicle log
     */
    public function show(Request $request, $id)
    {
        $log = VehicleLog::with(['user', 'approver'])->findOrFail($id);

        return $this->successResponse($log);
    }

    /**
     * Step 1: Record departure (KM Awal + Foto Dashboard)
     */
    public function storeDeparture(Request $request)
    {
        $request->validate([
            'vehicle_name' => 'required|string|max:255',
            'plate_number' => 'required|string|max:20',
            'purpose' => 'required|string|max:500',
            'destination' => 'required|string|max:255',
            'departure_date' => 'required|date',
            'odometer_start' => 'required|integer|min:0',
            'odometer_start_photo' => 'nullable|image|max:10240',
            'notes' => 'nullable|string',
        ]);

        $photoPath = null;
        if ($request->hasFile('odometer_start_photo')) {
            $file = $request->file('odometer_start_photo');
            $photoPath = 'vehicle-logs/odometer/'.Str::random(40).'.jpg';

            // Compress and scale (1000px for better odometer readability)
            $img = Image::decode($file);
            $img->scale(width: 1000);
            Storage::disk('public')->put($photoPath, (string) $img->encodeUsingFileExtension('jpg', 80));
        }

        $log = VehicleLog::create([
            'company_id' => $request->user()->company_id,
            'user_id' => $request->user()->id,
            'vehicle_name' => $request->vehicle_name,
            'plate_number' => strtoupper($request->plate_number),
            'purpose' => $request->purpose,
            'destination' => $request->destination,
            'departure_date' => $request->departure_date,
            'odometer_start' => $request->odometer_start,
            'odometer_start_photo' => $photoPath,
            'notes' => $request->notes,
            'status' => 'departure',
        ]);

        // Notify the submitter
        $this->notify(
            $request->user(),
            'LOG KENDARAAN — KEBERANGKATAN',
            "Pencatatan keberangkatan berhasil. Kendaraan {$request->vehicle_name} ({$request->plate_number}) dengan KM Awal {$request->odometer_start} ke {$request->destination}.",
            'info',
            self::URL_FLEET_LOGS
        );

        // Notify Supervisor
        if ($request->user()->supervisor_id) {
            $supervisor = $request->user()->supervisor;
            if ($supervisor) {
                $this->notify(
                    $supervisor,
                    'PENGGUNAAN KENDARAAN BAWAHAN',
                    "Karyawan {$request->user()->name} menggunakan kendaraan {$request->vehicle_name} ({$request->plate_number}) untuk perjalanan dinas ke {$request->destination}.",
                    'warning',
                    self::URL_FLEET_LOGS
                );
            }
        }

        // Notify Admins & HR (Untuk monitoring unit keluar secara real-time)
        $admins = User::where('company_id', $request->user()->company_id)
            ->whereIn('role_id', [7, 2, 10, 8]) // Super Admin, HR, dll
            ->where('id', '!=', $request->user()->id)
            ->where('id', '!=', $request->user()->supervisor_id)
            ->get();

        foreach ($admins as $admin) {
            $this->notify(
                $admin,
                'KENDARAAN DINAS KELUAR',
                "Karyawan {$request->user()->name} baru saja membawa kendaraan {$request->vehicle_name} ({$request->plate_number}) menuju {$request->destination}.",
                'info',
                self::URL_FLEET_LOGS
            );
        }

        $this->logActivity('CREATE_VEHICLE_LOG', "Mencatat keberangkatan kendaraan {$request->vehicle_name} ({$request->plate_number}) ke {$request->destination}", $log);

        return $this->successResponse($log, 'Pencatatan keberangkatan berhasil.', 201);
    }

    /**
     * Step 2: Record return (KM Akhir + Foto Dashboard + Biaya)
     */
    public function storeReturn(Request $request, $id)
    {
        $log = VehicleLog::where('user_id', $request->user()->id)
            ->where('status', 'departure')
            ->findOrFail($id);

        $request->validate([
            'return_date' => 'required|date|after_or_equal:'.Carbon::parse($log->departure_date)->format('Y-m-d'),
            'odometer_end' => 'required|integer|min:'.$log->odometer_start,
            'odometer_end_photo' => 'nullable|image|max:10240',
            'fuel_cost' => self::RULE_NULL_NUM,
            'toll_cost' => self::RULE_NULL_NUM,
            'parking_cost' => self::RULE_NULL_NUM,
            'other_cost' => self::RULE_NULL_NUM,
            'expense_attachments' => 'nullable|array',
            'expense_attachments.*' => 'image|max:10240',
            'notes' => 'nullable|string',
        ]);

        $photoPath = $log->odometer_end_photo;
        if ($request->hasFile('odometer_end_photo')) {
            $file = $request->file('odometer_end_photo');
            $photoPath = 'vehicle-logs/odometer/'.Str::random(40).'.jpg';

            $img = Image::decode($file);
            $img->scale(width: 1000);
            Storage::disk('public')->put($photoPath, (string) $img->encodeUsingFileExtension('jpg', 80));
        }

        // Upload expense attachments (bukti BBM, tol, dll)
        $attachments = [];
        if ($request->hasFile('expense_attachments')) {
            foreach ($request->file('expense_attachments') as $file) {
                $path = 'vehicle-logs/expenses/'.Str::random(40).'.jpg';
                $img = Image::decode($file);
                $img->scale(width: 1000);
                Storage::disk('public')->put($path, (string) $img->encodeUsingFileExtension('jpg', 80));
                $attachments[] = $path;
            }
        }

        $log->update([
            'return_date' => $request->return_date,
            'odometer_end' => $request->odometer_end,
            'odometer_end_photo' => $photoPath,
            'fuel_cost' => $request->fuel_cost ?? 0,
            'toll_cost' => $request->toll_cost ?? 0,
            'parking_cost' => $request->parking_cost ?? 0,
            'other_cost' => $request->other_cost ?? 0,
            'expense_attachments' => count($attachments) > 0 ? $attachments : $log->expense_attachments,
            'notes' => $request->notes ?? $log->notes,
            'status' => 'completed',
        ]);

        $distance = $log->distance;
        $totalCost = $log->total_cost;

        // Notify the submitter
        $this->notify(
            $request->user(),
            'LOG KENDARAAN — SELESAI',
            "Perjalanan dinas selesai dicatat. Jarak tempuh: {$distance} KM. Total biaya: Rp ".number_format((float) $totalCost, 0, ',', '.').'. Menunggu validasi admin.',
            'success',
            self::URL_FLEET_LOGS
        );

        // Notify Supervisor & approvers
        if ($request->user()->supervisor_id) {
            $supervisor = $request->user()->supervisor;
            if ($supervisor) {
                $this->notify(
                    $supervisor,
                    'LOG KENDARAAN SELESAI — PERLU VALIDASI',
                    "Karyawan {$request->user()->name} telah menyelesaikan perjalanan dinas dengan {$log->vehicle_name} ({$log->plate_number}). Jarak: {$distance} KM, Biaya: Rp ".number_format((float) $totalCost, 0, ',', '.').'. Mohon validasi.',
                    'warning',
                    self::URL_FLEET_LOGS
                );
            }
        }

        // Notify Admins
        $admins = User::where('company_id', $request->user()->company_id)
            ->whereIn('role_id', [7, 2, 10, 8])
            ->where('id', '!=', $request->user()->id)
            ->where('id', '!=', $request->user()->supervisor_id)
            ->get();

        foreach ($admins as $admin) {
            $this->notify(
                $admin,
                'LOG KENDARAAN SELESAI (ADMIN)',
                "Karyawan {$request->user()->name} menyelesaikan perjalanan dengan {$log->vehicle_name}. Jarak: {$distance} KM, Biaya: Rp ".number_format((float) $totalCost, 0, ',', '.'),
                'warning',
                self::URL_FLEET_LOGS
            );
        }

        $this->logActivity('COMPLETE_VEHICLE_LOG', "Menyelesaikan log kendaraan {$log->vehicle_name} ({$log->plate_number}), jarak {$distance} KM", $log);

        return $this->successResponse($log, 'Pencatatan kepulangan berhasil.');
    }

    /**
     * Approve a completed vehicle log
     */
    public function approve(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('approve-vehicle-logs'), 403, self::MSG_FORBIDDEN);

        $log = VehicleLog::with('user')->findOrFail($id);

        if ($log->status !== 'completed') {
            return $this->errorResponse('Hanya log dengan status "completed" yang bisa disetujui.', 422);
        }

        $log->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'remark' => $request->remark,
        ]);

        $msg = "Log kendaraan Anda ({$log->vehicle_name} - {$log->plate_number}) telah DISETUJUI/DIVALIDASI.";
        if ($request->remark) {
            $msg .= " Catatan: {$request->remark}";
        }

        $this->notify(
            $log->user,
            'LOG KENDARAAN DIVALIDASI',
            $msg,
            'success',
            self::URL_FLEET_LOGS
        );

        $this->logActivity('APPROVE_VEHICLE_LOG', "Menyetujui log kendaraan {$log->vehicle_name} dari {$log->user->name}, jarak {$log->distance} KM", $log);

        return $this->successResponse($log, 'Log kendaraan berhasil divalidasi.');
    }

    /**
     * Reject a completed vehicle log
     */
    public function reject(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('approve-vehicle-logs'), 403, self::MSG_FORBIDDEN);

        $log = VehicleLog::with('user')->findOrFail($id);

        if ($log->status !== 'completed') {
            return $this->errorResponse('Hanya log dengan status "completed" yang bisa ditolak.', 422);
        }

        $log->update([
            'status' => 'rejected',
            'approved_by' => $request->user()->id,
            'remark' => $request->remark,
        ]);

        $msg = "Log kendaraan Anda ({$log->vehicle_name} - {$log->plate_number}) DITOLAK.";
        if ($request->remark) {
            $msg .= " Alasan: {$request->remark}";
        }

        $this->notify(
            $log->user,
            'LOG KENDARAAN DITOLAK',
            $msg,
            'danger',
            self::URL_FLEET_LOGS
        );

        $this->logActivity('REJECT_VEHICLE_LOG', "Menolak log kendaraan {$log->vehicle_name} dari {$log->user->name}", $log);

        return $this->successResponse($log, 'Log kendaraan ditolak.');
    }

    /**
     * Delete a vehicle log (only departure status)
     */
    public function destroy(Request $request, $id)
    {
        $log = VehicleLog::findOrFail($id);

        // Only owner can delete their own departure logs, or admin can delete
        if ($log->user_id !== $request->user()->id && ! $request->user()->hasPermission('approve-vehicle-logs')) {
            return $this->errorResponse(self::MSG_FORBIDDEN, 403);
        }

        if (! in_array($log->status, ['departure', 'rejected'])) {
            return $this->errorResponse('Hanya log dengan status keberangkatan atau ditolak yang bisa dihapus.', 403);
        }

        $vehicleName = $log->vehicle_name;
        $plateNumber = $log->plate_number;
        $log->delete();

        $this->logActivity('DELETE_VEHICLE_LOG', "Menghapus log kendaraan {$vehicleName} ({$plateNumber})");

        return $this->successResponse(null, 'Log kendaraan berhasil dihapus.');
    }

    /**
     * Mileage Summary Report — Total jarak & biaya per kendaraan/karyawan
     */
    public function report(Request $request)
    {
        abort_if(! $request->user()->hasPermission('view-vehicle-reports'), 403, self::MSG_FORBIDDEN);

        $query = VehicleLog::with('user')
            ->where('status', 'approved');

        if ($request->user()->company_id && ! $request->user()->canAccessAllCompanies()) {
            $query->where('company_id', $request->user()->company_id);
        }

        if ($request->has('from') && $request->from) {
            $query->whereDate('departure_date', '>=', $request->from);
        }
        if ($request->has('to') && $request->to) {
            $query->whereDate('departure_date', '<=', $request->to);
        }

        // Summary statistics
        $summary = [
            'total_trips' => (clone $query)->count(),
            'total_distance' => (clone $query)->sum('distance'),
            'total_fuel_cost' => (clone $query)->sum('fuel_cost'),
            'total_toll_cost' => (clone $query)->sum('toll_cost'),
            'total_parking_cost' => (clone $query)->sum('parking_cost'),
            'total_other_cost' => (clone $query)->sum('other_cost'),
            'total_cost' => (clone $query)->sum('total_cost'),
        ];

        // Per-vehicle breakdown
        $byVehicle = (clone $query)
            ->selectRaw('plate_number, vehicle_name, COUNT(*) as trips, SUM(distance) as total_km, SUM(total_cost) as total_expense')
            ->groupBy('plate_number', 'vehicle_name')
            ->get();

        // Per-employee breakdown
        $byEmployee = (clone $query)
            ->selectRaw('user_id, COUNT(*) as trips, SUM(distance) as total_km, SUM(total_cost) as total_expense')
            ->groupBy('user_id')
            ->with('user:id,name')
            ->get();

        return $this->successResponse([
            'summary' => $summary,
            'by_vehicle' => $byVehicle,
            'by_employee' => $byEmployee,
        ], 'Laporan mileage berhasil diambil.');
    }

    /**
     * Get list of unique vehicles used by company (for autocomplete)
     */
    public function vehicles(Request $request)
    {
        $vehicles = VehicleLog::where('company_id', $request->user()->company_id)
            ->selectRaw('DISTINCT plate_number, vehicle_name')
            ->orderBy('vehicle_name')
            ->get();

        return $this->successResponse($vehicles, 'Daftar kendaraan berhasil diambil.');
    }
}
