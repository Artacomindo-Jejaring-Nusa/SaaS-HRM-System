<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Company;
use App\Models\RefreshToken;
use App\Models\User;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Access token lifetime in minutes.
     */
    private const ACCESS_TOKEN_MINUTES = 60;

    /**
     * Refresh token lifetime in days.
     */
    private const REFRESH_TOKEN_DAYS = 30;

    private const MSG_INVALID_CREDS = 'Invalid credentials';
    private const RULE_REQ_STRING = 'required|string';
    private const RULE_REQ_EMAIL = 'required|email';

    public function searchCompanies(Request $request)
    {
        $query = $request->get('q');

        $companies = Company::where('name', 'like', "%$query%")
            ->select('id', 'name')
            ->limit(10)
            ->get();

        return $this->successResponse($companies, 'Companies found');
    }

    public function login(Request $request)
    {
        try {
            $request->validate([
                'email' => self::RULE_REQ_EMAIL,
                'password' => 'required',
                'company_name' => self::RULE_REQ_STRING,
            ]);
        } catch (ValidationException $e) {
            return $this->errorResponse(self::MSG_INVALID_CREDS, 401);
        }

        $company = Company::where('name', $request->company_name)
            ->orWhere('name', 'like', '%'.$request->company_name.'%')
            ->first();

        if (! $company) {
            return $this->errorResponse(self::MSG_INVALID_CREDS, 401);
        }

        $user = User::where('email', $request->email)
            ->where('company_id', $company->id)
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return $this->errorResponse('Invalid credentials', 401);
        }

        // --- Device Binding & FCM Token ---
        $updateData = [];
        if ($request->device_id) {
            if (! $user->device_id) {
                $updateData['device_id'] = $request->device_id;
            } elseif ($user->device_id !== $request->device_id) {
                return $this->errorResponse('Akun Anda terkunci pada perangkat lain. Silakan hubungi Admin untuk reset Device ID Anda.', 403);
            }
        }

        if ($request->fcm_token) {
            $updateData['fcm_token'] = $request->fcm_token;
        }

        if (! empty($updateData)) {
            $user->update($updateData);
        }

        // --- Generate Access Token (short-lived) ---
        $accessToken = $user->createToken('auth_token', ['*'], now()->addMinutes(self::ACCESS_TOKEN_MINUTES))->plainTextToken;

        // --- Generate Refresh Token (long-lived) ---
        // Revoke old refresh tokens for this device (token rotation)
        if ($request->device_id) {
            RefreshToken::revokeForDevice($user->id, $request->device_id);
        }

        $refreshTokenData = RefreshToken::generateFor(
            $user,
            $request->device_id,
            $request->ip(),
            $request->userAgent(),
            self::REFRESH_TOKEN_DAYS
        );

        ActivityLog::create([
            'company_id' => $user->company_id,
            'user_id' => $user->id,
            'action' => 'LOGIN',
            'description' => "User {$user->name} berhasil masuk ke sistem.",
        ]);

        return $this->successResponse([
            'access_token' => $accessToken,
            'refresh_token' => $refreshTokenData['plain_token'],
            'token_type' => 'Bearer',
            'expires_in' => self::ACCESS_TOKEN_MINUTES * 60, // in seconds
            'refresh_expires_in' => self::REFRESH_TOKEN_DAYS * 86400, // in seconds
            'user' => $user->load(['role.permissions', 'office']),
        ], 'Login berhasil');
    }

    /**
     * Refresh the access token using a valid refresh token.
     * Implements token rotation: old refresh token is revoked and new one issued.
     */
    public function refreshToken(Request $request)
    {
        try {
            $request->validate([
                'refresh_token' => self::RULE_REQ_STRING,
            ]);
        } catch (ValidationException $e) {
            return $this->errorResponse('Refresh token diperlukan.', 422);
        }

        // Find the valid refresh token
        $refreshToken = RefreshToken::findValidToken($request->refresh_token);

        if (! $refreshToken) {
            return $this->errorResponse('Refresh token tidak valid atau sudah kadaluarsa. Silakan login ulang.', 401);
        }

        $user = $refreshToken->user;

        if (! $user) {
            $refreshToken->revoke();

            return $this->errorResponse('User tidak ditemukan.', 401);
        }

        // --- Token Rotation ---
        // 1. Revoke the old refresh token
        $refreshToken->revoke();

        // 2. Revoke all current access tokens for this user (optional: only current device)
        // We delete old tokens to prevent token accumulation
        $user->tokens()->where('created_at', '<', now()->subMinutes(self::ACCESS_TOKEN_MINUTES))->delete();

        // 3. Create new access token
        $newAccessToken = $user->createToken('auth_token', ['*'], now()->addMinutes(self::ACCESS_TOKEN_MINUTES))->plainTextToken;

        // 4. Create new refresh token (rotation)
        $newRefreshTokenData = RefreshToken::generateFor(
            $user,
            $refreshToken->device_id,
            $request->ip(),
            $request->userAgent(),
            self::REFRESH_TOKEN_DAYS
        );

        // Update last used timestamp
        $refreshToken->markAsUsed();

        return $this->successResponse([
            'access_token' => $newAccessToken,
            'refresh_token' => $newRefreshTokenData['plain_token'],
            'token_type' => 'Bearer',
            'expires_in' => self::ACCESS_TOKEN_MINUTES * 60,
            'refresh_expires_in' => self::REFRESH_TOKEN_DAYS * 86400,
        ], 'Token berhasil diperbarui.');
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        $this->logActivity('LOGOUT', "User {$user->name} keluar dari sistem.");

        // Clear FCM token on logout for security
        $user->update(['fcm_token' => null]);

        // Revoke all refresh tokens for this user
        RefreshToken::revokeAllForUser($user->id);

        $user->currentAccessToken()->delete();

        return $this->successResponse(null, 'Logged out successfully');
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required',
            'new_password' => 'required|min:8|confirmed',
        ]);

        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            return $this->errorResponse('Kata sandi saat ini salah.', 422);
        }

        $user->update([
            'password' => Hash::make($request->new_password),
        ]);

        // Revoke all refresh tokens on password change (security best practice)
        RefreshToken::revokeAllForUser($user->id);

        // Revoke all access tokens except current one
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        $this->logActivity('CHANGE_PASSWORD', "User {$user->name} telah mengubah kata sandi akunnya.");

        return $this->successResponse(null, 'Kata sandi berhasil diubah.');
    }

    public function verifyEmail($token)
    {
        // Simple token-based verification (base64 encoded email for this example, or a custom field)
        // In a real app, use Illuminate\Auth\Events\Verified or a signed URL
        try {
            $email = base64_decode($token);
            $user = User::where('email', $email)->first();

            if (! $user) {
                return $this->errorResponse('Tautan verifikasi tidak valid.', 404);
            }

            if ($user->email_verified_at) {
                return $this->successResponse(null, 'Email sudah diverifikasi sebelumnya.');
            }

            $user->email_verified_at = now();
            $user->save();

            ActivityLog::create([
                'company_id' => $user->company_id,
                'user_id' => $user->id,
                'action' => 'VERIFY_EMAIL',
                'description' => "User {$user->name} berhasil verifikasi email.",
            ]);

            return $this->successResponse(null, 'Verifikasi email berhasil! Pasword sementara telah aktif.');
        } catch (\Exception $e) {
            return $this->errorResponse('Gagal verifikasi email.', 500);
        }
    }

    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => self::RULE_REQ_EMAIL,
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user) {
            return $this->errorResponse('Email tidak ditemukan.', 404);
        }

        $token = Str::random(64);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $request->email],
            ['token' => Hash::make($token), 'created_at' => now()]
        );

        $frontendUrl = env('FRONTEND_URL', 'http://localhost:3000');
        $resetUrl = $frontendUrl.'/reset-password?token='.$token.'&email='.urlencode($request->email);

        try {
            Mail::send('emails.reset-password', ['resetUrl' => $resetUrl], function ($message) use ($request) {
                $message->to($request->email);
                $message->subject('Reset Password HRMS Narwastu Arthatama');
            });

            return $this->successResponse(null, 'Tautan reset password telah dikirim ke email Anda.');
        } catch (\Exception $e) {
            return $this->errorResponse('Gagal mengirim email reset password: '.$e->getMessage(), 500);
        }
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'token' => 'required',
            'password' => 'required|min:8|confirmed',
        ]);

        $record = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (! $record || ! Hash::check($request->token, $record->token)) {
            return $this->errorResponse('Token tidak valid atau sudah kadaluarsa.', 400);
        }

        // Token is typically valid for 60 minutes
        if (now()->diffInMinutes($record->created_at) > 60) {
            return $this->errorResponse('Token sudah kadaluarsa.', 400);
        }

        $user = User::where('email', $request->email)->first();

        $user->update([
            'password' => Hash::make($request->password),
        ]);

        // Revoke all refresh tokens on password reset
        if ($user) {
            RefreshToken::revokeAllForUser($user->id);
            $user->tokens()->delete(); // Revoke all access tokens too
        }

        DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->delete();

        return $this->successResponse(null, 'Password berhasil direset. Silakan login dengan password baru Anda.');
    }

    public function loginWithGoogle(Request $request)
    {
        $request->validate([
            'id_token' => self::RULE_REQ_STRING,
            'company_name' => self::RULE_REQ_STRING,
        ]);

        try {
            // 1. Verifikasi Google ID Token
            // Gunakan Client ID dari Google Cloud Console / Firebase Web Config
            $client = new \Google_Client(['client_id' => env('GOOGLE_CLIENT_ID')]);
            $payload = $client->verifyIdToken($request->id_token);

            if (! $payload) {
                return $this->errorResponse('Token Google tidak valid atau sudah kadaluarsa.', 401);
            }

            $email = $payload['email'];

            // 2. Cari Perusahaan
            $company = Company::where('name', $request->company_name)
                ->orWhere('name', 'like', '%'.$request->company_name.'%')
                ->first();

            if (! $company) {
                return $this->errorResponse('Perusahaan tidak ditemukan.', 401);
            }

            // 3. Cari User berdasarkan email di perusahaan tersebut
            $user = User::where('email', $email)
                ->where('company_id', $company->id)
                ->first();

            if (! $user) {
                return $this->errorResponse("Email $email tidak terdaftar di $company->name. Silakan hubungi Admin.", 401);
            }

            // 4. Device Binding & FCM Token
            // Google Login lebih fleksibel: auto-update device_id karena autentikasi
            // Google sudah aman (MFA, verifikasi 2 langkah, dll)
            $updateData = [];
            if ($request->device_id) {
                $updateData['device_id'] = $request->device_id;
            }

            if ($request->fcm_token) {
                $updateData['fcm_token'] = $request->fcm_token;
            }

            if (! empty($updateData)) {
                $user->update($updateData);
            }

            // 5. Generate Tokens
            $accessToken = $user->createToken('auth_token', ['*'], now()->addMinutes(self::ACCESS_TOKEN_MINUTES))->plainTextToken;

            if ($request->device_id) {
                RefreshToken::revokeForDevice($user->id, $request->device_id);
            }

            $refreshTokenData = RefreshToken::generateFor(
                $user,
                $request->device_id,
                $request->ip(),
                $request->userAgent(),
                self::REFRESH_TOKEN_DAYS
            );

            ActivityLog::create([
                'company_id' => $user->company_id,
                'user_id' => $user->id,
                'action' => 'LOGIN_GOOGLE',
                'description' => "User {$user->name} berhasil masuk via Google Login.",
            ]);

            return $this->successResponse([
                'access_token' => $accessToken,
                'refresh_token' => $refreshTokenData['plain_token'],
                'token_type' => 'Bearer',
                'expires_in' => self::ACCESS_TOKEN_MINUTES * 60,
                'refresh_expires_in' => self::REFRESH_TOKEN_DAYS * 86400,
                'user' => $user->load(['role.permissions', 'office']),
            ], 'Login berhasil');

        } catch (\Exception $e) {
            return $this->errorResponse('Terjadi kesalahan pada server saat verifikasi Google: '.$e->getMessage(), 500);
        }
    }

    public function sendOtp(Request $request)
    {
        $request->validate([
            'phone' => self::RULE_REQ_STRING,
        ]);

        $user = User::where('phone', $request->phone)->first();

        if (! $user) {
            return $this->errorResponse('Nomor WhatsApp tidak terdaftar.', 404);
        }

        $otp = random_int(100000, 999999);

        // Store OTP in cache for 5 minutes
        Cache::put('otp_'.$user->id, $otp, now()->addMinutes(5));

        $waService = new WhatsAppService;
        $message = "*[OTP] HRMS Narwastu Arthatama*\n\nKode verifikasi Anda adalah: *{$otp}*\n\nJangan berikan kode ini kepada siapapun. Kode berlaku selama 5 menit.";

        if ($waService->sendMessage($user->phone, $message)) {
            return $this->successResponse(null, 'Kode OTP telah dikirim ke WhatsApp Anda.');
        } else {
            return $this->errorResponse('Gagal mengirim OTP ke WhatsApp. Silakan coba lagi.', 500);
        }
    }

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'otp' => 'required|string|size:6',
        ]);

        $user = User::where('phone', $request->phone)->first();

        if (! $user) {
            return $this->errorResponse('User tidak ditemukan.', 404);
        }

        $cachedOtp = Cache::get('otp_'.$user->id);

        if (! $cachedOtp || $cachedOtp != $request->otp) {
            return $this->errorResponse('Kode OTP salah atau sudah kadaluarsa.', 400);
        }

        // OTP Valid, Clear it
        Cache::forget('otp_'.$user->id);

        // Auto-verify email if not verified
        if (! $user->email_verified_at) {
            $user->email_verified_at = now();
            $user->save();
        }

        // Generate Login Token
        $accessToken = $user->createToken('auth_token', ['*'], now()->addMinutes(60))->plainTextToken;

        $refreshTokenData = RefreshToken::generateFor(
            $user,
            $request->device_id,
            $request->ip(),
            $request->userAgent(),
            30
        );

        return $this->successResponse([
            'access_token' => $accessToken,
            'refresh_token' => $refreshTokenData['plain_token'],
            'user' => $user->load(['role.permissions', 'office']),
        ], 'Verifikasi OTP berhasil. Anda telah masuk.');
    }
}
