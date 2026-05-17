<?php

namespace App\Exports;

use App\Models\ShiftSwap;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ShiftSwapExport implements FromQuery, WithHeadings, WithMapping, WithStyles
{
    protected $companyId;

    protected $userId;

    protected $startDate;

    protected $endDate;

    protected $status;

    private $rowNumber = 0;

    public function __construct($companyId, $userId = null, $startDate = null, $endDate = null, $status = null)
    {
        $this->companyId = $companyId;
        $this->userId = $userId;
        $this->startDate = $startDate;
        $this->endDate = $endDate;
        $this->status = $status;
    }

    public function query()
    {
        $query = ShiftSwap::with(['requester', 'receiver', 'approver', 'requesterSchedule.shift', 'receiverSchedule.shift'])
            ->where(function ($q) {
                $q->whereHas('requester', function ($sq) {
                    $sq->where('company_id', $this->companyId);
                })->orWhereHas('receiver', function ($sq) {
                    $sq->where('company_id', $this->companyId);
                });
            });

        if ($this->startDate) {
            $query->whereDate('created_at', '>=', $this->startDate);
        }
        if ($this->endDate) {
            $query->whereDate('created_at', '<=', $this->endDate);
        }
        if ($this->userId) {
            $query->where(function ($q) {
                $q->where('requester_id', $this->userId)
                    ->orWhere('receiver_id', $this->userId);
            });
        }
        if ($this->status) {
            $query->where('status', $this->status);
        }

        return $query->latest();
    }

    public function headings(): array
    {
        return [
            'No.',
            'Tanggal Pengajuan',
            'Pengaju (Requester)',
            'Rekan Kerja (Receiver)',
            'Jadwal Pengaju (Asal)',
            'Shift Pengaju',
            'Jadwal Rekan (Tujuan)',
            'Shift Rekan',
            'Alasan',
            'Status Akhir',
            'Disetujui Oleh',
        ];
    }

    public function map($swap): array
    {
        $statusLabels = [
            'approved' => 'Selesai (Approved)',
            'rejected' => 'Ditolak',
            'pending_receiver' => 'Menunggu Rekan',
            'pending_manager' => 'Menunggu Atasan',
        ];

        return [
            ++$this->rowNumber,
            $swap->created_at->format('d/m/Y H:i'),
            $swap->requester->name ?? '-',
            $swap->receiver->name ?? '-',
            $swap->requesterSchedule ? $swap->requesterSchedule->date : '-',
            $swap->requesterSchedule && $swap->requesterSchedule->shift ? $swap->requesterSchedule->shift->name : '-',
            $swap->receiverSchedule ? $swap->receiverSchedule->date : '-',
            $swap->receiverSchedule && $swap->receiverSchedule->shift ? $swap->receiverSchedule->shift->name : '-',
            $swap->reason ?: '-',
            $statusLabels[$swap->status] ?? $swap->status,
            $swap->approver->name ?? '-',
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']], 'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '8B0000']]],
        ];
    }
}
