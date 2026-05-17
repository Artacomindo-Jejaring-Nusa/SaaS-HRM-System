<?php

namespace App\Exports;

use App\Models\PayrollBatch;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class PayrollRekapExport implements FromCollection, WithHeadings, WithMapping, WithStyles, WithTitle
{
    protected $batch;

    protected $rowNumber = 0;

    public function __construct(PayrollBatch $batch)
    {
        $this->batch = $batch;
    }

    public function collection()
    {
        return $this->batch->salaries()->with('user')->get();
    }

    public function title(): string
    {
        return "Rekap Gaji {$this->batch->period_month}.{$this->batch->period_year}";
    }

    public function headings(): array
    {
        return [
            'NO',
            'Nama',
            'Bank',
            'No. Rek.',
            'THP (Take Home Pay)',
        ];
    }

    public function map($salary): array
    {
        $this->rowNumber++;

        return [
            $this->rowNumber,
            $salary->user->name ?? '-',
            $salary->bank_name ?? '-',
            $salary->bank_account_no ?? '-',
            $salary->net_salary,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        // Add title rows above the heading
        $sheet->insertNewRowBefore(1, 2);
        $sheet->setCellValue('A1', "Perhitungan {$this->batch->period_month} {$this->batch->period_year}");
        $sheet->mergeCells('A1:E1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal('center');

        // Style heading row (row 3 after insert)
        $sheet->getStyle('A3:E3')->getFont()->setBold(true);
        $sheet->getStyle('A3:E3')->getFill()
            ->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FFDCE6F1');

        // Column widths
        $sheet->getColumnDimension('A')->setWidth(5);
        $sheet->getColumnDimension('B')->setWidth(30);
        $sheet->getColumnDimension('C')->setWidth(15);
        $sheet->getColumnDimension('D')->setWidth(20);
        $sheet->getColumnDimension('E')->setWidth(20);

        // Format THP column as number
        $lastRow = $sheet->getHighestRow();
        $sheet->getStyle("E4:E{$lastRow}")->getNumberFormat()
            ->setFormatCode('#,##0');

        // Add total row
        $totalRow = $lastRow + 1;
        $sheet->setCellValue("D{$totalRow}", 'Jumlah =');
        $sheet->setCellValue("E{$totalRow}", "=SUM(E4:E{$lastRow})");
        $sheet->getStyle("D{$totalRow}:E{$totalRow}")->getFont()->setBold(true);
        $sheet->getStyle("E{$totalRow}")->getNumberFormat()->setFormatCode('#,##0');

        // Signature section
        $sigRow = $totalRow + 3;
        $creatorName = $this->batch->creator->name ?? '-';
        $approverName = $this->batch->approver->name ?? '............................';

        $sheet->setCellValue("B{$sigRow}", 'Jakarta, '.now()->translatedFormat('d F Y'));
        $sheet->setCellValue("D{$sigRow}", 'Approved by');

        $sigRow2 = $sigRow + 1;
        $sheet->setCellValue("B{$sigRow2}", 'Reporting by');

        $sigRow3 = $sigRow + 5;
        $sheet->setCellValue("B{$sigRow3}", $creatorName);
        $sheet->setCellValue("D{$sigRow3}", $approverName);
        $sheet->getStyle("B{$sigRow3}:D{$sigRow3}")->getFont()->setBold(true);

        $sigRow4 = $sigRow3 + 1;
        $sheet->setCellValue("B{$sigRow4}", 'Admin-VP');
        $sheet->setCellValue("D{$sigRow4}", 'CEO');

        return [];
    }
}
