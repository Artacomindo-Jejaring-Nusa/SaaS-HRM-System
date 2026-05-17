<?php

namespace App\Services;

use App\Models\Company;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    protected $apiKey;

    protected $numberKey;

    protected $baseUrl;

    public function __construct($company = null)
    {
        // Default to environment variables
        $this->apiKey = config('services.watzap.api_key');
        $this->numberKey = config('services.watzap.number_key');
        $this->baseUrl = config('services.watzap.base_url', 'https://api.watzap.id/v1/');

        // If company is provided, override with company-specific settings
        if ($company instanceof Company) {
            $companyId = $company->id;
            Log::info("WhatsAppService initialized for Company ID: {$companyId}");

            if ($company->watzap_api_key) {
                $this->apiKey = $company->watzap_api_key;
                Log::info('Using Database API Key (Masked): '.substr($this->apiKey, 0, 4).'...');
            }

            if ($company->watzap_number_key) {
                $this->numberKey = $company->watzap_number_key;
            }

            if ($company->watzap_base_url) {
                $this->baseUrl = $company->watzap_base_url;
            }
        } else {
            Log::warning('WhatsAppService initialized WITHOUT Company context. Falling back to .env.');
        }
    }

    /**
     * Send a text message via WatZap
     *
     * @param  string  $phone  Phone number in international format (e.g. 628123456789)
     * @param  string  $message  The message content
     * @return bool
     */
    public function sendMessage($phone, $message)
    {
        if (! $this->apiKey || ! $this->numberKey) {
            Log::error('WhatsAppService: API Key or Number Key is MISSING.');

            return false;
        }

        if (empty($phone)) {
            Log::warning('WhatsAppService: Phone number is empty.');

            return false;
        }

        // Ensure phone starts with 62 (standard for ID) if it starts with 0
        if (str_starts_with($phone, '0')) {
            $phone = '62'.substr($phone, 1);
        } elseif (! str_starts_with($phone, '62') && ! str_starts_with($phone, '+')) {
            // Default to 62 if no prefix
            $phone = '62'.$phone;
        }

        // Remove '+' if present
        $phone = str_replace('+', '', $phone);

        // Ensure base URL ends with /
        $url = rtrim($this->baseUrl, '/').'/send_message';

        try {
            $payload = [
                'api_key' => $this->apiKey,
                'number_key' => $this->numberKey,
                'phone_no' => $phone,
                'message' => $message,
            ];

            $response = Http::post($url, $payload);

            if ($response->successful()) {
                $data = $response->json();
                if (isset($data['status']) && ($data['status'] == '200' || $data['status'] === true)) {
                    return true;
                }
                Log::error('WatZap API Error: '.json_encode($data));
            } else {
                Log::error("WatZap Request Failed to {$url}. Status: ".$response->status().' Body: '.$response->body());
            }
        } catch (\Exception $e) {
            Log::error("WhatsAppService Exception for phone {$phone}: ".$e->getMessage());
        }

        return false;
    }
}
