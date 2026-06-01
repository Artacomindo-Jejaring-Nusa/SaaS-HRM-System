<?php

namespace App\Traits;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Contracts\Encryption\DecryptException;

/**
 * EncryptsSensitiveFields Trait
 *
 * Automatically encrypts/decrypts specified model fields using Laravel's
 * built-in AES-256-CBC encryption (based on APP_KEY).
 *
 * Usage: Define $encryptedFields array on your model, then use this trait.
 *
 * Example:
 *   protected array $encryptedFields = ['ktp_no', 'bank_account_no'];
 *
 * @mixin \Illuminate\Database\Eloquent\Model
 */
trait EncryptsSensitiveFields
{
    /**
     * Boot the trait — register model event hooks for auto-encryption.
     */
    public static function bootEncryptsSensitiveFields(): void
    {
        // Encrypt before saving to database
        if (method_exists(static::class, 'saving')) {
            call_user_func([static::class, 'saving'], function ($model) {
                /** @var \Illuminate\Database\Eloquent\Model|\App\Traits\EncryptsSensitiveFields $model */
                foreach ($model->getEncryptedFields() as $field) {
                    if (isset($model->attributes[$field]) && $model->attributes[$field] !== null) {
                        $value = $model->attributes[$field];
                        // Don't double-encrypt: if the value is already encrypted, skip
                        if (!self::isEncrypted($value)) {
                            $model->attributes[$field] = Crypt::encryptString($value);
                        }
                    }
                }
            });
        }

        // Decrypt after retrieving from database
        if (method_exists(static::class, 'retrieved')) {
            call_user_func([static::class, 'retrieved'], function ($model) {
                /** @var \Illuminate\Database\Eloquent\Model|\App\Traits\EncryptsSensitiveFields $model */
                foreach ($model->getEncryptedFields() as $field) {
                    if (isset($model->attributes[$field]) && $model->attributes[$field] !== null) {
                        try {
                            $model->attributes[$field] = Crypt::decryptString($model->attributes[$field]);
                        } catch (DecryptException $e) {
                            // Value is not encrypted (legacy data) — leave as-is
                        }
                    }
                }
            });
        }
    }

    /**
     * Get the list of fields that should be encrypted.
     */
    public function getEncryptedFields(): array
    {
        return property_exists($this, 'encryptedFields') ? $this->encryptedFields : [];
    }

    /**
     * Check if a value appears to be already encrypted by Laravel.
     * Laravel encrypted strings are base64-encoded JSON with iv+value+mac.
     */
    protected static function isEncrypted(mixed $value): bool
    {
        if (!is_string($value) || strlen($value) < 50) {
            return false;
        }

        $decoded = base64_decode($value, true);
        if ($decoded === false) {
            return false;
        }

        $json = json_decode($decoded, true);
        return is_array($json) && isset($json['iv'], $json['value'], $json['mac']);
    }
}
