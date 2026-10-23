<?php

namespace App\Http\Controllers;

use App\Models\AttendanceDevice;
use App\Services\AttendanceDeviceSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceDeviceController extends Controller
{
    public function __construct(
        protected AttendanceDeviceSyncService $syncService
    ) {}

    /**
     * List all attendance devices for the authenticated company.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $devices = AttendanceDevice::where('company_id', $user->company_id)
            ->orderBy('id', 'desc')
            ->get();

        return $this->successResponse($devices, 'Daftar perangkat presensi berhasil diambil.');
    }

    /**
     * Store a newly created attendance device.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'ip_address' => 'required|ip',
            'port' => 'nullable|integer|min:1|max:65535',
            'comm_key' => 'nullable|string|max:50',
            'device_model' => 'nullable|string|max:100',
            'is_active' => 'nullable|boolean',
        ]);

        $validated['company_id'] = $user->company_id;
        $validated['port'] = $validated['port'] ?? 4370;
        $validated['comm_key'] = $validated['comm_key'] ?? '0';
        $validated['device_model'] = $validated['device_model'] ?? 'Solution X100-C';
        $validated['status'] = 'offline';

        $device = AttendanceDevice::create($validated);

        return $this->successResponse($device, 'Perangkat presensi berhasil didaftarkan.', 201);
    }

    /**
     * Update an existing attendance device.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $device = AttendanceDevice::where('company_id', $user->company_id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'ip_address' => 'sometimes|required|ip',
            'port' => 'nullable|integer|min:1|max:65535',
            'comm_key' => 'nullable|string|max:50',
            'device_model' => 'nullable|string|max:100',
            'is_active' => 'nullable|boolean',
        ]);

        $device->update($validated);

        return $this->successResponse($device, 'Pengaturan perangkat berhasil diperbarui.');
    }

    /**
     * Delete an attendance device.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $device = AttendanceDevice::where('company_id', $user->company_id)->findOrFail($id);
        $device->delete();

        return $this->successResponse(null, 'Perangkat presensi berhasil dihapus.');
    }

    /**
     * Test connection to a specific device.
     */
    public function testConnection(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $device = AttendanceDevice::where('company_id', $user->company_id)->findOrFail($id);

        $result = $this->syncService->testDevice($device);

        if ($result['success']) {
            return $this->successResponse($result['data'], $result['message']);
        }

        return $this->errorResponse($result['message'], 422);
    }

    /**
     * Manually pull attendance logs from a specific device.
     */
    public function sync(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $device = AttendanceDevice::where('company_id', $user->company_id)->findOrFail($id);

        $result = $this->syncService->syncDeviceLogs($device);

        if ($result['success']) {
            return $this->successResponse($result, $result['message']);
        }

        return $this->errorResponse($result['message'], 422);
    }

    /**
     * Ingest logs via Local Sync Agent or USB file upload (.dat, .csv, .txt).
     */
    public function ingest(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $device = AttendanceDevice::where('company_id', $user->company_id)->findOrFail($id);

        $logs = [];

        if ($request->hasFile('log_file')) {
            $file = $request->file('log_file');
            $content = file_get_contents($file->getRealPath());
            $logs = $this->syncService->parseLogFile($content ?: '');
        } elseif ($request->has('logs')) {
            $logs = (array) $request->input('logs', []);
        }

        $result = $this->syncService->ingestLogs($device, $logs);

        return $result['success']
            ? $this->successResponse($result, $result['message'])
            : $this->errorResponse($result['message'], 422);
    }
}
