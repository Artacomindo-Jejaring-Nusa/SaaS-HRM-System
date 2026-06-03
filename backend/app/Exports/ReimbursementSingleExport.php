<?php

namespace App\Exports;

use Illuminate\Contracts\View\View;
use Maatwebsite\Excel\Concerns\FromView;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;

class ReimbursementSingleExport implements FromView, WithColumnWidths, WithEvents
{
    protected $reimbursement;

    public function __construct($reimbursement)
    {
        $this->reimbursement = $reimbursement;
    }

    public function view(): View
    {
        return view('exports.reimbursement_single_excel', [
            'reimbursement' => $this->reimbursement,
        ]);
    }

    public function columnWidths(): array
    {
        return [
            'A' => 3,
            'B' => 6,    // No.
            'C' => 32,   // Spesifikasi Barang / Jasa
            'D' => 10,   // Unit
            'E' => 10,   // Quantity
            'F' => 20,   // Estimasi Harga
            'G' => 25,   // Tanggal/Keterangan
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $sheet->setShowGridlines(true);
            },
        ];
    }
}
