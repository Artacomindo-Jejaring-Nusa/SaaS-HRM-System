<?php

namespace App\Exports;

use App\Models\Salary;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithDrawings;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class PayrollExport implements FromCollection, WithDrawings, WithHeadings, WithMapping, WithStyles, WithTitle
{
    private const RANGE_HEADERS = 'A2:Z3';

    protected $companyId;

    protected $month;

    protected $year;

    protected $creatorName;

    protected $rowNumber = 0;

    public function __construct($companyId, $month = null, $year = null, $creatorName = 'Admin')
    {
        $this->companyId = $companyId;
        $this->month = $month;
        $this->year = $year;
        $this->creatorName = $creatorName;
    }

    public function title(): string
    {
        return 'Gaji-(All)';
    }

    public function collection()
    {
        $query = Salary::with('user')->where('company_id', $this->companyId);

        if ($this->month && $this->month !== 'all') {
            $query->where('month', $this->month);
        }

        if ($this->year) {
            $query->where('year', $this->year);
        }

        return $query->get();
    }

    public function headings(): array
    {
        return [
            [
                'NO', 'Nama', 'Bagian', 'Gaji', 'Status', 'HH',
                'Premi BPJS-Kes', 'Jumlah (Gaji+Premi)', 'Pot. JHT-TK (2%)', 'Pot. JP-TK (1%)',
                'Tunjangan', '', '',
                'kyw shift 24 jam', '',
                'Others-Tambahan lainnya', '', '', '', '',
                'Jumlah', 'Pot. Absensi', 'THP',
                'Pembayaran ke :', '', 'Cost Center',
            ],
            [
                '', '', '', '', '', '',
                '', '', '', '',
                'Jabatan', 'Kehadiran', 'Pulsa',
                'Premi Shift', 'UM Shift-Malam',
                'OT-Lembur', 'Operasional', 'Kerajinan', 'Rapel', 'Others',
                '', '', '',
                'Bank', 'No. Rek.', '',
            ],
        ];
    }

    public function map($salary): array
    {
        $this->rowNumber++;

        return [
            $this->rowNumber,
            $salary->user->name ?? '-',
            $salary->department ?? '-',
            $salary->basic_salary,
            $salary->user->ptkp_status ?? '-',
            $salary->working_days,
            $salary->earning_bpjs_kes_premium,
            $salary->basic_salary + $salary->earning_bpjs_kes_premium,
            $salary->deduction_bpjs_jht,
            $salary->deduction_bpjs_jp,
            $salary->earning_position_allowance,
            $salary->earning_attendance_allowance,
            $salary->earning_communication_allowance,
            $salary->earning_shift_premium,
            $salary->earning_shift_meal,
            $salary->earning_overtime,
            $salary->earning_operational,
            $salary->earning_diligence_bonus,
            $salary->earning_backpay,
            $salary->earning_others,
            $salary->total_earnings,
            $salary->deduction_absence,
            $salary->net_salary,
            $salary->bank_name ?? '-',
            $salary->bank_account_no ?? '-',
            $salary->cost_center ?? '-',
        ];
    }

    public function styles(Worksheet $sheet)
    {
        // Title row (Inserted before headers)
        $sheet->insertNewRowBefore(1, 1);
        $month = $this->month ?? 'All';
        $year = $this->year ?? date('Y');
        $sheet->setCellValue('A1', "Perhitungan {$month} {$year} - Confidential");
        $sheet->mergeCells('A1:Z1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);

        // Merge Headers (Rows 2 and 3)
        foreach (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'U', 'V', 'W', 'Z'] as $col) {
            $sheet->mergeCells("{$col}2:{$col}3");
        }
        $sheet->mergeCells('K2:M2'); // Tunjangan
        $sheet->mergeCells('N2:O2'); // kyw shift 24 jam
        $sheet->mergeCells('P2:T2'); // Others-Tambahan lainnya
        $sheet->mergeCells('X2:Y2'); // Pembayaran ke

        // Base Style for Headers
        $sheet->getStyle(self::RANGE_HEADERS)->getFont()->setBold(true)->setSize(9);
        $sheet->getStyle(self::RANGE_HEADERS)->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)
            ->setVertical(Alignment::VERTICAL_CENTER)
            ->setWrapText(true);
        $sheet->getStyle(self::RANGE_HEADERS)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        // Add Colors
        $sheet->getStyle('G2:G3')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF4B084');
        $sheet->getStyle('K2:M3')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFFD966');
        $sheet->getStyle('N2:O3')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF9BC2E6');
        $sheet->getStyle('P2:T3')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFA9D08E');

        // Column Auto-Size
        foreach (range('A', 'Z') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Calculate precise row bounds to avoid getHighestRow() picking up drawing coordinates
        $lastRow = $this->rowNumber + 3;

        // Format numeric columns and borders for data
        if ($this->rowNumber > 0) {
            $sheet->getStyle("A4:Z{$lastRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

            $numericCols = ['D', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'];
            $rupiahFormat = '_("Rp"* #,##0_);_("Rp"* \(#,##0\);_("Rp"* "-"_);_(@_)';
            foreach ($numericCols as $col) {
                $sheet->getStyle("{$col}4:{$col}{$lastRow}")->getNumberFormat()->setFormatCode($rupiahFormat);
            }
        } else {
            $numericCols = ['D', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'];
            $rupiahFormat = '_("Rp"* #,##0_);_("Rp"* \(#,##0\);_("Rp"* "-"_);_(@_)';
        }

        // --- Add Total Row ---
        $totalRow = $lastRow + 1;
        $sheet->setCellValue("C{$totalRow}", 'Jumlah');
        $sheet->getStyle("C{$totalRow}")->getFont()->setBold(true);
        $sheet->getStyle("A{$totalRow}:Z{$totalRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        foreach ($numericCols as $col) {
            $sheet->setCellValue("{$col}{$totalRow}", "=SUM({$col}4:{$col}{$lastRow})");
            $sheet->getStyle("{$col}{$totalRow}")->getNumberFormat()->setFormatCode($rupiahFormat);
            $sheet->getStyle("{$col}{$totalRow}")->getFont()->setBold(true);
        }

        // --- Add Signatures ---
        $sigRow = $totalRow + 3;
        $sheet->setCellValue("A{$sigRow}", 'Jakarta, _______________');
        $sheet->setCellValue('A'.($sigRow + 1), 'Dibuat oleh,');

        $sheet->setCellValue('A'.($sigRow + 6), $this->creatorName);
        $sheet->getStyle('A'.($sigRow + 6))->getFont()->setUnderline(true)->setBold(true);

        return [];
    }

    public function drawings()
    {
        $count = $this->collection()->count();
        $lastRow = $count + 3; // rows 1, 2, 3 are headers
        $totalRow = $lastRow + 1;
        $sigRow = $totalRow + 3;

        $drawing = new Drawing;
        $drawing->setName('Signature');
        $drawing->setDescription('Signature');
        $drawing->setPath('c:\laragon\www\SaaS\PAYROLL\Picture1.png');
        $drawing->setHeight(60);
        // Position it just below "Dibuat oleh," which is sigRow + 1
        $drawing->setCoordinates('A'.($sigRow + 2));
        $drawing->setOffsetX(25);
        $drawing->setOffsetY(5);

        return $drawing;
    }
}
