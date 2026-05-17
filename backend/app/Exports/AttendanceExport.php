<?php

namespace App\Exports;

use App\Models\Attendance;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class AttendanceExport implements FromQuery, WithHeadings, WithMapping
{
    protected $userId;

    protected $companyId;

    protected $startDate;

    protected $endDate;

    private $rowNumber = 0;

    public function __construct($companyId, $userId = null, $startDate = null, $endDate = null)
    {
        $this->companyId = $companyId;
        $this->userId = $userId;
        $this->startDate = $startDate;
        $this->endDate = $endDate;
    }

    public function query()
    {
        $query = Attendance::with(['user'])->where('company_id', $this->companyId);

        if ($this->userId) {
            $query->where('user_id', $this->userId);
        }

        if ($this->startDate) {
            $query->whereDate('check_in', '>=', $this->startDate);
        }

        if ($this->endDate) {
            $query->whereDate('check_in', '<=', $this->endDate);
        }

        return $query;
    }

    public function headings(): array
    {
        return [
            'No.',
            'Tanggal',
            'Nama Karyawan',
            'Jam Masuk',
            'Jam Keluar',
            'Status',
            'Titik Lokasi Absen (Lat, Lng)',
        ];
    }

    public function map($attendance): array
    {
        $statusIndo = $attendance->status;
        if ($statusIndo === 'present') {
            $statusIndo = 'Tepat Waktu';
        } elseif ($statusIndo === 'late') {
            $statusIndo = 'Terlambat';
        } elseif ($statusIndo === 'no_schedule') {
            $statusIndo = 'Luar Jadwal';
        } elseif ($statusIndo === 'office_hour') {
            $statusIndo = 'Office Hour';
        } else {
            $statusIndo = ucfirst($statusIndo);
        }

        return [
            ++$this->rowNumber,
            $attendance->date,
            $attendance->user->name ?? 'N/A',
            $attendance->check_in_time ?: '-',
            $attendance->check_out_time ?: '-',
            $statusIndo,
            $attendance->check_in_location,
        ];
    }
}
