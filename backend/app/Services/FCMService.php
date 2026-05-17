<?php

namespace App\Services;

use App\Models\User;
use Google_Client;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FCMService
{
    /**
     * Send a push notification via Firebase Cloud Messaging (v1)
     *
     * @return bool
     */
    public static function sendNotification(User $user, string $title, string $body, array $data = [])
    {
        if (! $user->fcm_token) {
            Log::warning("Skipping FCM notification: User ID {$user->id} has no token.");

            return false;
        }

        try {
            $credentials_filepath = storage_path('app/firebase-auth.json');

            if (! file_exists($credentials_filepath)) {
                Log::error('FCM Error: Service account JSON file not found at '.$credentials_filepath);

                return false;
            }

            // Get Google Access Token
            $client = new Google_Client;
            $client->setAuthConfig($credentials_filepath);
            $client->addScope('https://www.googleapis.com/auth/firebase.messaging');

            // Fix cURL error 77 (SSL Certificate issue in Local/Laragon)
            $cacertPath = 'C:\\laragon\\etc\\ssl\\cacert.pem';
            if (! file_exists($cacertPath)) {
                $cacertPath = 'C:\\laragon\\bin\\php\\php8.1.10-Win32-vs16-x64\\extras\\ssl\\cacert.pem';
            }

            if (file_exists($cacertPath)) {
                @ini_set('curl.cainfo', $cacertPath);
                @ini_set('openssl.cafile', $cacertPath);
                putenv("SSL_CERT_FILE=$cacertPath");
                putenv("CURL_CA_BUNDLE=$cacertPath");
            }

            $httpClient = new Client([
                'verify' => false,
                'timeout' => 30,
            ]);
            $client->setHttpClient($httpClient);

            if ($httpClient) {
                // Remove the redundant argument that causes type mismatch
                $accessToken = $client->fetchAccessTokenWithAssertion();
            }

            if (! isset($accessToken['access_token'])) {
                Log::error('FCM Error: Failed to fetch access token.');

                return false;
            }

            $token = $accessToken['access_token'];
            $project_id = json_decode(file_get_contents($credentials_filepath))->project_id;

            // Send to FCM v1 API
            $response = Http::withOptions(['verify' => false])
                ->withHeaders([
                    'Authorization' => "Bearer $token",
                    'Content-Type' => 'application/json',
                ])->post("https://fcm.googleapis.com/v1/projects/$project_id/messages:send", [
                    'message' => [
                        'token' => $user->fcm_token,
                        'notification' => [
                            'title' => $title,
                            'body' => $body,
                        ],
                        'data' => ! empty($data) ? array_map('strval', $data) : null,
                        'android' => [
                            'priority' => 'high',
                            'notification' => [
                                'sound' => 'default',
                                'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                                'notification_priority' => 'PRIORITY_HIGH',
                                'channel_id' => 'hrm_notif_channel_v2', // Match the one in Flutter
                            ],
                        ],
                    ],
                ]);

            if ($response->successful()) {
                Log::info("FCM Notification sent successfully to user {$user->id}");

                return true;
            } else {
                Log::error('FCM Error response: '.$response->body());

                return false;
            }
        } catch (\Exception $e) {
            Log::error('FCM Exception: '.$e->getMessage());

            return false;
        }
    }

    /**
     * Send a broadcast notification to multiple users.
     *
     * @param  mixed  $users
     * @return void
     */
    public static function broadcastNotification($users, string $title, string $body, array $data = [])
    {
        foreach ($users as $user) {
            self::sendNotification($user, $title, $body, $data);
        }
    }
}
