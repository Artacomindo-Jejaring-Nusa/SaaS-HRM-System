<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Permit extends Model
{
    use BelongsToCompany;
    protected $fillable = [
        'user_id',
        'company_id',
        'start_date',
        'end_date',
        'type',
        'category',        // I=Izin, A=Alpha/Mangkir, S=Sakit, L=Lainnya
        'has_doctor_note',  // Khusus kategori S — ditentukan oleh HRD
        'is_deducted',      // Potong gaji atau tidak
        'reason',
        'status',
        'current_approval_step',
        'approved_by',
        'remark',
        'signature',
        'attachment',
    ];

    protected $casts = [
        'has_doctor_note' => 'boolean',
        'is_deducted' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
