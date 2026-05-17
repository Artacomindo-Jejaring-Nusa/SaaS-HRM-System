<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\PayrollBatch;
use App\Models\PayrollSetting;
use App\Models\Salary;
use App\Models\User;
use Illuminate\Database\Seeder;

class PayrollSeeder extends Seeder
{
    public function run()
    {
        $company = Company::first();

        if (! $company) {
            $this->command->info('Tidak ada perusahaan ditemukan. Seeder payroll dibatalkan.');

            return;
        }

        // Pastikan ada Payroll Setting
        $settings = PayrollSetting::firstOrCreate(
            ['company_id' => $company->id],
            [
                'cutoff_day' => 25,
                'bpjs_kesehatan_emp_pct' => 1,
                'bpjs_kesehatan_coy_pct' => 4,
                'bpjs_jht_emp_pct' => 2,
                'bpjs_jht_coy_pct' => 3.7,
                'bpjs_jp_emp_pct' => 1,
                'bpjs_jp_coy_pct' => 2,
            ]
        );

        $users = User::where('company_id', $company->id)->with('role')->limit(10)->get();

        if ($users->count() === 0) {
            $this->command->info('Tidak ada karyawan untuk di-generate. Seeder payroll dibatalkan.');

            return;
        }

        $superAdmin = User::where('company_id', $company->id)->with('role')->whereHas('role', function ($q) {
            $q->where('name', 'Super Admin');
        })->first() ?? $users->first();

        // Bersihkan data dummy lama
        $existingBatches = PayrollBatch::where('company_id', $company->id)
            ->whereIn('period_year', [2025, 2026])
            ->get();

        foreach ($existingBatches as $b) {
            Salary::where('batch_id', $b->id)->delete();
            $b->delete();
        }

        // 1. Buat Batch Dummy Bulan Lalu (Approved & Paid)
        $batchLalu = PayrollBatch::create([
            'company_id' => $company->id,
            'period_month' => 'February',
            'period_year' => 2026,
            'status' => 'paid',
            'created_by' => $superAdmin->id,
            'approved_by' => $superAdmin->id,
            'submitted_at' => now()->subDays(30),
            'approved_at' => now()->subDays(28),
        ]);

        // 2. Buat Batch Dummy Bulan Ini (Pending Approval)
        $batchSekarang = PayrollBatch::create([
            'company_id' => $company->id,
            'period_month' => 'March',
            'period_year' => 2026,
            'status' => 'pending_approval',
            'created_by' => $superAdmin->id,
            'submitted_at' => now()->subDays(1),
        ]);

        foreach ([$batchLalu, $batchSekarang] as $batch) {
            foreach ($users as $index => $user) {
                // Update basic salary karyawan jika 0 (untuk testing)
                if (! $user->basic_salary || $user->basic_salary == 0) {
                    $user->basic_salary = rand(4000000, 15000000);
                    $user->bank_name = 'BCA';
                    $user->bank_account_no = '12345678'.rand(10, 99);
                    $user->save();
                }

                $basicSalary = $user->basic_salary;

                // Hitung dummy komponen pendapatan (Simulasi HR memasukkan data)
                $tunjanganJabatan = ($index % 3 === 0) ? 1000000 : 0; // Sebagian dapat tunjangan jabatan
                $tunjanganKehadiran = 200000;
                $tunjanganPulsa = ($index % 2 === 0) ? 100000 : 0;
                $lembur = rand(0, 5) * 30000;
                $rapel = 0;

                // Tambahan khusus untuk batch sekarang agar bervariasi
                if ($batch->id === $batchSekarang->id && $index === 0) {
                    $rapel = 500000; // Ada rapelan
                }

                // BPJS Mock (Berdasarkan rate)
                $bpjsKes = $basicSalary * 0.04; // Simulasi premi perusahaan
                $bpjsJht = $basicSalary * 0.02; // Potongan JHT pegawai
                $bpjsJp = $basicSalary * 0.01;  // Potongan JP pegawai

                // Pajak (Simulasi)
                $pajak = $basicSalary * 0.0125;

                // Potongan absen
                $potAbsen = rand(0, 1) === 1 ? 50000 : 0; // Kadang ada potongan telat

                $salary = new Salary([
                    'user_id' => $user->id,
                    'company_id' => $company->id,
                    'batch_id' => $batch->id,
                    'month' => $batch->period_month,
                    'year' => $batch->period_year,
                    'basic_salary' => $basicSalary,
                    'department' => $user->role->name ?? 'Staff',
                    'working_days' => 20,
                    'total_working_days' => 20,

                    // Earnings
                    'earning_bpjs_kes_premium' => $bpjsKes,
                    'earning_position_allowance' => $tunjanganJabatan,
                    'earning_attendance_allowance' => $tunjanganKehadiran,
                    'earning_communication_allowance' => $tunjanganPulsa,
                    'earning_shift_premium' => 0,
                    'earning_shift_meal' => 0,
                    'earning_overtime' => $lembur,
                    'earning_operational' => 0,
                    'earning_diligence_bonus' => 0,
                    'earning_backpay' => $rapel,
                    'earning_others' => 0,

                    // Deductions
                    'deduction_bpjs_jht' => $bpjsJht,
                    'deduction_bpjs_jp' => $bpjsJp,
                    'deduction_absence' => $potAbsen,
                    'deduction_tax' => $pajak,

                    // Info Pembayaran
                    'bank_name' => $user->bank_name ?? 'BCA',
                    'bank_account_no' => $user->bank_account_no ?? '1234567',
                    'cost_center' => 'Artacomindo',
                    'status' => $batch->status,
                ]);

                $salary->calculateTotals();

                // Tambahkan JSON fallback legacy
                $salary->details = json_encode([
                    'ptkp' => $user->ptkp_status,
                    'tax' => $salary->deduction_tax,
                    'breakdown' => [
                        'gross' => $salary->total_earnings,
                        'net' => $salary->net_salary,
                    ],
                ]);

                $salary->save();
            }

            // Update batch total
            $batch->recalculateTotals();
        }

        $this->command->info('Payroll Dummy Data berhasil di-generate! (1 Paid, 1 Pending Approval)');
    }
}
