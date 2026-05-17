<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\User;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
    use Notifiable;

    private const MSG_FORBIDDEN = 'Akses ditolak.';

    public function index(Request $request)
    {
        $announcements = Announcement::where('company_id', $request->user()->company_id)
            ->with('user')
            ->orderBy('id', 'desc')
            ->paginate(10);

        return $this->successResponse($announcements, 'Daftar pengumuman berhasil diambil.');
    }

    public function store(Request $request)
    {
        abort_if(! $request->user()->hasPermission('manage-announcements'), 403, self::MSG_FORBIDDEN);
        $request->validate([
            'title' => 'required|string',
            'content' => 'required|string',
        ]);

        $announcement = Announcement::create([
            'company_id' => $request->user()->company_id,
            'user_id' => $request->user()->id,
            'title' => $request->input('title'),
            'content' => $request->input('content'),
        ]);

        // Broadcast to all company members
        $members = User::where('company_id', $request->user()->company_id)
            ->where('id', '!=', $request->user()->id)
            ->get();

        foreach ($members as $member) {
            /** @var User $member */

            // Send multi-channel notification via Trait
            // Includes: Database, FCM, Email, and WhatsApp
            $this->notify(
                $member,
                "PENGUMUMAN RESMI: {$announcement->title}",
                "Halo {$member->name}, terdapat pengumuman baru dari perusahaan:\n\n*{$announcement->title}*\n\n{$announcement->content}",
                'info',
                '/dashboard/announcements',
                'mail', // Category KOTAK PESAN
                true,   // Send Email
                true    // Send WhatsApp
            );
        }

        $this->logActivity('CREATE_ANNOUNCEMENT', "Membuat pengumuman baru: {$request->title}", $announcement);

        return $this->successResponse($announcement, 'Pengumuman berhasil dipublish.', 201);
    }

    public function update(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('manage-announcements'), 403, self::MSG_FORBIDDEN);
        $announcement = Announcement::where('company_id', $request->user()->company_id)->findOrFail($id);

        $request->validate([
            'title' => 'sometimes|string',
            'content' => 'sometimes|string',
        ]);

        $announcement->update($request->all());

        $this->logActivity('UPDATE_ANNOUNCEMENT', "Memperbarui pengumuman: {$announcement->title}", $announcement);

        return $this->successResponse($announcement, 'Pengumuman berhasil diperbarui.');
    }

    public function destroy(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('manage-announcements'), 403, self::MSG_FORBIDDEN);
        $announcement = Announcement::where('company_id', $request->user()->company_id)->findOrFail($id);
        $title = $announcement->title;
        $announcement->delete();

        $this->logActivity('DELETE_ANNOUNCEMENT', "Menghapus pengumuman: {$title}");

        return $this->successResponse(null, 'Pengumuman berhasil dihapus.');
    }
}
