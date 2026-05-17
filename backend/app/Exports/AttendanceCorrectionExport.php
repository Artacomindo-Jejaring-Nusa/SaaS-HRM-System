<?php

namespace App\Exports;

use App\Models\AttendanceCorrection;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class AttendanceCorrectionExport implements FromQuery, WithHeadings, WithMapping
{
    protected $companyId;

    protected $userId;

    protected $status;

    protected $startDate;

    protected $endDate;

    private $rowNumber = 0;

    public function __construct($companyId, $userId = null, $status = null, $startDate = null, $endDate = null)
    {
        $this->companyId = $companyId;
        $this->userId = $userId;
        $this->status = $status;
        $this->startDate = $startDate;
        $this->endDate = $endDate;
    }

    public function query()
    {
        $query = AttendanceCorrection::with(['user', 'approver', 'attendance'])->where('company_id', $this->companyId);

        if ($this->userId) {
            $query->where('user_id', $this->userId);
        }

        if ($this->status) {
            $query->where('status', $this->status);
        }

        if ($this->startDate) {
            $query->whereDate('created_at', '>=', $this->startDate);
        }

        if ($this->endDate) {
            $query->whereDate('created_at', '<=', $this->endDate);
        }

        return $query->orderBy('id', 'desc');
    }

    public function headings(): array
    {
        return [
            'No.',
            'Tanggal Pengajuan',
            'Sebab',
            'Nama Karyawan',
            'Tipe Koreksi',
            'Waktu Masuk Koreksi',
            'Waktu Keluar Koreksi',
            'Status',
            'Alasan',
            'Disetujui Oleh',
        ];
    }

    public function map($correction): array
    {
        return [
            ++$this->rowNumber,
            $correction->created_at->format('d M Y H:i'),
            $correction->reason,
            $correction->user->name ?? 'N/A',
            ucwords($correction->correction_type),
            $correction->corrected_check_in ? Carbon::parse($correction->corrected_check_in)->format('H:i') : '-',
            $correction->corrected_check_out ? Carbon::parse($correction->corrected_check_out)->format('H:i') : '-',
            ucfirst($correction->status),
            $correction->reason,
            $correction->approver->name ?? 'N/A',
        ];
    }
}
