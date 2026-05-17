<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class NotificationController extends Controller
{
    public function index()
    {
        /** @var User $user */
        $user = Auth::user();
        $notifications = $user->notifications()->orderBy('id', 'desc')->paginate(10);

        return response()->json([
            'status' => 'success',
            'data' => $notifications,
        ]);
    }

    public function markAsRead($id)
    {
        /** @var User $user */
        $user = Auth::user();
        $notification = $user->notifications()->findOrFail($id);
        $notification->update(['is_read' => true]);

        return response()->json([
            'status' => 'success',
            'message' => 'Notification marked as read',
        ]);
    }

    public function markAllAsRead()
    {
        /** @var User $user */
        $user = Auth::user();
        $user->notifications()->where('is_read', false)->update(['is_read' => true]);

        return response()->json([
            'status' => 'success',
            'message' => 'All notifications marked as read',
        ]);
    }

    public function destroyAll()
    {
        /** @var User $user */
        $user = Auth::user();
        $user->notifications()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'All notifications deleted',
        ]);
    }

    public function updateFCMToken(Request $request)
    {
        $request->validate([
            'fcm_token' => 'required|string',
        ]);

        /** @var User $user */
        $user = Auth::user();
        $user->update(['fcm_token' => $request->fcm_token]);

        Log::info("FCM Token (NotificationController) updated for User ID: {$user->id}");

        return response()->json([
            'status' => 'success',
            'message' => 'FCM Token updated successfully',
        ]);
    }
}
