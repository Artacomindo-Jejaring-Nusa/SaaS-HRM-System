<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\FaceRecognitionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FaceRecognitionController extends Controller
{
    private const DIR_FACE_REGISTRATIONS = 'face_registrations/';
    private const PATH_FACE_REGISTRATIONS = 'face_registrations';

    protected FaceRecognitionService $faceService;

    public function __construct(FaceRecognitionService $faceService)
    {
        $this->faceService = $faceService;
    }

    /**
     * Karyawan mendaftarkan wajah via Mobile App (Self-service).
     * Status otomatis: 'pending' (Menunggu Approval Super Admin / HR).
     */
    public function registerMobile(Request $request)
    {
        $request->validate([
            'image' => 'nullable|image|max:10240', // Max 10MB
            'image_base64' => 'nullable|string',
        ]);

        if (!$request->hasFile('image') && !$request->filled('image_base64')) {
            return $this->errorResponse('Foto wajah selfie pendaftaran wajib disertakan.', 422);
        }

        $user = $request->user();

        // 1. Ekstraksi Vektor 128-d menggunakan AI Pipeline
        $imageInput = $request->hasFile('image') ? $request->file('image') : $request->input('image_base64');
        $extractResult = $this->validateAndExtractFace($imageInput);
        if (isset($extractResult['error'])) {
            return $this->errorResponse($extractResult['error'], $extractResult['code']);
        }
        $extraction = $extractResult['extraction'];

        // 2. Simpan file foto pendaftaran
        $photoPath = null;
        if ($request->hasFile('image')) {
            $filename = 'face_' . $user->id . '_' . Str::random(10) . '.' . $request->file('image')->getClientOriginalExtension();
            $photoPath = $request->file('image')->storeAs(self::PATH_FACE_REGISTRATIONS, $filename, 'public');
        } elseif ($request->filled('image_base64')) {
            $filename = 'face_' . $user->id . '_' . Str::random(10) . '.jpg';
            $data = str_contains($request->image_base64, ',') ? explode(',', $request->image_base64)[1] : $request->image_base64;
            Storage::disk('public')->put(self::DIR_FACE_REGISTRATIONS . $filename, base64_decode($data));
            $photoPath = self::DIR_FACE_REGISTRATIONS . $filename;
        }

        // 3. Update data User dengan status PENDING
        $user->update([
            'face_embedding' => $extraction['embedding'],
            'face_registered_photo_path' => $photoPath,
            'face_status' => 'pending',
            'face_rejection_reason' => null,
            'face_registered_at' => now(),
            'face_approved_at' => null,
            'face_approved_by' => null,
        ]);

        return $this->successResponse([
            'face_status' => $user->face_status,
            'photo_url' => $user->face_registered_photo_url,
            'face_registered_at' => $user->face_registered_at,
            'face_detected' => $extraction['face_detected'] ?? true,
            'bbox' => $extraction['bbox'] ?? null,
        ], 'Pendaftaran wajah berhasil diajukan. Menunggu verifikasi dan persetujuan Super Admin / HR.');
    }

    /**
     * Karyawan mengecek status pendaftaran wajahnya.
     */
    public function getStatus(Request $request)
    {
        $user = $request->user();

        return $this->successResponse([
            'face_status' => $user->face_status ?? 'not_registered',
            'is_approved' => $user->is_face_approved,
            'photo_url' => $user->face_registered_photo_url,
            'face_registered_at' => $user->face_registered_at,
            'face_approved_at' => $user->face_approved_at,
            'face_rejection_reason' => $user->face_rejection_reason,
            'approver_name' => $user->faceApprover?->name,
        ], 'Status pendaftaran wajah berhasil dimuat.');
    }

    /**
     * Admin/HR: Melihat daftar pengajuan pendaftaran wajah karyawan.
     */
    public function getAdminRequests(Request $request)
    {
        $this->authorizeAdminOrHrd();

        $query = User::query();

        // Multi-tenant check
        if (Auth::user()->company_id && !Auth::user()->canAccessAllCompanies()) {
            $query->where('company_id', Auth::user()->company_id);
        }

        if ($request->filled('status')) {
            $query->where('face_status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('nik', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $requests = $query->with('faceApprover')
            ->select([
                'id', 'name', 'nik', 'email', 'company_id', 'office_id', 'role_id',
                'profile_photo_path', 'face_registered_photo_path',
                'face_status', 'face_rejection_reason',
                'face_registered_at', 'face_approved_at', 'face_approved_by'
            ])
            ->orderByRaw("FIELD(face_status, 'pending', 'rejected', 'approved', 'not_registered')")
            ->orderBy('face_registered_at', 'desc')
            ->paginate($request->per_page ?? 20);

        return $this->successResponse($requests, 'Daftar pengajuan wajah berhasil dimuat.');
    }

    /**
     * Admin/HR: Menyetujui pengajuan pendaftaran wajah karyawan.
     */
    public function approve($id)
    {
        $this->authorizeAdminOrHrd();

        $user = User::findOrFail($id);

        if (empty($user->face_embedding)) {
            return $this->errorResponse('Karyawan belum memiliki data vektor wajah untuk disetujui.', 422);
        }

        $user->update([
            'face_status' => 'approved',
            'face_approved_at' => now(),
            'face_approved_by' => Auth::id(),
            'face_rejection_reason' => null,
        ]);

        return $this->successResponse([
            'id' => $user->id,
            'name' => $user->name,
            'face_status' => $user->face_status,
            'approved_at' => $user->face_approved_at,
        ], "Pendaftaran wajah karyawan '{$user->name}' berhasil DISETUJUI. Wajah kini aktif untuk absensi.");
    }

    /**
     * Admin/HR: Menolak pengajuan pendaftaran wajah karyawan.
     */
    public function reject(Request $request, $id)
    {
        $this->authorizeAdminOrHrd();

        $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $user = User::findOrFail($id);

        $user->update([
            'face_status' => 'rejected',
            'face_rejection_reason' => $request->reason,
            'face_approved_at' => null,
            'face_approved_by' => null,
        ]);

        return $this->successResponse([
            'id' => $user->id,
            'name' => $user->name,
            'face_status' => $user->face_status,
            'reason' => $user->face_rejection_reason,
        ], "Pendaftaran wajah karyawan '{$user->name}' telah DITOLAK.");
    }

    /**
     * Admin/HR: Mendaftarkan langsung foto wajah karyawan (Direct Admin Enrollment).
     */
    public function adminRegisterDirect(Request $request, $id)
    {
        $this->authorizeAdminOrHrd();

        $request->validate([
            'image' => 'nullable|image|max:10240',
            'image_base64' => 'nullable|string',
        ]);

        $user = User::findOrFail($id);

        if (!$request->hasFile('image') && !$request->filled('image_base64')) {
            return $this->errorResponse('Foto wajah pendaftaran wajib disertakan.', 422);
        }

        $imageInput = $request->hasFile('image') ? $request->file('image') : $request->input('image_base64');
        $extraction = $this->faceService->extractFaceEmbedding($imageInput);

        if (!isset($extraction['success']) || !$extraction['success']) {
            return $this->errorResponse($extraction['message'] ?? 'Gagal mendeteksi wajah pada foto.', 422);
        }

        $photoPath = null;
        if ($request->hasFile('image')) {
            $filename = 'face_admin_' . $user->id . '_' . Str::random(10) . '.' . $request->file('image')->getClientOriginalExtension();
            $photoPath = $request->file('image')->storeAs(self::PATH_FACE_REGISTRATIONS, $filename, 'public');
        } elseif ($request->filled('image_base64')) {
            $filename = 'face_admin_' . $user->id . '_' . Str::random(10) . '.jpg';
            $data = str_contains($request->image_base64, ',') ? explode(',', $request->image_base64)[1] : $request->image_base64;
            Storage::disk('public')->put(self::DIR_FACE_REGISTRATIONS . $filename, base64_decode($data));
            $photoPath = self::DIR_FACE_REGISTRATIONS . $filename;
        }

        $user->update([
            'face_embedding' => $extraction['embedding'],
            'face_registered_photo_path' => $photoPath,
            'face_status' => 'approved',
            'face_rejection_reason' => null,
            'face_registered_at' => now(),
            'face_approved_at' => now(),
            'face_approved_by' => Auth::id(),
        ]);

        return $this->successResponse([
            'id' => $user->id,
            'name' => $user->name,
            'face_status' => $user->face_status,
            'photo_url' => $user->face_registered_photo_url,
            'face_approved_at' => $user->face_approved_at,
        ], "Wajah karyawan '{$user->name}' berhasil didaftarkan langsung oleh Admin.");
    }

    /**
     * Admin/HR: Reset data wajah karyawan sehingga dapat didaftarkan ulang.
     */
    public function resetFace($id)
    {
        $this->authorizeAdminOrHrd();

        $user = User::findOrFail($id);

        if ($user->face_registered_photo_path && Storage::disk('public')->exists($user->face_registered_photo_path)) {
            Storage::disk('public')->delete($user->face_registered_photo_path);
        }

        $user->update([
            'face_embedding' => null,
            'face_registered_photo_path' => null,
            'face_status' => 'not_registered',
            'face_rejection_reason' => null,
            'face_registered_at' => null,
            'face_approved_at' => null,
            'face_approved_by' => null,
        ]);

        return $this->successResponse([
            'id' => $user->id,
            'name' => $user->name,
            'face_status' => 'not_registered',
        ], "Data wajah karyawan '{$user->name}' berhasil di-reset. Karyawan dapat mendaftarkan wajah baru.");
    }

    /**
     * Mobile Karyawan: Mengajukan reset / hapus foto ditolak agar bisa daftar ulang.
     */
    public function resetMyFace(Request $request)
    {
        $user = $request->user();

        if ($user->face_registered_photo_path && Storage::disk('public')->exists($user->face_registered_photo_path)) {
            Storage::disk('public')->delete($user->face_registered_photo_path);
        }

        $user->update([
            'face_embedding' => null,
            'face_registered_photo_path' => null,
            'face_status' => 'not_registered',
            'face_rejection_reason' => null,
            'face_registered_at' => null,
            'face_approved_at' => null,
            'face_approved_by' => null,
        ]);

        return $this->successResponse([
            'face_status' => 'not_registered',
        ], 'Data wajah berhasil di-reset. Silakan lakukan pendaftaran wajah baru.');
    }

    private function validateAndExtractFace($imageInput): array
    {
        $extraction = $this->faceService->extractFaceEmbedding($imageInput);

        if (!isset($extraction['success']) || !$extraction['success']) {
            return [
                'error' => $extraction['message'] ?? 'Gagal mendeteksi wajah pada foto. Pastikan wajah terlihat jelas dan pencahayaan cukup.',
                'code' => 422,
            ];
        }

        if (empty($extraction['embedding']) || count($extraction['embedding']) !== 128) {
            return [
                'error' => 'Gagal menghasilkan representasi vektor wajah 128-d yang valid.',
                'code' => 500,
            ];
        }

        return ['extraction' => $extraction];
    }

    protected function authorizeAdminOrHrd()
    {
        $user = Auth::user();
        if (!$user) {
            abort(401, 'Unauthenticated.');
        }

        if ($user->role_id === 1 || $user->canAccessManagerPortal || $user->hasPermission('manage-employees') || $user->hasPermission('approve-face-recognition')) {
            return true;
        }

        abort(403, 'Akses ditolak: Hanya Super Admin / HRD yang dapat mengelola approval pendaftaran wajah.');
    }
}
