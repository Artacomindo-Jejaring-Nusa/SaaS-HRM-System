<?php

namespace App\Traits;

use App\Mail\UserNotification;
use App\Models\Notification;
use App\Models\User;
use App\Services\FCMService;
use App\Services\WhatsAppService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

trait Notifiable
{
    /**
     * Send database, push (FCM), email, and WhatsApp notifications to a user
     */
    public function notify(User $user, string $title, string $message, string $type = 'info', ?string $link = null, string $category = 'notif', bool $sendEmail = true, bool $sendWA = true)
    {
        // 1. Create database notification
        Notification::create([
            'user_id' => $user->id,
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'category' => $category,
            'is_read' => false,
            'link' => $link,
        ]);

        // 2. Send push notification via FCM
        try {
            FCMService::sendNotification($user, $title, $message, [
                'type' => $type,
                'category' => $category,
                'link' => $link,
            ]);
        } catch (\Exception $e) {
            Log::error("FCM push failed for user {$user->id}: ".$e->getMessage());
        }

        // 3. Send email if email is present and not skipped
        if ($user->email && $sendEmail) {
            try {
                Mail::to($user->email)->send(new UserNotification($user, $title, $message));
            } catch (\Exception $e) {
                Log::error("Failed to send email to {$user->email}: ".$e->getMessage());
            }
        }

        // 3. Send WhatsApp message via WatZap
        if ($sendWA && $user->phone) {
            try {
                // Ensure company relation is loaded
                if (! $user->relationLoaded('company')) {
                    $user->load('company');
                }

                $waService = new WhatsAppService($user->company);
                $waMessage = "*{$title}*\n\n{$message}";

                if ($link) {
                    $waMessage .= "\n\nCek di sini: ".$link;
                }

                $waService->sendMessage($user->phone, $waMessage);
            } catch (\Exception $e) {
                Log::error("WhatsApp notification failed for user {$user->id}: ".$e->getMessage());
            }
        }
    }
}
