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
    private const DIR_ODOMETER = 'vehicle-logs/odometer/';

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
            } elseif ($request->has('company_id') && $request->company_id) {
                $query->where('company_id', $request->company_id);
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
     * Step 1 (NEW): Request vehicle loan (Pengajuan Peminjaman Kendaraan)
     */
    public function storeRequest(Request $request)
    {
        $request->validate([
            'vehicle_name' => 'required|string|max:255',
            'plate_number' => 'required|string|max:20',
            'purpose' => 'required|string|max:500',
            'destination' => 'required|string|max:255',
            'departure_date' => 'required|date',
            'return_date' => 'required|date|after_or_equal:departure_date',
            'departure_time' => 'nullable|string|max:10',
            'return_time' => 'nullable|string|max:10',
            'driver_type' => 'nullable|in:self,driver',
            'driver_name' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'company_id' => 'nullable|integer|exists:companies,id',
        ]);

        $user = $request->user();
        $companyId = $request->input('company_id') ?: $user->company_id;
        if (! $companyId && $user->canAccessAllCompanies()) {
            $companyId = \App\Models\Company::first()?->id;
        }

        // Check dynamic approval workflow
        $workflowResult = \App\Services\ApprovalService::initApproval('vehicle_log', $companyId, $user);

        $driverType = $request->driver_type ?? 'self';
        $defaultDriverName = $request->driver_name ?: 'Supir Kantor';
        $driverName = $driverType === 'driver' ? $defaultDriverName : $user->name;

        $logData = [
            'company_id' => $companyId,
            'user_id' => $user->id,
            'vehicle_name' => $request->vehicle_name,
            'plate_number' => strtoupper($request->plate_number),
            'purpose' => $request->purpose,
            'destination' => $request->destination,
            'departure_date' => $request->departure_date,
            'return_date' => $request->return_date,
            'departure_time' => $request->departure_time ?: '08:00',
            'return_time' => $request->return_time ?: '17:00',
            'driver_type' => $driverType,
            'driver_name' => $driverName,
            'notes' => $request->notes,
        ];

        if ($workflowResult) {
            $logData['status'] = $workflowResult['status']; // 'pending'
            $logData['current_approval_step'] = $workflowResult['current_approval_step'];
            $log = VehicleLog::create($logData);

            // Notify the submitter
            $this->notify(
                $user,
                'PENGAJUAN PEMINJAMAN KENDARAAN',
                "Pengajuan peminjaman {$log->vehicle_name} ({$log->plate_number}) untuk tanggal {$log->departure_date} berhasil diajukan. Status: Menunggu {$workflowResult['step_label']}.",
                'info',
                self::URL_FLEET_LOGS
            );

            // Notify approvers of current step
            foreach ($workflowResult['approvers'] as $approver) {
                $this->notify(
                    $approver,
                    'PERSETUJUAN PEMINJAMAN KENDARAAN',
                    "Permohonan peminjaman armada dari {$user->name} untuk unit {$log->vehicle_name} ({$log->plate_number}) ke {$log->destination}. Mohon kesediaannya meninjau pengajuan ini.",
                    'warning',
                    self::URL_FLEET_LOGS
                );
            }
        } else {
            // Direct approval if no workflow configured
            $logData['status'] = 'approved';
            $logData['current_approval_step'] = null;
            $log = VehicleLog::create($logData);

            $this->notify(
                $user,
                'PEMINJAMAN KENDARAAN DISETUJUI',
                "Peminjaman kendaraan {$log->vehicle_name} ({$log->plate_number}) otomatis disetujui. Unit siap digunakan dan dicatat keberangkatannya.",
                'success',
                self::URL_FLEET_LOGS
            );
        }

        $this->logActivity('REQUEST_VEHICLE_LOG', "Mengajukan peminjaman kendaraan {$request->vehicle_name} ({$request->plate_number}) ke {$request->destination}", $log);

        $this->notifySuperAdmins(
            $user->company_id,
            'PENGAJUAN PINJAM KENDARAAN BARU',
            "Karyawan {$user->name} mengajukan peminjaman unit {$request->vehicle_name} ({$request->plate_number}) ke {$request->destination} untuk tanggal {$request->departure_date}.",
            'warning',
            self::URL_FLEET_LOGS,
            $user->id
        );

        return $this->successResponse($log, 'Pengajuan peminjaman kendaraan berhasil dikirim.', 201);
    }

    /**
     * Step 2: Record departure (KM Awal + Foto Dashboard)
     * Supports either existing approved booking (pass id) or legacy on-the-fly departure
     */
    public function storeDeparture(Request $request, $id = null)
    {
        $logId = $id ?: $request->input('vehicle_log_id');

        if ($logId) {
            $log = VehicleLog::where('user_id', $request->user()->id)
                ->whereIn('status', ['approved', 'departure', 'pending'])
                ->findOrFail($logId);

            $request->validate([
                'odometer_start' => 'required|integer|min:0',
                'odometer_start_photo' => 'nullable|image|max:10240',
                'notes' => 'nullable|string',
            ]);

            $photoPath = $log->odometer_start_photo;
            if ($request->hasFile('odometer_start_photo')) {
                $file = $request->file('odometer_start_photo');
                $photoPath = self::DIR_ODOMETER.Str::random(40).'.jpg';

                $img = Image::decode($file);
                $img->scale(width: 1000);
                Storage::disk('public')->put($photoPath, (string) $img->encodeUsingFileExtension('jpg', 80));
            }

            $log->update([
                'odometer_start' => $request->odometer_start,
                'odometer_start_photo' => $photoPath,
                'notes' => $request->notes ?? $log->notes,
                'status' => 'in_use',
            ]);

            $this->notify(
                $request->user(),
                'LOG KENDARAAN — KEBERANGKATAN',
                "Keberangkatan dimulai. Kendaraan {$log->vehicle_name} ({$log->plate_number}) dengan KM Awal {$log->odometer_start}.",
                'info',
                self::URL_FLEET_LOGS
            );

            $this->logActivity('START_VEHICLE_TRIP', "Mencatat keberangkatan kendaraan {$log->vehicle_name} ({$log->plate_number}), KM: {$log->odometer_start}", $log);

            return $this->successResponse($log, 'Pencatatan keberangkatan berhasil. Selamat berkendara!');
        }

        // Legacy / Fallback direct creation
        $request->validate([
            'vehicle_name' => 'required|string|max:255',
            'plate_number' => 'required|string|max:20',
            'purpose' => 'required|string|max:500',
            'destination' => 'required|string|max:255',
            'departure_date' => 'required|date',
            'odometer_start' => 'required|integer|min:0',
            'odometer_start_photo' => 'nullable|image|max:10240',
            'notes' => 'nullable|string',
            'company_id' => 'nullable|integer|exists:companies,id',
        ]);

        $photoPath = null;
        if ($request->hasFile('odometer_start_photo')) {
            $file = $request->file('odometer_start_photo');
            $photoPath = self::DIR_ODOMETER.Str::random(40).'.jpg';

            $img = Image::decode($file);
            $img->scale(width: 1000);
            Storage::disk('public')->put($photoPath, (string) $img->encodeUsingFileExtension('jpg', 80));
        }

        $companyId = $request->input('company_id') ?: $request->user()->company_id;
        if (! $companyId && $request->user()->canAccessAllCompanies()) {
            $companyId = \App\Models\Company::first()?->id;
        }

        $log = VehicleLog::create([
            'company_id' => $companyId,
            'user_id' => $request->user()->id,
            'vehicle_name' => $request->vehicle_name,
            'plate_number' => strtoupper($request->plate_number),
            'purpose' => $request->purpose,
            'destination' => $request->destination,
            'departure_date' => $request->departure_date,
            'odometer_start' => $request->odometer_start,
            'odometer_start_photo' => $photoPath,
            'notes' => $request->notes,
            'status' => 'in_use',
        ]);

        $this->notify(
            $request->user(),
            'LOG KENDARAAN — KEBERANGKATAN',
            "Pencatatan keberangkatan berhasil. Kendaraan {$request->vehicle_name} ({$request->plate_number}) dengan KM Awal {$request->odometer_start}.",
            'info',
            self::URL_FLEET_LOGS
        );

        $this->logActivity('CREATE_VEHICLE_LOG', "Mencatat keberangkatan langsung kendaraan {$request->vehicle_name} ({$request->plate_number})", $log);

        return $this->successResponse($log, 'Pencatatan keberangkatan berhasil.', 201);
    }

    /**
     * Step 2: Record return (KM Akhir + Foto Dashboard + Biaya)
     */
    public function storeReturn(Request $request, $id)
    {
        $log = VehicleLog::where('user_id', $request->user()->id)
            ->whereIn('status', ['departure', 'in_use'])
            ->findOrFail($id);

        $request->validate([
            'return_date' => 'required|date|after_or_equal:'.Carbon::parse($log->departure_date)->format('Y-m-d'),
            'odometer_end' => 'required|integer|min:'.($log->odometer_start ?: 0),
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
            $photoPath = self::DIR_ODOMETER.Str::random(40).'.jpg';

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
            "Perjalanan dinas selesai dicatat. Jarak tempuh: {$distance} KM. Total biaya: Rp ".number_format((float) $totalCost, 0, ',', '.').'.',
            'success',
            self::URL_FLEET_LOGS
        );

        $this->logActivity('COMPLETE_VEHICLE_LOG', "Menyelesaikan log kendaraan {$log->vehicle_name} ({$log->plate_number}), jarak {$distance} KM", $log);

        return $this->successResponse($log, 'Pencatatan kepulangan berhasil.');
    }

    private function processDynamicApproval(VehicleLog $log, Request $request)
    {
        $result = \App\Services\ApprovalService::processApproval(
            'vehicle_log',
            $log->company_id,
            $request->user(),
            $log->user,
            $log->current_approval_step,
            'approve'
        );

        if ($result && isset($result['error'])) {
            return $this->errorResponse($result['error'], 403);
        }

        if ($result) {
            if ($result['is_final']) {
                $log->update([
                    'status' => 'approved',
                    'current_approval_step' => null,
                    'approved_by' => $request->user()->id,
                    'remark' => $request->remark,
                ]);

                $this->notify(
                    $log->user,
                    'PEMINJAMAN KENDARAAN DISETUJUI',
                    "Pengajuan peminjaman unit {$log->vehicle_name} ({$log->plate_number}) telah DISETUJUI sepenuhnya. Unit siap diambil & digunakan.",
                    'success',
                    self::URL_FLEET_LOGS
                );

                $this->notifySuperAdmins(
                    $log->company_id,
                    'PEMINJAMAN KENDARAAN DISETUJUI',
                    "Pengajuan peminjaman unit {$log->vehicle_name} ({$log->plate_number}) dari {$log->user->name} telah DISETUJUI oleh {$request->user()->name}.",
                    'success',
                    self::URL_FLEET_LOGS,
                    $request->user()->id
                );
            } else {
                $log->update([
                    'current_approval_step' => $result['current_approval_step'],
                ]);

                foreach ($result['approvers'] as $approver) {
                    $this->notify(
                        $approver,
                        'PERSETUJUAN PEMINJAMAN KENDARAAN',
                        "Ada pengajuan peminjaman unit {$log->vehicle_name} ({$log->plate_number}) dari {$log->user->name} yang memerlukan persetujuan Anda ({$result['step_label']}).",
                        'warning',
                        self::URL_FLEET_LOGS
                    );
                }

                $this->notifySuperAdmins(
                    $log->company_id,
                    'PROGRESS PEMINJAMAN KENDARAAN',
                    "Pengajuan peminjaman unit {$log->vehicle_name} ({$log->plate_number}) dari {$log->user->name} disetujui di tahap sebelumnya oleh {$request->user()->name}. Menunggu: {$result['step_label']}.",
                    'info',
                    self::URL_FLEET_LOGS,
                    $request->user()->id
                );
            }

            $this->logActivity('APPROVE_VEHICLE_LOG', "Menyetujui tahap pengajuan peminjaman kendaraan {$log->vehicle_name} dari {$log->user->name}", $log);

            return $this->successResponse($log, 'Persetujuan peminjaman kendaraan berhasil.');
        }

        return null;
    }

    /**
     * Approve a vehicle loan request or completed vehicle log
     */
    public function approve(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('approve-vehicle-logs'), 403, self::MSG_FORBIDDEN);

        $log = VehicleLog::with('user')->findOrFail($id);

        if (! in_array($log->status, ['pending', 'completed'])) {
            return $this->errorResponse('Hanya pengajuan dengan status "pending" atau "completed" yang bisa disetujui.', 422);
        }

        // Dynamic multi-step approval
        if ($log->current_approval_step) {
            $dynamicResponse = $this->processDynamicApproval($log, $request);
            if ($dynamicResponse) {
                return $dynamicResponse;
            }
        }

        // Single step approval fallback
        $log->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'remark' => $request->remark,
        ]);

        $this->notify(
            $log->user,
            'LOG KENDARAAN DISETUJUI',
            "Pengajuan / log kendaraan Anda ({$log->vehicle_name} - {$log->plate_number}) telah disetujui.",
            'success',
            self::URL_FLEET_LOGS
        );

        $this->logActivity('APPROVE_VEHICLE_LOG', "Menyetujui log kendaraan {$log->vehicle_name} dari {$log->user->name}", $log);

        $this->notifySuperAdmins(
            $log->company_id,
            'LOG KENDARAAN DISETUJUI',
            "Log / peminjaman kendaraan {$log->vehicle_name} ({$log->plate_number}) dari {$log->user->name} telah DISETUJUI oleh {$request->user()->name}.",
            'success',
            self::URL_FLEET_LOGS,
            $request->user()->id
        );

        return $this->successResponse($log, 'Log kendaraan berhasil disetujui.');
    }

    /**
     * Reject a vehicle loan request or completed vehicle log
     */
    public function reject(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('approve-vehicle-logs'), 403, self::MSG_FORBIDDEN);

        $log = VehicleLog::with('user')->findOrFail($id);

        if (! in_array($log->status, ['pending', 'completed'])) {
            return $this->errorResponse('Hanya pengajuan dengan status "pending" atau "completed" yang bisa ditolak.', 422);
        }

        if ($log->current_approval_step) {
            $result = \App\Services\ApprovalService::processApproval(
                'vehicle_log',
                $log->company_id,
                $request->user(),
                $log->user,
                $log->current_approval_step,
                'reject'
            );

            if ($result && isset($result['error'])) {
                return $this->errorResponse($result['error'], 403);
            }
        }

        $log->update([
            'status' => 'rejected',
            'current_approval_step' => null,
            'approved_by' => $request->user()->id,
            'remark' => $request->remark,
        ]);

        $msg = "Pengajuan peminjaman / log kendaraan Anda ({$log->vehicle_name} - {$log->plate_number}) DITOLAK.";
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

        $this->notifySuperAdmins(
            $log->company_id,
            'LOG KENDARAAN DITOLAK',
            "Pengajuan / log kendaraan {$log->vehicle_name} ({$log->plate_number}) dari {$log->user->name} telah DITOLAK oleh {$request->user()->name}." . ($request->remark ? " Catatan: {$request->remark}" : ''),
            'danger',
            self::URL_FLEET_LOGS,
            $request->user()->id
        );

        return $this->successResponse($log, 'Pengajuan kendaraan ditolak.');
    }

    /**
     * Delete a vehicle log (only departure, pending, or rejected status)
     */
    public function destroy(Request $request, $id)
    {
        $log = VehicleLog::findOrFail($id);

        if ($log->user_id !== $request->user()->id && ! $request->user()->hasPermission('approve-vehicle-logs')) {
            return $this->errorResponse(self::MSG_FORBIDDEN, 403);
        }

        if (! in_array($log->status, ['departure', 'pending', 'rejected'])) {
            return $this->errorResponse('Hanya pengajuan belum berjalan atau ditolak yang bisa dihapus.', 403);
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
            ->whereIn('status', ['approved', 'completed']);

        $companyId = $request->input('company_id') ?: $request->user()->company_id;
        if ($request->user()->company_id && ! $request->user()->canAccessAllCompanies()) {
            $query->where('company_id', $request->user()->company_id);
        } elseif ($companyId) {
            $query->where('company_id', $companyId);
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
     * Get list of vehicles with real-time status (available / in use / maintenance / booked)
     */
    public function vehicles(Request $request)
    {
        $user = $request->user();
        $companyId = $this->resolveEffectiveCompanyId($user, $request->query('company_id'));

        $vehiclesQuery = VehicleLog::query();
        $this->scopeCompanyFleet($vehiclesQuery, $user, $companyId);

        // Distinct fleet
        $rawVehicles = $vehiclesQuery
            ->select('plate_number', 'vehicle_name')
            ->distinct()
            ->orderBy('vehicle_name')
            ->get();

        // Check currently active / in-use trips
        $tripsQuery = VehicleLog::with('user:id,name')
            ->whereIn('status', ['in_use', 'departure', 'approved', 'maintenance']);
        $this->scopeCompanyFleet($tripsQuery, $user, $companyId);
        $activeTrips = $tripsQuery->get()->keyBy('plate_number');

        $result = $rawVehicles->map(fn($v) => $this->formatVehicleItem($v, $activeTrips->get($v->plate_number)));

        return $this->successResponse($result, 'Daftar armada kendaraan berhasil diambil.');
    }

    private function resolveEffectiveCompanyId($user, ?string $queryCompanyId): ?int
    {
        $companyId = $queryCompanyId ?: $user->company_id;
        if (! $companyId && $user->canAccessAllCompanies()) {
            return \App\Models\Company::first()?->id;
        }
        return $companyId ? (int) $companyId : null;
    }

    private function scopeCompanyFleet($query, $user, ?int $companyId): void
    {
        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        } elseif ($companyId) {
            $query->where('company_id', $companyId);
        }
    }

    private function resolveVehicleStatus(?VehicleLog $active): array
    {
        if (! $active) {
            return ['status_code' => 'available', 'status_label' => 'Tersedia'];
        }

        return match ($active->status) {
            'maintenance' => ['status_code' => 'maintenance', 'status_label' => 'Dalam Perawatan'],
            'in_use', 'departure' => ['status_code' => 'in_use', 'status_label' => 'Sedang Digunakan'],
            'approved' => ['status_code' => 'booked', 'status_label' => 'Sudah Dipesan'],
            default => ['status_code' => 'available', 'status_label' => 'Tersedia'],
        };
    }

    private function formatVehicleItem($v, ?VehicleLog $active): array
    {
        $statusInfo = $this->resolveVehicleStatus($active);

        return [
            'vehicle_name' => $v->vehicle_name,
            'plate_number' => $v->plate_number,
            'is_available' => ! $active,
            'status_code' => $statusInfo['status_code'],
            'status_label' => $statusInfo['status_label'],
            'current_user' => $active?->user?->name,
            'destination' => $active?->destination,
            'purpose' => $active?->purpose,
            'notes' => $active?->notes,
            'until' => $active?->return_date ? Carbon::parse($active->return_date)->format('d M Y') : null,
            'departure_date' => $active?->departure_date ? Carbon::parse($active->departure_date)->format('d M Y') : null,
        ];
    }

    /**
     * Register a new vehicle into fleet catalog
     */
    public function storeVehicle(Request $request)
    {
        $request->validate([
            'vehicle_name' => 'required|string|max:255',
            'plate_number' => 'required|string|max:20',
            'vehicle_type' => 'nullable|string|max:50',
            'initial_status' => 'nullable|string|in:available,maintenance',
            'notes' => 'nullable|string',
            'company_id' => 'nullable|integer|exists:companies,id',
        ]);

        $user = $request->user();
        $companyId = $request->input('company_id') ?: $user->company_id;
        if (! $companyId && $user->canAccessAllCompanies()) {
            $companyId = \App\Models\Company::first()?->id;
        }

        if (! $companyId) {
            return $this->errorResponse('Perusahaan (company_id) tidak ditemukan.', 422);
        }

        $plateNumber = strtoupper(trim($request->plate_number));
        $vehicleName = trim($request->vehicle_name);
        $initialStatus = $request->initial_status ?? 'available';

        // Check if already registered
        $existing = VehicleLog::where('company_id', $companyId)
            ->where('plate_number', $plateNumber)
            ->first();

        if ($existing) {
            return $this->errorResponse("Kendaraan dengan plat nomor {$plateNumber} sudah terdaftar di sistem.", 422);
        }

        $logStatus = $initialStatus === 'maintenance' ? 'maintenance' : 'completed';
        $purpose = $initialStatus === 'maintenance' ? 'Armada Dalam Perawatan/Perbaikan' : 'Registrasi Armada Kendaraan Baru';

        $notesWithMeta = $request->notes;
        if ($request->vehicle_type) {
            $notesWithMeta = "[Tipe: {$request->vehicle_type}] " . ($request->notes ?? '');
        }

        $log = VehicleLog::create([
            'company_id' => $companyId,
            'user_id' => $user->id,
            'vehicle_name' => $vehicleName,
            'plate_number' => $plateNumber,
            'purpose' => $purpose,
            'destination' => 'Pool Armada Kantor',
            'departure_date' => now()->toDateString(),
            'return_date' => now()->toDateString(),
            'status' => $logStatus,
            'notes' => $notesWithMeta,
        ]);

        $this->logActivity('CREATE_VEHICLE', "Menambahkan armada baru: {$vehicleName} ({$plateNumber})", $log);

        return $this->successResponse($log, 'Armada kendaraan berhasil didaftarkan ke katalog.', 201);
    }
}
