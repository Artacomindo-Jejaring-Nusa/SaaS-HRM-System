<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class FaceRecognitionService
{
    protected string $aiServiceUrl;
    protected float $defaultThreshold;

    public function __construct()
    {
        $this->aiServiceUrl = rtrim(env('AI_SERVICE_URL', 'http://127.0.0.1:8001'), '/');
        $this->defaultThreshold = (float) env('FACE_RECOGNITION_THRESHOLD', 0.70);
    }

    /**
     * Mengekstrak 128-d vektor wajah dari file upload atau file path.
     *
     * @param UploadedFile|string $imageInput
     * @return array
     */
    public function extractFaceEmbedding($imageInput): array
    {
        // 1. Coba panggil Microservice HTTP FastAPI
        try {
            $response = null;

            if ($imageInput instanceof UploadedFile) {
                $response = Http::timeout(10)
                    ->attach('file', file_get_contents($imageInput->getRealPath()), $imageInput->getClientOriginalName())
                    ->post("{$this->aiServiceUrl}/api/face/extract");
            } elseif (is_string($imageInput) && file_exists($imageInput)) {
                $response = Http::timeout(10)
                    ->attach('file', file_get_contents($imageInput), basename($imageInput))
                    ->post("{$this->aiServiceUrl}/api/face/extract");
            } elseif (is_string($imageInput)) {
                // Base64 string
                $response = Http::timeout(10)
                    ->asForm()
                    ->post("{$this->aiServiceUrl}/api/face/extract", [
                        'image_base64' => $imageInput,
                    ]);
            }

            if ($response && $response->successful()) {
                return $response->json();
            }
        } catch (\Throwable $e) {
            Log::warning("[FaceRecognitionService] HTTP AI Service unreachable: " . $e->getMessage() . ". Falling back to CLI.");
        }

        // 2. Fallback CLI: Jalankan python ai_service/cli.py langsung
        return $this->extractViaCli($imageInput);
    }

    /**
     * Memverifikasi wajah pada foto saat ini dengan data vektor yang terdaftar di database.
     *
     * @param array $registeredEmbedding Array 128 float
     * @param UploadedFile|string $currentImage
     * @param float|null $threshold
     * @return array
     */
    public function verifyFace($registeredEmbedding, $currentImage, ?float $threshold = null): array
    {
        $threshold = $threshold ?? $this->defaultThreshold;

        // Normalisasi embedding
        if (is_string($registeredEmbedding)) {
            $registeredEmbedding = json_decode($registeredEmbedding, true);
        }

        if (!is_array($registeredEmbedding) || empty($registeredEmbedding) || count($registeredEmbedding) !== 128) {
            return [
                'success' => false,
                'is_match' => false,
                'similarity' => 0.0,
                'message' => 'Data vektor wajah karyawan tidak valid atau belum terdaftar.',
            ];
        }

        // 1. Coba panggil Microservice HTTP FastAPI
        try {
            $response = null;
            $regJson = json_encode($registeredEmbedding);

            if ($currentImage instanceof UploadedFile) {
                $response = Http::timeout(10)
                    ->attach('file', file_get_contents($currentImage->getRealPath()), $currentImage->getClientOriginalName())
                    ->post("{$this->aiServiceUrl}/api/face/verify", [
                        'registered_embedding' => $regJson,
                        'threshold' => $threshold,
                    ]);
            } elseif (is_string($currentImage) && file_exists($currentImage)) {
                $response = Http::timeout(10)
                    ->attach('file', file_get_contents($currentImage), basename($currentImage))
                    ->post("{$this->aiServiceUrl}/api/face/verify", [
                        'registered_embedding' => $regJson,
                        'threshold' => $threshold,
                    ]);
            } elseif (is_string($currentImage)) {
                $response = Http::timeout(10)
                    ->asForm()
                    ->post("{$this->aiServiceUrl}/api/face/verify", [
                        'registered_embedding' => $regJson,
                        'threshold' => $threshold,
                        'image_base64' => $currentImage,
                    ]);
            }

            if ($response && $response->successful()) {
                $result = $response->json();
                if (isset($result['is_match'])) {
                    return $result;
                }
            }
        } catch (\Throwable $e) {
            Log::warning("[FaceRecognitionService] HTTP AI Service verify unreachable: " . $e->getMessage() . ". Falling back to CLI.");
        }

        // 2. Fallback CLI
        return $this->verifyViaCli($registeredEmbedding, $currentImage, $threshold);
    }

    /**
     * Ekstraksi via CLI Python fallback
     */
    protected function extractViaCli($imageInput): array
    {
        $tempPath = null;
        if ($imageInput instanceof UploadedFile) {
            $tempPath = $imageInput->getRealPath();
        } elseif (is_string($imageInput) && file_exists($imageInput)) {
            $tempPath = $imageInput;
        } else {
            // Write base64 to temp file
            $tempPath = tempnam(sys_get_temp_dir(), 'face_') . '.jpg';
            $data = str_contains($imageInput, ',') ? explode(',', $imageInput)[1] : $imageInput;
            file_put_contents($tempPath, base64_decode($data));
        }

        $scriptPath = base_path('ai_service/cli.py');
        if (!file_exists($scriptPath)) {
            $scriptPath = base_path('../ai_service/cli.py');
        }

        $process = new Process(['python', $scriptPath, 'extract', '--image', $tempPath]);
        $process->setTimeout(30);
        $process->run();

        if (!$process->isSuccessful()) {
            Log::error("[FaceRecognitionService CLI Extract Error]: " . $process->getErrorOutput());
            return [
                'success' => false,
                'message' => 'Gagal memproses ekstraksi wajah AI (CLI error).',
                'error' => $process->getErrorOutput()
            ];
        }

        $result = json_decode($process->getOutput(), true);
        return $result ?? ['success' => false, 'message' => 'Invalid JSON dari AI CLI.'];
    }

    /**
     * Verifikasi via CLI Python fallback
     */
    protected function verifyViaCli(array $registeredEmbedding, $currentImage, float $threshold): array
    {
        $tempImgPath = null;
        if ($currentImage instanceof UploadedFile) {
            $tempImgPath = $currentImage->getRealPath();
        } elseif (is_string($currentImage) && file_exists($currentImage)) {
            $tempImgPath = $currentImage;
        } else {
            $tempImgPath = tempnam(sys_get_temp_dir(), 'face_ver_') . '.jpg';
            $data = str_contains($currentImage, ',') ? explode(',', $currentImage)[1] : $currentImage;
            file_put_contents($tempImgPath, base64_decode($data));
        }

        // Tulis array embedding ke file JSON sementara untuk menghindari masalah argument escaping di Windows CLI
        $tempJsonPath = tempnam(sys_get_temp_dir(), 'face_emb_') . '.json';
        file_put_contents($tempJsonPath, json_encode($registeredEmbedding));

        $scriptPath = base_path('ai_service/cli.py');
        if (!file_exists($scriptPath)) {
            $scriptPath = base_path('../ai_service/cli.py');
        }

        $process = new Process([
            'python',
            $scriptPath,
            'verify',
            '--image',
            $tempImgPath,
            '--registered-embedding',
            $tempJsonPath,
            '--threshold',
            (string) $threshold
        ]);
        $process->setTimeout(30);
        $process->run();

        @unlink($tempJsonPath);

        if (!$process->isSuccessful()) {
            Log::error("[FaceRecognitionService CLI Verify Error]: " . $process->getErrorOutput());
            return [
                'success' => false,
                'is_match' => false,
                'similarity' => 0.0,
                'message' => 'Gagal memverifikasi wajah AI (CLI error).',
            ];
        }

        $result = json_decode($process->getOutput(), true);
        return $result ?? ['success' => false, 'is_match' => false, 'similarity' => 0.0, 'message' => 'Invalid output JSON'];
    }
}
