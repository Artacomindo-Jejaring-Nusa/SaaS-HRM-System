<?php

namespace App\Exports;

use App\Models\Schedule;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ScheduleExport implements FromQuery, WithHeadings, WithMapping
{
    protected $companyId;

    protected $userId;

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
        $query = Schedule::with(['user', 'shift'])->whereHas('user', function ($q) {
            $q->where('company_id', $this->companyId);
        });

        if ($this->userId) {
            $query->where('user_id', $this->userId);
        }

        if ($this->startDate) {
            $query->whereDate('date', '>=', $this->startDate);
        }

        if ($this->endDate) {
            $query->whereDate('date', '<=', $this->endDate);
        }

        return $query->orderBy('date', 'asc');
    }

    public function headings(): array
    {
        return [
            'No.',
            'Tanggal',
            'Nama Karyawan',
            'NIK',
            'Shift',
            'Masuk',
            'Keluar',
        ];
    }

    public function map($schedule): array
    {
        return [
            ++$this->rowNumber,
            $schedule->date,
            $schedule->user->name ?? 'N/A',
            $schedule->user->nik ?? '-',
            $schedule->shift->name ?? '-',
            $schedule->shift->start_time ?? '-',
            $schedule->shift->end_time ?? '-',
        ];
    }
}
