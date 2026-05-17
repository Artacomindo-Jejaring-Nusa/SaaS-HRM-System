<?php

namespace App\Exports;

use Illuminate\Contracts\View\View;
use Maatwebsite\Excel\Concerns\FromView;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class OvertimeExport implements FromView, WithColumnWidths, WithEvents, WithStyles
{
    protected $overtimes;

    protected $meta;

    public function __construct($overtimes, $meta = [])
    {
        $this->overtimes = $overtimes;
        $this->meta = $meta;
    }

    public function view(): View
    {
        // Indonesian month map
        $months = [
            'January' => 'Januari', 'February' => 'Februari', 'March' => 'Maret',
            'April' => 'April', 'May' => 'Mei', 'June' => 'Juni',
            'July' => 'Juli', 'August' => 'Agustus', 'September' => 'September',
            'October' => 'Oktober', 'November' => 'November', 'December' => 'Desember',
        ];

        $first = $this->overtimes->first();
        $baseDate = $first ? $first->date : now();
        $monthName = $months[date('F', strtotime($baseDate))];
        $date_info = $this->meta['date_range'] ?? $monthName.' '.date('Y', strtotime($baseDate));

        $todayMonth = $months[date('F', strtotime($this->meta['today'] ?? now()))];
        $today_date = date('d', strtotime($this->meta['today'] ?? now())).' '.$todayMonth.' '.date('Y', strtotime($this->meta['today'] ?? now()));

        return view('exports.overtime_excel', [
            'overtimes' => $this->overtimes,
            'months' => $months,
            'office_name' => $this->meta['office_name'] ?? 'KP Cakung',
            'date_info' => $date_info,
            'company_name' => $this->meta['company_name'] ?? 'PT. Narwastu Group',
            'today_date' => $today_date,
            'hr_ga_name' => $this->meta['hr_ga'] ?? 'Nazirin Nawawi',
            'requester_name' => $first ? $first->user->name : 'Ahmad Rizki',
        ]);
    }

    public function columnWidths(): array
    {
        return [
            'A' => 2,
            'B' => 5,    // No
            'C' => 22,   // Nama
            'D' => 12,   // Jam Mulai
            'E' => 2,    // Spacer
            'F' => 18,   // Jam Selesai (Wait, G is also there?)
            'G' => 25,   // Signature col
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            // Style cells if needed
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $count = max(5, $this->overtimes->count());
                $table1Start = 13;
                $table1End = $table1Start + $count - 1;
                $table2Label = $table1End + 1;
                $table2Start = $table2Label + 1;
                $table2End = $table2Start + $count - 1;
                $signRowHeader = $table2End + 4;
                $signRowName = $signRowHeader + 6;

                $sheet = $event->sheet->getDelegate();

                // General alignment
                $sheet->getStyle('B2:G'.($signRowName + 2))->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                $sheet->getStyle('C'.$table1Start.':C'.$table1End)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
                $sheet->getStyle('G4:G7')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
                $sheet->getStyle('B2:B2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

                // Specific column alignment
                $sheet->getStyle('B12:B'.$table2End)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('D'.$table1Start.':D'.$table1End)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('F'.$table1Start.':G'.$table1End)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // Merge Jam Selesai Header (Row 12, Column F and G)
                $sheet->mergeCells('F12:G12');

                // Row Heights
                $sheet->getRowDimension(12)->setRowHeight(25);
                foreach (range($table1Start, $table1End) as $row) {
                    $sheet->getRowDimension($row)->setRowHeight(20);
                }
                foreach (range($table2Start, $table2End) as $row) {
                    $sheet->getRowDimension($row)->setRowHeight(20);
                }

                // Table 2 Spans (No in B, Task in C-G)
                foreach (range($table2Start, $table2End) as $row) {
                    $sheet->mergeCells("C$row:G$row");
                }

                // Header style (Grey Background + Bold)
                $headerStyle = [
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['argb' => 'FFEFEFEF'],
                    ],
                    'font' => ['bold' => true, 'size' => 11],
                    'borders' => [
                        'allBorders' => [
                            'borderStyle' => Border::BORDER_THIN,
                        ],
                    ],
                ];
                $sheet->getStyle('B12:G12')->applyFromArray($headerStyle);

                // Signatures Alignment
                $sheet->getStyle('B'.$signRowHeader.':G'.$signRowName)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('G'.$signRowHeader)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
            },
        ];
    }
}
