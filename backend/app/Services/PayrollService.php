<?php

namespace App\Services;

use App\Models\PayrollSetting;

class PayrollService
{
    // ──────────────────────────────────────────────────────
    //  PPh 21 DISPATCHER — Selects calculation method
    // ──────────────────────────────────────────────────────

    /**
     * Calculate PPh 21 based on the configured tax method.
     *
     * @param float $grossSalary Total gross salary (gaji pokok + tunjangan + lembur)
     * @param string|null $ptkpStatus PTKP status (TK/0, K/1, etc.)
     * @param string $method Tax method: 'TER', 'GROSS', 'GROSS_UP'
     * @return array ['tax' => amount, 'method' => string, 'details' => [...]]
     */
    public function calculatePPh21($grossSalary, $ptkpStatus, $method = 'TER')
    {
        $method = strtoupper($method ?? 'TER');

        return match ($method) {
            'GROSS' => $this->calculatePPh21Gross($grossSalary, $ptkpStatus),
            'GROSS_UP' => $this->calculatePPh21GrossUp($grossSalary, $ptkpStatus),
            default => $this->calculatePPh21TERMethod($grossSalary, $ptkpStatus),
        };
    }

    // ──────────────────────────────────────────────────────
    //  METHOD 1: TER (Tarif Efektif Rata-rata) PP 58/2023
    // ──────────────────────────────────────────────────────

    /**
     * Calculate PPh 21 based on TER (Tarif Efektif Rata-rata) PP 58/2023
     * Simplified monthly calculation used for payroll withholding.
     */
    public function calculatePPh21TER($grossSalary, $ptkpStatus)
    {
        $result = $this->calculatePPh21TERMethod($grossSalary, $ptkpStatus);
        return $result['tax'];
    }

    private function calculatePPh21TERMethod($grossSalary, $ptkpStatus)
    {
        $category = $this->getTERCategory($ptkpStatus);
        $rate = $this->getTERRate($grossSalary, $category);
        $tax = round($grossSalary * ($rate / 100));

        return [
            'tax' => $tax,
            'method' => 'TER',
            'details' => [
                'ptkp_status' => $ptkpStatus,
                'ter_category' => $category,
                'ter_rate_pct' => $rate,
                'gross_salary' => $grossSalary,
            ],
        ];
    }

    // ──────────────────────────────────────────────────────
    //  METHOD 2: GROSS — Tarif Progresif Pasal 17 UU HPP
    // ──────────────────────────────────────────────────────

    /**
     * Calculate PPh 21 using progressive tax rates (Pasal 17 UU HPP).
     * Annual calculation divided by 12 for monthly withholding.
     *
     * Steps:
     * 1. Gross per bulan → Gross per tahun
     * 2. Kurangi biaya jabatan (5%, max 6jt/thn)
     * 3. Kurangi iuran pensiun (if applicable)
     * 4. Kurangi PTKP
     * 5. Hasilnya = PKP (Penghasilan Kena Pajak)
     * 6. Apply tarif progresif Pasal 17
     * 7. Bagi 12 = PPh 21 per bulan
     */
    private function calculatePPh21Gross($grossSalary, $ptkpStatus)
    {
        $annualGross = $grossSalary * 12;

        // Biaya Jabatan: 5% dari gross, max 6.000.000/tahun
        $biayaJabatan = min($annualGross * 0.05, 6000000);

        // Netto per tahun
        $annualNetto = $annualGross - $biayaJabatan;

        // PTKP
        $ptkp = $this->getPTKPAmount($ptkpStatus);

        // PKP (Penghasilan Kena Pajak) — floor to 0
        $pkp = max(0, $annualNetto - $ptkp);

        // Progressive tax calculation (Pasal 17 UU HPP)
        $annualTax = $this->applyProgressiveTax($pkp);

        // Monthly tax
        $monthlyTax = round($annualTax / 12);

        return [
            'tax' => $monthlyTax,
            'method' => 'GROSS',
            'details' => [
                'ptkp_status' => $ptkpStatus,
                'ptkp_amount' => $ptkp,
                'annual_gross' => $annualGross,
                'biaya_jabatan' => $biayaJabatan,
                'annual_netto' => $annualNetto,
                'pkp' => $pkp,
                'annual_tax' => $annualTax,
                'monthly_tax' => $monthlyTax,
            ],
        ];
    }

