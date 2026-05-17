<?php

namespace App\Http\Controllers;

use App\Imports\EmployeeImport;
use App\Mail\WelcomeEmployeeNotification;
use App\Models\Announcement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Yajra\DataTables\Facades\DataTables;

class EmployeeController extends Controller
{
    private const MSG_FORBIDDEN = 'Akses ditolak.';
    private const RULE_NULLABLE_STRING = 'nullable|string';
    private const RULE_NULLABLE_DATE = 'nullable|date';
    private const RULE_REQ_ARRAY = 'required|array';
    private const RULE_IDS_ALL = 'ids.*';
    private const RULE_EXISTS_USER = 'exists:users,id';
    private const FORMAT_DATE = 'd M Y';

    public function index(Request $request)
    {
        abort_if(! $request->user()->hasPermission('view-employees'), 403, self::MSG_FORBIDDEN);

        $query = User::query();
        $user = $request->user();

        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        }

        // --- GreetDay Feature: My Team Filter ---
        if ($request->is_team === 'true' || $request->is_team === true) {
            $query->where('supervisor_id', $user->id);
        }

        $employees = $query
            ->when($request->search, function ($q) use ($request) {
                $q->where(function ($qq) use ($request) {
                    $qq->where('name', 'like', "%{$request->search}%")
                        ->orWhere('email', 'like', "%{$request->search}%");
                });
            })
            ->when($request->id, function ($q) use ($request) {
                $q->where('id', $request->id);
            })
            ->with(['role', 'supervisor', 'office'])
            ->orderBy('name', 'asc')
            ->paginate($request->per_page ?? 10);

