<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class VehicleLog extends Model
{
    use BelongsToCompany;

    private const CAST_DECIMAL_2 = 'decimal:2';

    protected $fillable = [
        'company_id', 'user_id',
        'vehicle_name', 'plate_number',
        'purpose', 'destination',
        'departure_date', 'return_date',
        'odometer_start', 'odometer_end', 'distance',
        'odometer_start_photo', 'odometer_end_photo',
        'fuel_cost', 'toll_cost', 'parking_cost', 'other_cost', 'total_cost',
        'expense_attachments',
        'notes', 'status', 'approved_by', 'remark',
    ];

    protected $casts = [
        'departure_date' => 'date',
        'return_date' => 'date',
        'fuel_cost' => self::CAST_DECIMAL_2,
        'toll_cost' => self::CAST_DECIMAL_2,
        'parking_cost' => self::CAST_DECIMAL_2,
        'other_cost' => self::CAST_DECIMAL_2,
        'total_cost' => self::CAST_DECIMAL_2,
        'expense_attachments' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Automatically compute distance when odometer_end is set
     */
    public static function boot()
    {
        parent::boot();

        static::saving(function ($model) {
            // Auto-calculate distance
            if ($model->odometer_end && $model->odometer_start) {
                $model->distance = $model->odometer_end - $model->odometer_start;
            }

            // Auto-calculate total cost
            $model->total_cost = ($model->fuel_cost ?? 0)
                + ($model->toll_cost ?? 0)
                + ($model->parking_cost ?? 0)
                + ($model->other_cost ?? 0);
        });
    }
}
