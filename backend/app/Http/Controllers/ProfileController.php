<?php

namespace App\Http\Controllers;

use App\Models\ProfileRequest;
use App\Models\Role;
use App\Models\User;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;

class ProfileController extends Controller
{
    use Notifiable;

    public function update(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string',
        ]);

        $sensitiveFields = ['email', 'phone', 'nik'];
        $directFields = ['name', 'address'];

        // 1. Handle Direct Updates
        $user->update($request->only($directFields));

        // 2. Detect Sensitive Changes
        $newData = $request->only($sensitiveFields);
        $changes = [];

        foreach ($newData as $key => $value) {
            if ($value && $value != $user->$key) {
                $changes[$key] = $value;
            }
        }

        if (! empty($changes)) {
            // Create a request for sensitive fields
            ProfileRequest::create([
                'user_id' => $user->id,
                'company_id' => $user->company_id,
                'old_data' => $user->only(array_keys($changes)),
                'new_data' => $changes,
                'status' => 'pending',
            ]);

            // Notify user
            $this->notify(
                $user,
                'PENGAJUAN PERUBAHAN PROFIL',
                'Permohonan perubahan data profil Anda sedang menunggu persetujuan admin.',
                'info'
            );

            // Notify Admins and HR
            $adminRoles = Role::whereIn('name', ['Super Admin', 'HRD', 'Manager', 'Management'])->pluck('id');

            $admins = User::where('company_id', $user->company_id)
                ->whereIn('role_id', $adminRoles)
                ->get();

            foreach ($admins as $admin) {
                $this->notify(
                    $admin,
                    'PERUBAHAN PROFIL BARU',
                    "{$user->name} telah mengajukan perubahan data profil sensitif (NIK/Email/Telepon).",
                    'warning',
                    '/dashboard/profile-requests' // Link to approval page
                );
            }

            return $this->successResponse([
                'user' => $user->fresh()->load('role.permissions'),
                'needs_approval' => true,
            ], 'Profil diperbarui, namun perubahan nomor telepon/email memerlukan persetujuan admin.');
        }

        return $this->successResponse([
            'user' => $user->fresh()->load('role'),
        ], 'Profil berhasil diperbarui');
    }

    public function uploadPhoto(Request $request)
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        $user = $request->user();

        // Delete old photo if exists
        if ($user->profile_photo_path) {
            Storage::disk('public')->delete($user->profile_photo_path);
        }

        // Compress and store new photo (Avatar size: 400x400)
        $file = $request->file('photo');
        $path = 'profile-photos/'.Str::random(40).'.jpg';

        $img = Image::decode($file);
        $img->cover(400, 400); // Crop and resize to square
        Storage::disk('public')->put($path, (string) $img->encodeUsingFileExtension('jpg', 80));

        $user->update([
            'profile_photo_path' => $path,
        ]);

        return $this->successResponse([
            'profile_photo_url' => asset('storage/'.$path),
        ], 'Foto profil berhasil diperbarui');
    }

    public function me(Request $request)
    {
        $user = $request->user()->load(['role.permissions', 'office', 'company']);

        $today = Carbon::today()->toDateString();
        $todaySchedule = \App\Models\Schedule::with('shift')
            ->where('user_id', $user->id)
            ->whereDate('date', $today)
            ->first();

        $workStartTime = null;
        $workEndTime = null;

        if ($todaySchedule && $todaySchedule->shift) {
            $workStartTime = $todaySchedule->shift->start_time;
            $workEndTime = $todaySchedule->shift->end_time;
        } else {
            $workStartTime = !empty($user->office?->work_start_time) ? $user->office->work_start_time : ($user->company?->work_start_time ?? '08:30:00');
            $workEndTime = !empty($user->office?->work_end_time) ? $user->office->work_end_time : ($user->company?->work_end_time ?? '17:30:00');
        }

        $userData = $user->toArray();
        $userData['work_start_time'] = $workStartTime ? substr($workStartTime, 0, 5) : '08:30';
        $userData['work_end_time'] = $workEndTime ? substr($workEndTime, 0, 5) : '17:30';
        $userData['shift_name'] = $todaySchedule?->shift?->name ?? ($user->attendance_type === 'shift' ? 'Belum Ada Jadwal Shift' : 'Jam Kantor');
        $userData['today_shift'] = $todaySchedule?->shift ? [
            'id' => $todaySchedule->shift->id,
            'name' => $todaySchedule->shift->name,
            'start_time' => substr($todaySchedule->shift->start_time, 0, 5),
            'end_time' => substr($todaySchedule->shift->end_time, 0, 5),
        ] : null;
        $userData['schedule_label'] = $todaySchedule?->shift
            ? substr($todaySchedule->shift->start_time, 0, 5) . ' - ' . substr($todaySchedule->shift->end_time, 0, 5) . ' (' . $todaySchedule->shift->name . ')'
            : substr($userData['work_start_time'], 0, 5) . ' - ' . substr($userData['work_end_time'], 0, 5) . ' (Normal)';

        return $this->successResponse([
            'user' => $userData,
        ]);
    }
}
