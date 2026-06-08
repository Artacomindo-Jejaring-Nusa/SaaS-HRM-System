<?php

namespace App\Exports;

use Illuminate\Contracts\View\View;
use Maatwebsite\Excel\Concerns\FromView;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;

class LeaveSingleExport implements FromView, WithColumnWidths, WithEvents
{
    protected $leave;

    public function __construct($leave)
    {
        $this->leave = $leave;
    }

    public function view(): View
    {
        return view('exports.leave_single_excel', [
            'leave' => $this->leave,
        ]);
    }

    public function columnWidths(): array
    {
        return [
            'A' => 3,
            'B' => 25,   // Label/Field
            'C' => 3,    // Separator / Colon
            'D' => 45,   // Value
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
