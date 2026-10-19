<?php

namespace App\Traits;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

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
 * @mixin Model
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
                /** @var Model|EncryptsSensitiveFields $model */
                $model->encryptSensitiveFields();
            });
        }

        // Decrypt after retrieving from database
        if (method_exists(static::class, 'retrieved')) {
            call_user_func([static::class, 'retrieved'], function ($model) {
                /** @var Model|EncryptsSensitiveFields $model */
                $model->decryptSensitiveFields();
            });
        }
    }

    /**
     * Encrypt sensitive fields before saving.
     */
    protected function encryptSensitiveFields(): void
    {
        foreach ($this->getEncryptedFields() as $field) {
            if (isset($this->attributes[$field]) && $this->attributes[$field] !== null) {
                $value = $this->attributes[$field];
                // Don't double-encrypt: if the value is already encrypted, skip
                if (! self::isEncrypted($value)) {
                    $this->attributes[$field] = Crypt::encryptString($value);
                }
            }
        }
    }

    /**
     * Decrypt sensitive fields after retrieval.
     */
    protected function decryptSensitiveFields(): void
    {
        foreach ($this->getEncryptedFields() as $field) {
            if (isset($this->attributes[$field]) && $this->attributes[$field] !== null) {
                try {
                    $this->attributes[$field] = Crypt::decryptString($this->attributes[$field]);
                } catch (DecryptException $e) {
                    // Value is not encrypted (legacy data) — leave as-is
                }
            }
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
        if (! is_string($value) || strlen($value) < 50) {
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