    // ──────────────────────────────────────────────────────
    //  METHOD 3: GROSS UP — Pajak ditanggung perusahaan
    // ──────────────────────────────────────────────────────

    /**
     * Calculate PPh 21 with Gross-Up method.
     * Company bears the tax — employee's take-home is exactly the gross salary.
     * Uses iterative approach to find the grossed-up salary.
     */
    private function calculatePPh21GrossUp($grossSalary, $ptkpStatus)
    {
        // First, calculate tax using GROSS method
        $grossResult = $this->calculatePPh21Gross($grossSalary, $ptkpStatus);
        $initialTax = $grossResult['tax'];

        if ($initialTax <= 0) {
            return [
                'tax' => 0,
                'method' => 'GROSS_UP',
                'details' => [
                    'ptkp_status' => $ptkpStatus,
                    'original_gross' => $grossSalary,
                    'grossed_up_salary' => $grossSalary,
                    'tunjangan_pajak' => 0,
                    'note' => 'Penghasilan di bawah PTKP, tidak ada pajak.',
                ],
            ];
        }

        // Iterative gross-up: add tax allowance to salary, recalculate tax
        $tunjanganPajak = $initialTax;
        for ($i = 0; $i < 10; $i++) {
            $grossedUpSalary = $grossSalary + $tunjanganPajak;
            $newResult = $this->calculatePPh21Gross($grossedUpSalary, $ptkpStatus);
            $newTax = $newResult['tax'];

            if (abs($newTax - $tunjanganPajak) < 100) {
                break; // Converged
            }
            $tunjanganPajak = $newTax;
        }

        return [
            'tax' => $tunjanganPajak,
            'method' => 'GROSS_UP',
            'details' => [
                'ptkp_status' => $ptkpStatus,
                'original_gross' => $grossSalary,
                'grossed_up_salary' => $grossSalary + $tunjanganPajak,
                'tunjangan_pajak' => $tunjanganPajak,
                'effective_tax_rate' => $grossSalary > 0 ? round(($tunjanganPajak / $grossSalary) * 100, 2) : 0,
            ],
        ];
    }

    // ──────────────────────────────────────────────────────
    //  PTKP (Penghasilan Tidak Kena Pajak) — 2024/2025
    // ──────────────────────────────────────────────────────

    /**
     * Get annual PTKP amount based on marital/dependent status.
     */
    private function getPTKPAmount($status)
    {
        $ptkpTable = [
            'TK/0' => 54000000,
            'TK/1' => 58500000,
            'TK/2' => 63000000,
            'TK/3' => 67500000,
            'K/0'  => 58500000,
            'K/1'  => 63000000,
            'K/2'  => 67500000,
            'K/3'  => 72000000,
        ];

        return $ptkpTable[strtoupper($status ?? 'TK/0')] ?? 54000000;
    }

    // ──────────────────────────────────────────────────────
    //  Progressive Tax Rates — Pasal 17 UU HPP
    // ──────────────────────────────────────────────────────

    /**
     * Apply progressive tax brackets (UU HPP No. 7/2021, effective 2022+).
     *
     * Brackets:
     *   0 - 60jt      → 5%
     *   60jt - 250jt   → 15%
     *   250jt - 500jt  → 25%
     *   500jt - 5M     → 30%
     *   > 5M           → 35%
     */
    private function applyProgressiveTax($pkp)
    {
        if ($pkp <= 0) {
            return 0;
        }

        $brackets = [
            ['limit' => 60000000,   'rate' => 0.05],
            ['limit' => 250000000,  'rate' => 0.15],
            ['limit' => 500000000,  'rate' => 0.25],
            ['limit' => 5000000000, 'rate' => 0.30],
            ['limit' => PHP_FLOAT_MAX, 'rate' => 0.35],
        ];

        $tax = 0;
        $previousLimit = 0;

        foreach ($brackets as $bracket) {
            if ($pkp <= 0) {
                break;
            }

            $taxableInBracket = min($pkp, $bracket['limit'] - $previousLimit);
            $tax += $taxableInBracket * $bracket['rate'];
            $pkp -= $taxableInBracket;
            $previousLimit = $bracket['limit'];
        }

        return round($tax);
    }

