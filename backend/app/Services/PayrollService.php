<?php

namespace App\Services;

use App\Models\PayrollSetting;

class PayrollService
{
    /**
     * Calculate PPh 21 based on TER (Tarif Efektif Rata-rata) PP 58/2023
     */
    public function calculatePPh21TER($grossSalary, $ptkpStatus)
    {
        $category = $this->getTERCategory($ptkpStatus);
        $rate = $this->getTERRate($grossSalary, $category);

        return round($grossSalary * ($rate / 100));
    }

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

    /**
     * Calculate BPJS Breakdown
     */
    public function calculateBPJS($baseSalary, PayrollSetting $settings)
    {
        // BPJS Kesehatan (Max base 12jt, min UMK - simplified here to base salary)
        $maxBaseKesehatan = 12000000;
        $baseKesehatan = min($baseSalary, $maxBaseKesehatan);

        $healthEmp = round($baseKesehatan * ($settings->bpjs_kesehatan_emp_pct / 100));
        $healthCoy = round($baseKesehatan * ($settings->bpjs_kesehatan_coy_pct / 100));

        // BPJS Ketenagakerjaan
        $jhtEmp = round($baseSalary * ($settings->bpjs_jht_emp_pct / 100));
        $jhtCoy = round($baseSalary * ($settings->bpjs_jht_coy_pct / 100));

        $jpEmp = round($baseSalary * ($settings->bpjs_jp_emp_pct / 100));
        $jpCoy = round($baseSalary * ($settings->bpjs_jp_coy_pct / 100));

        $jkmCoy = round($baseSalary * ($settings->bpjs_jkm_pct / 100));
        $jkkCoy = round($baseSalary * ($settings->bpjs_jkk_pct / 100));

        return [
            'kesehatan' => ['employee' => $healthEmp, 'company' => $healthCoy],
            'jht' => ['employee' => $jhtEmp, 'company' => $jhtCoy],
            'jp' => ['employee' => $jpEmp, 'company' => $jpCoy],
            'jkm' => ['company' => $jkmCoy],
            'jkk' => ['company' => $jkkCoy],
            'total_deduction_emp' => $healthEmp + $jhtEmp + $jpEmp,
            'total_benefit_coy' => $healthCoy + $jhtCoy + $jpCoy + $jkmCoy + $jkkCoy,
        ];
    }
}
