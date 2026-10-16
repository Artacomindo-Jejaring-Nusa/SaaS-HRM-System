<?php

namespace App\Traits;

use App\Services\FaceRecognitionService;

trait HandlesAttendanceSecurity
{
    private function validateDeviceAndSecurity($user, $request, string $type = 'in')
    {
        $deviceErr = $this->checkDeviceSecurity($user, $request);
        if ($deviceErr) {
            return $deviceErr;
        }

        return $this->verifyFaceAttendance($user, $request, $type);
    }

    private function checkDeviceSecurity($user, $request): ?array
    {
        if ($request->is_mocked) {
            return ['message' => 'Lokasi Palsu Terdeteksi! Mohon gunakan GPS asli perangkat Anda.', 'code' => 403];
        }

        $isSuperAdmin = $user->role_id === 1 || (method_exists($user, 'canAccessAllCompanies') && $user->canAccessAllCompanies());

        if ($request->device_id) {
            if (! $user->device_id) {
                $user->update(['device_id' => $request->device_id]);
            } elseif ($user->device_id !== $request->device_id) {
                if (! $isSuperAdmin) {
                    return ['message' => 'HP Anda tidak terdaftar. Mohon hubungi Admin untuk reset Device ID.', 'code' => 403];
                }
            }
        }

        return null;
    }

    private function checkFacePrerequisites($user, $request): ?array
    {
        if ($user->face_status !== 'approved' || empty($user->face_embedding)) {
            $msg = match ($user->face_status) {
                'pending' => 'Pendaftaran foto wajah Anda masih dalam status PENDING (Menunggu persetujuan Super Admin). Anda belum dapat melakukan absensi hingga disetujui.',
                'rejected' => 'Pendaftaran wajah Anda DITOLAK oleh Admin. Silakan lakukan pendaftaran ulang wajah di menu Pengaturan.',
                default => 'Wajah Anda belum terdaftar di sistem. Silakan daftarkan wajah Anda terlebih dahulu pada menu Pengaturan -> Pendaftaran Wajah.',
            };

            return ['message' => $msg, 'code' => 422];
        }

        $imageInput = $request->hasFile('image') ? $request->file('image') : ($request->image ?? $request->image_base64);
        if (! $imageInput) {
            return ['message' => 'Foto selfie absensi wajib disertakan untuk verifikasi wajah.', 'code' => 422];
        }

        return null;
    }

    private function evaluateFaceVerificationResult(array $verifyResult): ?array
    {
        $similarityPercent = 0;
        if (isset($verifyResult['similarity_percentage'])) {
            $similarityPercent = $verifyResult['similarity_percentage'];
        } elseif (isset($verifyResult['similarity'])) {
            $similarityPercent = round($verifyResult['similarity'] * 100, 1);
        }

        // If explicitly face_detected is false AND similarity is extremely low (meaning no face found).
        if (isset($verifyResult['face_detected']) && $verifyResult['face_detected'] === false && $similarityPercent < 1.0) {
            return [
                'message' => 'Verifikasi Wajah Gagal: Wajah Anda tidak terdeteksi pada foto selfie. Harap posisikan seluruh wajah Anda di depan kamera (tidak terpotong / bukan benda) dengan pencahayaan yang cukup.',
                'code' => 422,
            ];
        }

        // If it's not a match, or if similarity is below our minimum threshold
        $isMatch = isset($verifyResult['is_match']) ? $verifyResult['is_match'] : false;

        // Safety net: if the API returned is_match=false but the score is very high (>= 75%), we force it to pass
        if (! $isMatch && $similarityPercent >= 75.0) {
            $isMatch = true;
        }

        if (! $isMatch) {
            return [
                'message' => "Verifikasi Wajah Gagal: Wajah Anda tidak sesuai dengan data foto pendaftaran yang disetujui (Skor Kemiripan: {$similarityPercent}%). Minimal skor adalah 75%.",
                'code' => 422,
            ];
        }

        return null;
    }

    private function verifyFaceAttendance($user, $request, string $type): ?array
    {
        if ($request->boolean('bypass_face_recognition')) {
            $request->attributes->set('face_similarity_score_'.$type, 0.0);
            $request->attributes->set('is_face_verified_'.$type, false);

            return null; // Bypass verifikasi wajah berhasil
        }

        $error = $this->checkFacePrerequisites($user, $request);
        if ($error === null) {
            $imageInput = $request->hasFile('image') ? $request->file('image') : ($request->image ?? $request->image_base64);
            $faceService = app(FaceRecognitionService::class);
            $verifyResult = $faceService->verifyFace($user->face_embedding, $imageInput);

            $error = $this->evaluateFaceVerificationResult($verifyResult);
            if ($error === null) {
                $request->attributes->set('face_similarity_score_'.$type, $verifyResult['similarity'] ?? 1.0);
                $request->attributes->set('is_face_verified_'.$type, true);
            }
        }

        return $error;
    }
}