    // ──────────────────────────────────────────────────────
    //  TER Rate Tables (PP 58/2023)
    // ──────────────────────────────────────────────────────

    /**
     * Map PTKP status to TER Category (A, B, or C)
     */
    private function getTERCategory($ptkpStatus)
    {
        $catA = ['TK/0', 'TK/1', 'K/0'];
        $catB = ['TK/2', 'TK/3', 'K/1', 'K/2'];
        $catC = ['K/3'];

        if (in_array($ptkpStatus, $catA)) {
            return 'A';
        }
        if (in_array($ptkpStatus, $catB)) {
            return 'B';
        }
        if (in_array($ptkpStatus, $catC)) {
            return 'C';
        }

        return 'A'; // Default
    }

    /**
     * Get TER Rate based on Gross Salary and Category
     */
    private function getTERRate($gross, $category)
    {
        if ($category === 'A') {
            return $this->getTERRateCatA($gross);
        }

        if ($category === 'B') {
            return $this->getTERRateCatB($gross);
        }

        if ($category === 'C') {
            return $this->getTERRateCatC($gross);
        }

        return 0;
    }

    private function getTERRateCatA($gross)
    {
        $thresholds = [
            5400000 => 0,
            5650000 => 0.25,
            5950000 => 0.5,
            6300000 => 0.75,
            6750000 => 1,
            7500000 => 1.25,
            8550000 => 1.5,
            9650000 => 1.75,
            10050000 => 2,
            10350000 => 2.25,
            10700000 => 2.5,
            11050000 => 3,
            15000000 => 5,
        ];

        foreach ($thresholds as $limit => $rate) {
            if ($gross <= $limit) {
                return $rate;
            }
        }

        return 34; // Max bracket simplified
    }

    private function getTERRateCatB($gross)
    {
        $thresholds = [
            6200000 => 0,
            6500000 => 0.25,
            6850000 => 0.5,
            7300000 => 0.75,
            7850000 => 1,
            8850000 => 1.25,
            9800000 => 1.5,
            10950000 => 1.75,
            11200000 => 2,
        ];

        foreach ($thresholds as $limit => $rate) {
            if ($gross <= $limit) {
                return $rate;
            }
        }

        return 34;
    }

    private function getTERRateCatC($gross)
    {
        $thresholds = [
            6600000 => 0,
            6950000 => 0.25,
            7350000 => 0.5,
            7800000 => 0.75,
            8350000 => 1,
            9450000 => 1.25,
            10450000 => 1.5,
        ];

        foreach ($thresholds as $limit => $rate) {
            if ($gross <= $limit) {
                return $rate;
            }
        }

        return 34;
    }

    // ──────────────────────────────────────────────────────
    //  BPJS Calculation
    // ──────────────────────────────────────────────────────

