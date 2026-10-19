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
    public const SQL_LOWER_NAME_LIKE = 'LOWER(name) LIKE ?';

    /**
     * Send database, push (FCM), email, and WhatsApp notifications to a user
     */
    public function notify(
        User $user,
        string $title,
        string $message,
        string $type = 'info',
        ?string $link = null,
        string $category = 'notif',
        array|bool $channels = true
    ) {
        $sendEmail = is_array($channels) ? ($channels['email'] ?? true) : (bool) $channels;
        $sendWA = is_array($channels) ? ($channels['wa'] ?? true) : (bool) $channels;

        $this->recordDatabaseNotification($user, $title, $message, $type, $link, $category);
        $this->sendFcmPushNotification($user, $title, $message, $type, $link, $category);

        if ($user->email && $sendEmail) {
            $this->sendEmailNotification($user, $title, $message);
        }

        if ($sendWA && $user->phone) {
            $this->sendWhatsAppNotification($user, $title, $message, $link);
        }
    }

    private function recordDatabaseNotification(User $user, string $title, string $message, string $type, ?string $link, string $category): void
    {
        try {
            Notification::create([
                'user_id' => $user->id,
                'title' => $title,
                'message' => $message,
                'type' => $type,
                'category' => $category,
                'is_read' => false,
                'link' => $link,
            ]);
        } catch (\Throwable $e) {
            Log::error("Database/Broadcast notification failed for user {$user->id}: ".$e->getMessage());
        }
    }

    private function sendFcmPushNotification(User $user, string $title, string $message, string $type, ?string $link, string $category): void
    {
        try {
            FCMService::sendNotification($user, $title, $message, [
                'type' => $type,
                'category' => $category,
                'link' => $link,
            ]);
        } catch (\Exception $e) {
            Log::error("FCM push failed for user {$user->id}: ".$e->getMessage());
        }
    }

    private function sendEmailNotification(User $user, string $title, string $message): void
    {
        try {
            Mail::to($user->email)->send(new UserNotification($user, $title, $message));
        } catch (\Exception $e) {
            Log::error("Failed to send email to {$user->email}: ".$e->getMessage());
        }
    }

    private function sendWhatsAppNotification(User $user, string $title, string $message, ?string $link): void
    {
        try {
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

    /**
     * Send notifications to Super Admins (both global super admins and company-specific super admins).
     *
     * @param  int|null  $companyId  The company ID associated with the request/event
     * @param  string  $title  Notification title
     * @param  string  $message  Notification body message
     * @param  string  $type  Notification badge/type (info, warning, success, danger)
     * @param  string|null  $link  Link to redirect in dashboard
     * @param  int|null  $exceptUserId  User ID to exclude (e.g. the actor performing the action)
     */
    public function notifySuperAdmins(?int $companyId, string $title, string $message, string $type = 'info', ?string $link = null, ?int $exceptUserId = null): void
    {
        $query = User::query();

        // Must be super admin (role_id 1 or role name contains 'super admin')
        $query->where(function ($q) {
            $q->where('role_id', 1)
                ->orWhereHas('role', function ($r) {
                    $r->whereRaw(self::SQL_LOWER_NAME_LIKE, ['%super admin%']);
                });
        });

        // Tenant filtering: Global super admins (role_id 1 or null company_id) or tenant super admin of this company
        if ($companyId) {
            $query->where(function ($q) use ($companyId) {
                $q->whereNull('company_id')
                    ->orWhere('role_id', 1)
                    ->orWhere('company_id', $companyId);
            });
        }

        if ($exceptUserId) {
            $query->where('id', '!=', $exceptUserId);
        }

        $superAdmins = $query->get()->unique('id');

        foreach ($superAdmins as $admin) {
            $this->notify($admin, $title, $message, $type, $link, 'notif', false);
        }
    }

    /**
     * Send notifications to relevant approvers and admins (Super Admins, Company Admins, HRD, and module approvers).
     */
    public function notifyCompanyApprovers(
        ?int $companyId,
        string $title,
        string $message,
        string $type = 'warning',
        ?string $link = null,
        ?int $exceptUserId = null,
        ?string $permission = null
    ): void {
        $query = User::query();

        $query->where(function ($q) use ($permission) {
            $q->where('role_id', 1)
                ->orWhereHas('role', function ($r) {
                    $r->whereRaw(self::SQL_LOWER_NAME_LIKE, ['%super admin%'])
                        ->orWhereRaw(self::SQL_LOWER_NAME_LIKE, ['%admin%'])
                        ->orWhereRaw(self::SQL_LOWER_NAME_LIKE, ['%hrd%'])
                        ->orWhereRaw(self::SQL_LOWER_NAME_LIKE, ['%finance%']);
                });

            if ($permission) {
                $q->orWhereHas('role.permissions', function ($p) use ($permission) {
                    $p->where('slug', $permission)->orWhere('slug', 'manage-approvals');
                });
            }
        });

        if ($companyId) {
            $query->where(function ($q) use ($companyId) {
                $q->whereNull('company_id')
                    ->orWhere('role_id', 1)
                    ->orWhere('company_id', $companyId);
            });
        }

        $allApprovers = $query->get()->unique('id');

        $recipients = $allApprovers;
        if ($exceptUserId) {
            $filtered = $allApprovers->where('id', '!=', $exceptUserId);
            if ($filtered->isNotEmpty()) {
                $recipients = $filtered;
            }
        }

        foreach ($recipients as $recipient) {
            $this->notify($recipient, $title, $message, $type, $link, 'notif', false);
        }
    }
}