        return $this->successResponse($employees, 'Data karyawan berhasil diambil.');
    }

    /**
     * DataTables endpoint for advanced server-side processing.
     * Handles search, sort, and pagination efficiently.
     */
    public function datatables(Request $request)
    {
        abort_if(! $request->user()->hasPermission('view-employees'), 403, self::MSG_FORBIDDEN);

        $user = $request->user();
        $query = User::with(['role', 'supervisor', 'office']);

        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        }

        if ($request->is_team === 'true' || $request->is_team === true) {
            $query->where('supervisor_id', $user->id);
        }

        if ($request->filter === 'unverified') {
            $query->whereNull('email_verified_at');
        }

        return DataTables::of($query)
            ->with([
                'unverified_count' => User::where('company_id', $user->company_id)->whereNull('email_verified_at')->count(),
            ])
            ->filter(function ($query) use ($request) {
                if ($request->has('search') && $request->search['value']) {
                    $searchTerm = $request->search['value'];
                    $query->where(function ($q) use ($searchTerm) {
                        $q->where('name', 'like', "%{$searchTerm}%")
                            ->orWhere('email', 'like', "%{$searchTerm}%")
                            ->orWhere('nik', 'like', "%{$searchTerm}%");
                    });
                }
            })
            ->make(true);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $company = $user->company;

        // Check Employee Limit
        $empCount = User::where('company_id', $user->company_id)->count();
        if ($empCount >= $company->getEmployeeLimit()) {
            return $this->errorResponse("Batas karyawan Anda ({$company->getEmployeeLimit()}) telah tercapai. Silakan upgrade paket berlangganan Anda.", 403);
        }

        abort_if(! $request->user()->hasPermission('create-employees'), 403, self::MSG_FORBIDDEN);

        $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:6',
            'role_id' => 'required|exists:roles,id',
            'nik' => self::RULE_NULLABLE_STRING,
            'phone' => self::RULE_NULLABLE_STRING,
            'address' => self::RULE_NULLABLE_STRING,
            'join_date' => self::RULE_NULLABLE_DATE,
            'photo' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
            'supervisor_id' => 'nullable|exists:users,id',
            'employment_status' => self::RULE_NULLABLE_STRING,
            'work_location' => self::RULE_NULLABLE_STRING,
            'attendance_type' => 'nullable|string|in:office_hour,shift',
            'ktp_no' => self::RULE_NULLABLE_STRING,
            'place_of_birth' => self::RULE_NULLABLE_STRING,
            'date_of_birth' => self::RULE_NULLABLE_DATE,
            'gender' => 'nullable|in:Laki-laki,Perempuan',
            'marital_status' => self::RULE_NULLABLE_STRING,
            'religion' => self::RULE_NULLABLE_STRING,
            'blood_type' => 'nullable|string|max:5',
            'emergency_contact_name' => self::RULE_NULLABLE_STRING,
            'emergency_contact_phone' => self::RULE_NULLABLE_STRING,
            'office_id' => 'nullable|exists:offices,id',
        ]);

        $path = null;
        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('profile-photos', 'public');
        }

        $employee = new User;
        $employee->name = $request->name;
        $employee->email = $request->email;
        $employee->password = Hash::make($request->password);
        $employee->company_id = $request->user()->company_id;
        $employee->role_id = $request->role_id;
        $employee->nik = $request->nik;
        $employee->phone = $request->phone;
        $employee->address = $request->address;
        $employee->join_date = $request->join_date;
        $employee->employment_status = $request->employment_status;
        $employee->work_location = $request->work_location;
        $employee->attendance_type = $request->attendance_type ?? 'office_hour';
        $employee->profile_photo_path = $path;
        $employee->supervisor_id = $request->supervisor_id;
        $employee->ktp_no = $request->ktp_no;
        $employee->place_of_birth = $request->place_of_birth;
        $employee->date_of_birth = $request->date_of_birth;
        $employee->gender = $request->gender;
        $employee->marital_status = $request->marital_status;
        $employee->religion = $request->religion;
        $employee->blood_type = $request->blood_type;
        $employee->emergency_contact_name = $request->emergency_contact_name;
        $employee->emergency_contact_phone = $request->emergency_contact_phone;
        $employee->office_id = $request->office_id;
        $employee->save();

        // Send Welcome & Verification Email
        try {
            Mail::to($employee->email)->send(new WelcomeEmployeeNotification($employee, $request->password));
        } catch (\Exception $e) {
            Log::error('Gagal mengirim email welcome: '.$e->getMessage());
        }

        $this->logActivity('CREATE_EMPLOYEE', "Menambahkan karyawan baru: {$employee->name}", $employee);

        return $this->successResponse($employee, 'Karyawan baru berhasil ditambahkan dan email undangan telah dikirim.', 201);
    }

    public function show($id, Request $request)
    {
        $user = $request->user();
        $employee = User::where(function ($query) use ($user) {
            if ($user->role_id !== 1) {
                $query->where('company_id', $user->company_id);
            }
        })->with(['role', 'company', 'supervisor', 'office'])->findOrFail($id);

        return $this->successResponse($employee, 'Detail karyawan berhasil diambil.');
    }

    public function update(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('edit-employees'), 403, self::MSG_FORBIDDEN);

        $employee = User::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string',
            'email' => 'sometimes|email|unique:users,email,'.$id,
            'role_id' => 'sometimes|exists:roles,id',
            'photo' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
            'attendance_type' => 'nullable|string|in:office_hour,shift',
            'ktp_no' => self::RULE_NULLABLE_STRING,
            'place_of_birth' => self::RULE_NULLABLE_STRING,
            'date_of_birth' => self::RULE_NULLABLE_DATE,
            'gender' => 'nullable|in:Laki-laki,Perempuan',
            'marital_status' => self::RULE_NULLABLE_STRING,
            'religion' => self::RULE_NULLABLE_STRING,
            'blood_type' => 'nullable|string|max:5',
            'emergency_contact_name' => self::RULE_NULLABLE_STRING,
            'emergency_contact_phone' => self::RULE_NULLABLE_STRING,
            'office_id' => 'nullable|exists:offices,id',
        ]);

        if ($request->hasFile('photo')) {
            if ($employee->profile_photo_path) {
                Storage::disk('public')->delete($employee->profile_photo_path);
            }
            $path = $request->file('photo')->store('profile-photos', 'public');
            $employee->profile_photo_path = $path;
        }

        $employee->update($request->except(['photo', 'password']));

        if ($request->has('employment_status')) {
            $employee->employment_status = $request->employment_status;
        }

        if ($request->has('work_location')) {
            $employee->work_location = $request->work_location;
        }

        $employee->save();

        if ($request->password) {
            $employee->update(['password' => Hash::make($request->password)]);
        }

        $this->logActivity('UPDATE_EMPLOYEE', "Memperbarui data karyawan: {$employee->name}", $employee);

        return $this->successResponse($employee, 'Data karyawan berhasil diupdate.');
    }

    public function bulkDestroy(Request $request)
    {
        abort_if(! $request->user()->hasPermission('delete-employees'), 403, self::MSG_FORBIDDEN);

        $request->validate([
            'ids' => self::RULE_REQ_ARRAY,
            self::RULE_IDS_ALL => self::RULE_EXISTS_USER,
        ]);

        $idsCount = count($request->ids);
        User::whereIn('id', $request->ids)->delete();

        $this->logActivity('BULK_DELETE_EMPLOYEE', "Menghapus {$idsCount} data karyawan secara massal");

        return $this->successResponse(null, "{$idsCount} karyawan berhasil dihapus.");
    }

    public function destroy(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('delete-employees'), 403, self::MSG_FORBIDDEN);

        $user = $request->user();
        $employee = User::where(function ($query) use ($user) {
            if ($user->role_id !== 1) {
                $query->where('company_id', $user->company_id);
            }
        })->findOrFail($id);

        $name = $employee->name;
        $employee->delete();

        $this->logActivity('DELETE_EMPLOYEE', "Menghapus data karyawan: {$name} (ID: {$id})");

        return $this->successResponse(null, 'Karyawan berhasil dihapus.');
    }

    public function import(Request $request)
    {
        abort_if(! $request->user()->hasPermission('create-employees'), 403, self::MSG_FORBIDDEN);

        $request->validate([
            'file' => 'required|mimes:xlsx,csv,xls|max:5120',
        ]);

        try {
            $import = new EmployeeImport($request->user()->company_id);
            Excel::import($import, $request->file('file'));

            if ($import->importedCount === 0) {
                return $this->errorResponse('Gagal mengimpor: Tidak ada data valid yang ditemukan (Pastikan format file sesuai template asli).', 400);
            }

            $this->logActivity('IMPORT_EMPLOYEE', "Mengimpor {$import->importedCount} karyawan secara massal via Excel");

            return $this->successResponse(null, "{$import->importedCount} data karyawan berhasil diimpor.");
        } catch (\Exception $e) {
            return $this->errorResponse('Gagal mengimpor: '.$e->getMessage(), 500);
        }
    }

    public function directory(Request $request)
    {
        $user = $request->user();
        $query = User::where('company_id', $user->company_id);

        $employees = $query
            ->when($request->search, function ($q) use ($request) {
                $q->where(function ($qq) use ($request) {
                    $qq->where('name', 'like', "%{$request->search}%")
                        ->orWhere('email', 'like', "%{$request->search}%");
                });
            })
            ->with(['role', 'company'])
            ->orderBy('name', 'asc')
            ->paginate($request->per_page ?? 20);

        return $this->successResponse($employees, 'Data direktori karyawan berhasil diambil.');
    }

    public function toggleWfh(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('manage-wfh'), 403, self::MSG_FORBIDDEN);

        $request->validate([
            'start_date' => 'required_if:is_wfh,true|nullable|date',
            'end_date' => 'required_if:is_wfh,true|nullable|date|after_or_equal:start_date',
        ]);

        $employee = User::findOrFail($id);

        // Toggle or set specifically if provided in request
        $isActivating = $request->has('is_wfh') ? filter_var($request->is_wfh, FILTER_VALIDATE_BOOLEAN) : ! $employee->is_wfh;

        $employee->is_wfh = $isActivating;

        if ($isActivating) {
            $employee->wfh_start_date = $request->start_date ?? now()->toDateString();
            $employee->wfh_end_date = $request->end_date ?? now()->addDays(7)->toDateString();

            // Create Generic Announcement (only if activating)
            Announcement::create([
                'company_id' => $employee->company_id,
                'user_id' => $request->user()->id,
                'title' => 'PENGUMUMAN WFA (DINAS LUAR)',
                'content' => 'Diberitahukan kepada seluruh tim, bahwa perusahaan memberlakukan kebijakan WFA (Work From Anywhere) atau Dinas Luar terhitung mulai tanggal '.
                             Carbon::parse($employee->wfh_start_date)->format(self::FORMAT_DATE).' sampai '.
                             Carbon::parse($employee->wfh_end_date)->format(self::FORMAT_DATE).'. Selama periode ini, karyawan yang telah diberikan izin dapat melakukan absensi di luar radius kantor.',
            ]);
        } else {
            $employee->wfh_start_date = null;
            $employee->wfh_end_date = null;
        }

        $employee->save();

        $status = $employee->is_wfh ? 'AKTIF' : 'NONAKTIF';
        $this->logActivity('TOGGLE_WFH', "Mengubah status WFA karyawan {$employee->name} menjadi {$status}", $employee);

        return $this->successResponse($employee, "Status WFA (Dinas Luar) berhasil diubah menjadi {$status}.");
    }

    public function bulkWfh(Request $request)
    {
        abort_if(! $request->user()->hasPermission('manage-wfh'), 403, self::MSG_FORBIDDEN);

        $request->validate([
            'ids' => self::RULE_REQ_ARRAY,
            self::RULE_IDS_ALL => self::RULE_EXISTS_USER,
            'is_wfh' => 'required|boolean',
            'start_date' => 'required_if:is_wfh,true|nullable|date',
            'end_date' => 'required_if:is_wfh,true|nullable|date|after_or_equal:start_date',
        ]);

        $isWfh = $request->is_wfh;
        $users = User::whereIn('id', $request->ids)->get();

        foreach ($users as $user) {
            /** @var User $user */
            $user->is_wfh = $isWfh;
            if ($isWfh) {
                $user->wfh_start_date = $request->start_date;
                $user->wfh_end_date = $request->end_date;
            } else {
                $user->wfh_start_date = null;
                $user->wfh_end_date = null;
            }
            $user->save();
        }

        if ($isWfh && count($users) > 0) {
            // Create Single Generic Announcement for all
            Announcement::create([
                'company_id' => $users->first()->company_id,
                'user_id' => $request->user()->id,
                'title' => 'PENGUMUMAN WFA (DINAS LUAR)',
                'content' => 'Diberitahukan kepada seluruh karyawan, bahwa perusahaan memberlakukan kebijakan WFA (Work From Anywhere) atau Dinas Luar terhitung mulai tanggal '.
                             Carbon::parse($request->start_date)->format(self::FORMAT_DATE).' sampai '.
                             Carbon::parse($request->end_date)->format(self::FORMAT_DATE).'. Selama periode ini, karyawan yang mendapatkan izin dapat melakukan absensi melalui perangkat mobile tanpa batasan radius kantor.',
            ]);
        }

        return $this->successResponse(null, 'Berhasil memperbarui status WFA untuk '.count($users).' karyawan.');
    }

    public function resendVerification($id)
    {
        $employee = User::findOrFail($id);

        if ($employee->email_verified_at) {
            return $this->errorResponse('Email karyawan sudah terverifikasi.', 400);
        }

        // Re-send Welcome & Verification Email
        try {
            // Use the default password set by HR (password123) as confirmed by the user
            $defaultPassword = 'password123';

            Mail::to($employee->email)->send(new WelcomeEmployeeNotification($employee, $defaultPassword));

            $this->logActivity('RESEND_VERIFICATION', "Mengirim ulang email verifikasi ke: {$employee->name}", $employee);

            return $this->successResponse(null, 'Email verifikasi berhasil dikirim ulang.');
        } catch (\Exception $e) {
            Log::error('Gagal mengirim ulang email: '.$e->getMessage());

            return $this->errorResponse('Gagal mengirim ulang email verifikasi.', 500);
        }
    }

    public function resetDeviceId(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('edit-employees'), 403, self::MSG_FORBIDDEN);

        $employee = User::findOrFail($id);

        $oldDeviceId = $employee->device_id;
        $employee->device_id = null;
        $employee->save();

        $this->logActivity('RESET_DEVICE_ID', "Mereset Device ID untuk karyawan: {$employee->name} (Old ID: {$oldDeviceId})", $employee);

        return $this->successResponse(null, 'Device ID berhasil direset. Karyawan sekarang bisa login di perangkat baru.');
    }

    public function bulkResendVerification(Request $request)
    {
        $request->validate([
            'ids' => self::RULE_REQ_ARRAY,
            self::RULE_IDS_ALL => self::RULE_EXISTS_USER,
        ]);

        $employees = User::whereIn('id', $request->ids)->whereNull('email_verified_at')->get();
        $count = 0;

        foreach ($employees as $employee) {
            try {
                // Use the fixed default password confirmed by HR
                $defaultPassword = 'password123';

                Mail::to($employee->email)->send(new WelcomeEmployeeNotification($employee, $defaultPassword));
                $count++;
            } catch (\Exception $e) {
                Log::error("Gagal mengirim ulang email massal ke {$employee->email}: ".$e->getMessage());
            }
        }

        return $this->successResponse(null, "Berhasil mengirim ulang {$count} email verifikasi.");
    }

    public function potentialSupervisors(Request $request)
    {
        $user = $request->user();
        $query = User::select('id', 'name')->where('company_id', $user->company_id);

        // Exclude current employee if editing
        if ($request->exclude_id) {
            $query->where('id', '!=', $request->exclude_id);
        }

        $supervisors = $query->orderBy('name', 'asc')->get();

        return $this->successResponse($supervisors, 'Data calon atasan berhasil diambil.');
    }
}