    /**
     * Calculate BPJS Breakdown with proper ceilings.
     *
     * Ceilings (per regulasi terbaru):
     * - BPJS Kesehatan: max base Rp 12.000.000
     * - BPJS JP (Jaminan Pensiun): max base Rp 10.042.300 (2024)
     */
    public function calculateBPJS($baseSalary, PayrollSetting $settings)
    {
        // ── BPJS Kesehatan ──
        $maxBaseKesehatan = 12000000;
        $baseKesehatan = min($baseSalary, $maxBaseKesehatan);

        $healthEmp = round($baseKesehatan * ($settings->bpjs_kesehatan_emp_pct / 100));
        $healthCoy = round($baseKesehatan * ($settings->bpjs_kesehatan_coy_pct / 100));

        // ── BPJS Ketenagakerjaan: JHT ──
        $jhtEmp = round($baseSalary * ($settings->bpjs_jht_emp_pct / 100));
        $jhtCoy = round($baseSalary * ($settings->bpjs_jht_coy_pct / 100));

        // ── BPJS Ketenagakerjaan: JP (with ceiling) ──
        $maxBaseJP = 10042300; // Ceiling JP 2024
        $baseJP = min($baseSalary, $maxBaseJP);

        $jpEmp = round($baseJP * ($settings->bpjs_jp_emp_pct / 100));
        $jpCoy = round($baseJP * ($settings->bpjs_jp_coy_pct / 100));

        // ── BPJS Ketenagakerjaan: JKM & JKK (company only) ──
        $jkmCoy = round($baseSalary * ($settings->bpjs_jkm_pct / 100));
        $jkkCoy = round($baseSalary * ($settings->bpjs_jkk_pct / 100));

        // ── Totals ──
        $totalDeductionEmp = $healthEmp + $jhtEmp + $jpEmp;
        $totalBenefitCoy = $healthCoy + $jhtCoy + $jpCoy + $jkmCoy + $jkkCoy;

        return [
            'kesehatan' => [
                'employee' => $healthEmp,
                'company' => $healthCoy,
                'base' => $baseKesehatan,
                'ceiling' => $maxBaseKesehatan,
            ],
            'jht' => [
                'employee' => $jhtEmp,
                'company' => $jhtCoy,
            ],
            'jp' => [
                'employee' => $jpEmp,
                'company' => $jpCoy,
                'base' => $baseJP,
                'ceiling' => $maxBaseJP,
            ],
            'jkm' => ['company' => $jkmCoy],
            'jkk' => ['company' => $jkkCoy],
            'total_deduction_emp' => $totalDeductionEmp,
            'total_benefit_coy' => $totalBenefitCoy,
        ];
    }

    /**
     * Generate detailed BPJS breakdown for payslip display.
     */
    public function generateBPJSSlipDetail($baseSalary, PayrollSetting $settings)
    {
        $bpjs = $this->calculateBPJS($baseSalary, $settings);

        return [
            'bpjs_kesehatan' => [
                'label' => 'BPJS Kesehatan',
                'base_salary' => $bpjs['kesehatan']['base'],
                'employee' => [
                    'pct' => $settings->bpjs_kesehatan_emp_pct,
                    'amount' => $bpjs['kesehatan']['employee'],
                ],
                'company' => [
                    'pct' => $settings->bpjs_kesehatan_coy_pct,
                    'amount' => $bpjs['kesehatan']['company'],
                ],
            ],
            'bpjs_jht' => [
                'label' => 'BPJS JHT (Jaminan Hari Tua)',
                'base_salary' => $baseSalary,
                'employee' => [
                    'pct' => $settings->bpjs_jht_emp_pct,
                    'amount' => $bpjs['jht']['employee'],
                ],
                'company' => [
                    'pct' => $settings->bpjs_jht_coy_pct,
                    'amount' => $bpjs['jht']['company'],
                ],
            ],
            'bpjs_jp' => [
                'label' => 'BPJS JP (Jaminan Pensiun)',
                'base_salary' => $bpjs['jp']['base'],
                'ceiling_applied' => $baseSalary > $bpjs['jp']['ceiling'],
                'employee' => [
                    'pct' => $settings->bpjs_jp_emp_pct,
                    'amount' => $bpjs['jp']['employee'],
                ],
                'company' => [
                    'pct' => $settings->bpjs_jp_coy_pct,
                    'amount' => $bpjs['jp']['company'],
                ],
            ],
            'bpjs_jkm' => [
                'label' => 'BPJS JKM (Jaminan Kematian)',
                'company' => [
                    'pct' => $settings->bpjs_jkm_pct,
                    'amount' => $bpjs['jkm']['company'],
                ],
            ],
            'bpjs_jkk' => [
                'label' => 'BPJS JKK (Jaminan Kecelakaan Kerja)',
                'company' => [
                    'pct' => $settings->bpjs_jkk_pct,
                    'amount' => $bpjs['jkk']['company'],
                ],
            ],
            'summary' => [
                'total_employee_deduction' => $bpjs['total_deduction_emp'],
                'total_company_contribution' => $bpjs['total_benefit_coy'],
            ],
        ];
    }
}
