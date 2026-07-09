<?php

namespace App\Services;

use App\Models\Company;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    protected $apiKey;

    protected $baseUrl;

    public function __construct($company = null)
    {
        // Default to environment variables
        $this->apiKey = env('FONNTE_TOKEN', config('services.watzap.api_key'));
        $this->baseUrl = env('FONNTE_BASE_URL', 'https://api.fonnte.com/');

        // If company is provided, override with company-specific settings
        if ($company instanceof Company) {
            $companyId = $company->id;
            Log::info("WhatsAppService (Fonnte) initialized for Company ID: {$companyId}");

            // We reuse the database field 'watzap_api_key' to store Fonnte Token
            if ($company->watzap_api_key) {
                $this->apiKey = $company->watzap_api_key;
                Log::info('Using Database Fonnte Token (Masked): '.substr($this->apiKey, 0, 4).'...');
            }

            if ($company->watzap_base_url) {
                $this->baseUrl = $company->watzap_base_url;
            }
        } else {
            Log::warning('WhatsAppService initialized WITHOUT Company context. Falling back to env.');
        }
    }

    /**
     * Send a text message via Fonnte
     *
     * @param  string  $phone  Phone number in international format (e.g. 628123456789)
     * @param  string  $message  The message content
     * @return bool
     */
    public function sendMessage($phone, $message)
    {
        if (! $this->apiKey) {
            Log::error('WhatsAppService: Fonnte Token is MISSING.');

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

        // Ensure base URL ends with / and appends send
        $url = rtrim($this->baseUrl, '/').'/send';

        try {
            $payload = [
                'target' => $phone,
                'message' => $message,
                'countryCode' => '62',
            ];

            $response = Http::withHeaders([
                'Authorization' => $this->apiKey,
            ])->post($url, $payload);

            if ($response->successful()) {
                $data = $response->json();
                if (isset($data['status']) && $data['status'] === true) {
                    return true;
                }
                Log::error('Fonnte API Error: '.json_encode($data));
            } else {
                Log::error("Fonnte Request Failed to {$url}. Status: ".$response->status().' Body: '.$response->body());
            }
        } catch (\Exception $e) {
            Log::error("WhatsAppService Exception for phone {$phone}: ".$e->getMessage());
        }

        return false;
    }
}

