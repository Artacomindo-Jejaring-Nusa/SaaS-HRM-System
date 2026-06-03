<?php

namespace App\Exports;

use Illuminate\Contracts\View\View;
use Maatwebsite\Excel\Concerns\FromView;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;

class PermitSingleExport implements FromView, WithColumnWidths, WithEvents
{
    protected $permit;

    public function __construct($permit)
    {
        $this->permit = $permit;
    }

    public function view(): View
    {
        return view('exports.permit_single_excel', [
            'permit' => $this->permit,
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
