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
    private const RANGE_HEADERS = 'A2:AB3';

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

        if ($this->year && $this->year !== 'all') {
            $query->where('year', $this->year);
        }

        return $query->get();
    }

    public function headings(): array
    {
        return [
            [
                'NO', 'Nama', 'Bagian', 'Gaji', 'Status', 'HH',
                'Premi BPJS-Kes', 'Jumlah (Gaji+Premi)', 'Potongan', '',
                'Tunjangan', '', '',
                'kyw shift 24 jam', '',
                'Others-Tambahan lainnya', '', '', '', '',
                'Jumlah', 'Pot. Absensi', 'THP',
                'Pembayaran ke :', '', 'Cost Center', '', '',
            ],
            [
                '', '', '', '', '', '',
                '', '', 'JHT-TK (2%)', 'JP-TK (1%)',
                'Jabatan', 'Kehadiran', 'Pulsa',
                'Premi Shift', 'UM Shift-Malam',
                'OT-Lembur', 'Operasional', 'Kerajinan', 'Rapel', 'Others',
                '', '', '',
                'Bank', 'No. Rek.', 'Artacomindo', 'Narwasthu', 'AJNusa',
            ],
        ];
    }

    public function map($salary): array
    {
        $this->rowNumber++;
        $row = $this->rowNumber + 3; // Row 1 is title, rows 2-3 are headers. Data starts at row 4.
        $cc = strtolower($salary->cost_center ?? '');
        $artacomindoVal = (str_contains($cc, 'artacomindo')) ? "=W{$row}" : "";
        $narwasthuVal = (str_contains($cc, 'narwastu') || str_contains($cc, 'narwasthu')) ? "=W{$row}" : "";
        $ajnusaVal = (str_contains($cc, 'ajnusa')) ? "=W{$row}" : "";

        return [
            $this->rowNumber,
            $salary->user->name ?? '-',
            $salary->department ?? '-',
            $salary->basic_salary,
            $salary->user->ptkp_status ?? '-',
            $salary->working_days,
            $salary->earning_bpjs_kes_premium,
            "=D{$row}+G{$row}", // Col H: Jumlah (Gaji+Premi)
            "=D{$row}*2%",      // Col I: Pot. JHT-TK (2%)
            "=D{$row}*1%",      // Col J: Pot. JP-TK (1%)
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
            "=SUM(H{$row}:T{$row})-I{$row}-J{$row}", // Col U: Jumlah
            $salary->deduction_absence,
            "=U{$row}-I{$row}-J{$row}-V{$row}", // Col W: THP
            $salary->bank_name ?? '-',
            $salary->bank_account_no ?? '-',
            $artacomindoVal,  // Col Z
            $narwasthuVal,    // Col AA
            $ajnusaVal,       // Col AB
        ];
    }

    public function styles(Worksheet $sheet)
    {
        // Title row (Inserted before headers)
        $sheet->insertNewRowBefore(1, 1);
        $month = $this->month ?? 'All';
        $year = $this->year ?? date('Y');
        $sheet->setCellValue('A1', "Perhitungan {$month} {$year}-Confidential");
        $sheet->mergeCells('A1:AB1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);

        // Merge Headers (Rows 2 and 3)
        // Note: 'I' and 'J' are intentionally excluded here — they now form
        // the "Potongan" group header (merged only across row 2), matching
        // the same pattern used by Tunjangan / kyw shift 24 jam / Others.
        foreach (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'U', 'V', 'W'] as $col) {
            $sheet->mergeCells("{$col}2:{$col}3");
        }
        $sheet->mergeCells('I2:J2');   // Potongan
        $sheet->mergeCells('K2:M2');   // Tunjangan
        $sheet->mergeCells('N2:O2');   // kyw shift 24 jam
        $sheet->mergeCells('P2:T2');   // Others-Tambahan lainnya
        $sheet->mergeCells('X2:Y2');   // Pembayaran ke
        $sheet->mergeCells('Z2:AB2');  // Cost Center (Artacomindo, Narwasthu, AJNusa)

        // Base Style for Headers
        $sheet->getStyle(self::RANGE_HEADERS)->getFont()->setBold(true)->setSize(10);
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
        $allCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB'];
        foreach ($allCols as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Calculate precise row bounds to avoid getHighestRow() picking up drawing coordinates
        $lastRow = $this->rowNumber + 3;

        // Format numeric columns and borders for data
        $numericCols = ['D', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'Z', 'AA', 'AB'];
        $rupiahFormat = '_("Rp"* #,##0_);_("Rp"* \(#,##0\);_("Rp"* "-"_);_(@_)';

        if ($this->rowNumber > 0) {
            $sheet->getStyle("A4:AB{$lastRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

            foreach ($numericCols as $col) {
                $sheet->getStyle("{$col}4:{$col}{$lastRow}")->getNumberFormat()->setFormatCode($rupiahFormat);
            }
        }

        // --- Add Total Row ---
        $totalRow = $lastRow + 1;
        $sheet->setCellValue("C{$totalRow}", 'Jumlah');
        $sheet->getStyle("C{$totalRow}")->getFont()->setBold(true);
        $sheet->getStyle("A{$totalRow}:AB{$totalRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

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
        // Check multiple possible paths for the signature image
        $possiblePaths = [
            storage_path('app/public/signature.png'),
            base_path('PAYROLL/Picture1.png'),
            'c:\laragon\www\SaaS\PAYROLL\Picture1.png',
        ];

        $signaturePath = null;
        foreach ($possiblePaths as $path) {
            if (file_exists($path)) {
                $signaturePath = $path;
                break;
            }
        }

        // If no signature file found, return empty (no drawing)
        if (! $signaturePath) {
            return [];
        }


        $count = $this->collection()->count();
        $lastRow = $count + 3; // rows 1, 2, 3 are headers
        $totalRow = $lastRow + 1;
        $sigRow = $totalRow + 3;

        $drawing = new Drawing;
        $drawing->setName('Signature');
        $drawing->setDescription('Signature');
        $drawing->setPath($signaturePath);
        $drawing->setHeight(60);
        // Position it just below "Dibuat oleh," which is sigRow + 1
        $drawing->setCoordinates('A'.($sigRow + 2));
        $drawing->setOffsetX(25);
        $drawing->setOffsetY(5);

        return $drawing;
    }
}