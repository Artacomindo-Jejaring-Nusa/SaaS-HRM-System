<?php

namespace App\Exports;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class EmployeePayrollTemplateExport implements FromCollection, WithHeadings, WithMapping, WithStyles, WithTitle
{
    protected $companyId;

    public function __construct($companyId)
    {
        $this->companyId = $companyId;
    }

    public function collection()
    {
        return User::where('company_id', $this->companyId)
            ->orderBy('name', 'asc')
            ->get();
    }

    public function title(): string
    {
        return 'Template Data Payroll';
    }

    public function headings(): array
    {
        return [
            'NIK',
            'Nama Karyawan',
            'Email',
            'Bank',
            'Nomor Rekening',
            'Nama Rekening',
            'Cost Center',
            'Gaji Pokok',
            'Tunjangan Tetap',
            'Status PTKP',
        ];
    }

    public function map($user): array
    {
        return [
            $user->nik ?? '',
            $user->name ?? '',
            $user->email ?? '',
            $user->bank_name ?? '',
            $user->bank_account_no ?? '',
            $user->bank_account_name ?: ($user->name ?? ''),
            $user->cost_center ?? '',
            (float) ($user->basic_salary ?? 0),
            (float) ($user->fixed_allowance ?? 0),
            $user->ptkp_status ?? 'TK/0',
        ];
    }

    public function styles(Worksheet $sheet)
    {
        // Style header row
        $sheet->getStyle('A1:J1')->getFont()->setBold(true);
        $sheet->getStyle('A1:J1')->getFill()
            ->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FFDCE6F1');

        // Column widths
        $sheet->getColumnDimension('A')->setWidth(18); // NIK
        $sheet->getColumnDimension('B')->setWidth(26); // Nama
        $sheet->getColumnDimension('C')->setWidth(26); // Email
        $sheet->getColumnDimension('D')->setWidth(14); // Bank
        $sheet->getColumnDimension('E')->setWidth(20); // No Rekening
        $sheet->getColumnDimension('F')->setWidth(26); // Nama Rekening
        $sheet->getColumnDimension('G')->setWidth(20); // Cost Center
        $sheet->getColumnDimension('H')->setWidth(18); // Gaji Pokok
        $sheet->getColumnDimension('I')->setWidth(18); // Tunjangan Tetap
        $sheet->getColumnDimension('J')->setWidth(15); // PTKP

        // Number format for salary columns
        $lastRow = max($sheet->getHighestRow(), 2);
        $sheet->getStyle("H2:I{$lastRow}")->getNumberFormat()
            ->setFormatCode('#,##0');
    }
}
