<?php

namespace App\Exports;

use Illuminate\Contracts\View\View;
use Maatwebsite\Excel\Concerns\FromView;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;

class OvertimeSingleExport implements FromView, WithColumnWidths, WithEvents
{
    protected $overtime;

    public function __construct($overtime)
    {
        $this->overtime = $overtime;
    }

    public function view(): View
    {
        return view('exports.overtime_single_excel', [
            'overtime' => $this->overtime,
        ]);
    }

    public function columnWidths(): array
    {
        return [
            'A' => 3,
            'B' => 6,    // No
            'C' => 25,   // Date/Name
            'D' => 15,   // Jam Mulai
            'E' => 15,   // Jam Selesai
            'F' => 30,   // Pekerjaan yang dilakukan
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
