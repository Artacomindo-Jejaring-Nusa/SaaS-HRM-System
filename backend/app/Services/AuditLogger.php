<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Request;

class AuditLogger
{
    /**
     * Log a security event to the security channel.
     *
     * @param string $event
     * @param string $message
     * @param array $extra
     * @param string $severity (info, warning, critical)
     */
    public static function log(string $event, string $message, array $extra = [], string $severity = 'info'): void
    {
        $ip = Request::ip();
        $userAgent = Request::header('User-Agent');
        $user = auth()->user();

        $context = array_merge([
            'ip' => $ip,
            'user_agent' => $userAgent,
            'user_id' => $user ? $user->id : null,
            'user_email' => $user ? $user->email : null,
        ], $extra);

        $logMessage = sprintf('[SECURITY][%s] %s', strtoupper($event), $message);

        switch (strtolower($severity)) {
            case 'warning':
                Log::channel('security')->warning($logMessage, $context);
                break;
            case 'critical':
                Log::channel('security')->critical($logMessage, $context);
                break;
            default:
                Log::channel('security')->info($logMessage, $context);
                break;
        }
    }
}
