<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * Auditable Trait — Auto-logs create, update, delete events on Eloquent models.
 *
 * Usage: Add `use Auditable;` to any model that needs audit logging.
 * Sensitive fields can be masked by defining $auditMasked on the model.
 * Fields to exclude from auditing can be defined via $auditExclude.
 *
 * @mixin \Illuminate\Database\Eloquent\Model
 */
trait Auditable
{
    /**
     * Boot the auditable trait for a model.
     */
    public static function bootAuditable(): void
    {
        if (method_exists(static::class, 'created')) {
            call_user_func([static::class, 'created'], function ($model) {
                /** @var \Illuminate\Database\Eloquent\Model|\App\Traits\Auditable $model */
                $model->logAuditEvent('created', [], $model->getAuditableAttributes());
            });
        }

        if (method_exists(static::class, 'updated')) {
            call_user_func([static::class, 'updated'], function ($model) {
                /** @var \Illuminate\Database\Eloquent\Model|\App\Traits\Auditable $model */
                $original = $model->getOriginal();
                $changes = $model->getChanges();

                // Remove timestamp fields from audit diff
                unset($changes['updated_at'], $changes['created_at']);

                if (empty($changes)) {
                    return;
                }

                $oldValues = [];
                $newValues = [];
                $excluded = $model->getAuditExcluded();
                $masked = $model->getAuditMasked();

                foreach ($changes as $key => $newValue) {
                    if (in_array($key, $excluded)) {
                        continue;
                    }

                    $oldVal = $original[$key] ?? null;
                    $newVal = $newValue;

                    // Mask sensitive fields (show partial value only)
                    if (in_array($key, $masked)) {
                        $oldVal = $oldVal ? self::maskValue($oldVal) : null;
                        $newVal = $newVal ? self::maskValue($newVal) : null;
                    }

                    $oldValues[$key] = $oldVal;
                    $newValues[$key] = $newVal;
                }

                if (!empty($newValues)) {
                    $model->logAuditEvent('updated', $oldValues, $newValues);
                }
            });
        }

        if (method_exists(static::class, 'deleted')) {
            call_user_func([static::class, 'deleted'], function ($model) {
                /** @var \Illuminate\Database\Eloquent\Model|\App\Traits\Auditable $model */
                $model->logAuditEvent('deleted', $model->getAuditableAttributes(), []);
            });
        }
    }

    /**
     * Log the audit event to activity_logs table.
     */
    protected function logAuditEvent(string $action, array $oldValues, array $newValues): void
    {
        /** @var \App\Models\User|null $user */
        $user = Auth::user();

        // Determine module name from model class
        $module = $this->getAuditModule();

        // Build human-readable description
        $description = $this->buildAuditDescription($action, $user);

        try {
            ActivityLog::create([
                'company_id' => $user?->company_id ?? $this->company_id ?? null,
                'user_id' => $user?->id,
                'action' => $action,
                'description' => $description,
                'model_type' => get_class($this),
                'model_id' => $this->getKey(),
                'ip_address' => Request::ip(),
                'user_agent' => substr(Request::userAgent() ?? '', 0, 255),
                'old_values' => !empty($oldValues) ? $oldValues : null,
                'new_values' => !empty($newValues) ? $newValues : null,
                'module' => $module,
            ]);
        } catch (\Exception $e) {
            // Silently fail — audit logging should never break the main operation
            \Illuminate\Support\Facades\Log::warning('Audit log failed: ' . $e->getMessage());
        }
    }

    /**
     * Get the module name for audit categorization.
     */
    protected function getAuditModule(): string
    {
        // Allow models to define their own module name
        if (property_exists($this, 'auditModule')) {
            return $this->auditModule;
        }

        // Auto-derive from class name: App\Models\PayrollBatch → payroll
        $className = class_basename($this);

        $moduleMap = [
            'User' => 'employee',
            'Salary' => 'payroll',
            'PayrollBatch' => 'payroll',
            'PayrollSetting' => 'payroll',
            'Attendance' => 'attendance',
            'AttendanceCorrection' => 'attendance',
            'Leave' => 'leave',
            'Overtime' => 'overtime',
            'Reimbursement' => 'reimbursement',
            'Permit' => 'permit',
            'ShiftSwap' => 'schedule',
            'Schedule' => 'schedule',
            'Shift' => 'schedule',
            'Company' => 'company',
            'Office' => 'company',
            'ApprovalWorkflow' => 'approval',
            'ProfileRequest' => 'profile',
        ];

        return $moduleMap[$className] ?? strtolower($className);
    }

    /**
     * Build a human-readable description for the audit log.
     */
    protected function buildAuditDescription(string $action, ?\App\Models\User $user): string
    {
        $modelName = class_basename($this);
        $userName = $user?->name ?? 'System';

        $actionLabels = [
            'created' => 'membuat',
            'updated' => 'mengubah',
            'deleted' => 'menghapus',
        ];

        $label = $actionLabels[$action] ?? $action;

        return "{$userName} {$label} data {$modelName} (ID: {$this->getKey()})";
    }

    /**
     * Get attributes that are auditable (excluding sensitive/excluded fields).
     */
    protected function getAuditableAttributes(): array
    {
        $excluded = $this->getAuditExcluded();
        $masked = $this->getAuditMasked();
        $attributes = $this->attributesToArray();

        // Remove excluded fields
        $attributes = array_diff_key($attributes, array_flip($excluded));

        // Mask sensitive fields
        foreach ($masked as $field) {
            if (isset($attributes[$field])) {
                $attributes[$field] = self::maskValue($attributes[$field]);
            }
        }

        return $attributes;
    }

    /**
     * Fields to exclude from audit logging entirely.
     */
    protected function getAuditExcluded(): array
    {
        return property_exists($this, 'auditExclude')
            ? $this->auditExclude
            : ['password', 'remember_token', 'fcm_token', 'face_embedding', 'updated_at', 'created_at'];
    }

    /**
     * Fields to mask in audit logs (show partial values only).
     */
    protected function getAuditMasked(): array
    {
        return property_exists($this, 'auditMasked')
            ? $this->auditMasked
            : [];
    }

    /**
     * Mask a value for audit logging (show only last 4 characters).
     */
    protected static function maskValue(mixed $value): string
    {
        $value = (string) $value;
        $length = strlen($value);

        if ($length <= 4) {
            return str_repeat('*', $length);
        }

        return str_repeat('*', $length - 4) . substr($value, -4);
    }
}
