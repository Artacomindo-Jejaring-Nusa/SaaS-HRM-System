<?php

namespace App\Imports;

use App\Models\User;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class EmployeePayrollImport implements ToCollection, WithHeadingRow
{
    protected $companyId;

    public $updatedCount = 0;

    public $skippedCount = 0;

    public $errors = [];

    public function __construct($companyId)
    {
        $this->companyId = $companyId;
    }

    public function collection(Collection $rows)
    {
        foreach ($rows as $row) {
            $email = $this->getValue($row, 'email');
            $nik = $this->getValue($row, 'nik');

            if (empty($email) && empty($nik)) {
                $this->skippedCount++;

                continue;
            }

            // Find user by email or NIK
            $user = null;
            if (! empty($email)) {
                $user = User::where('company_id', $this->companyId)->where('email', trim($email))->first();
            }

            if (! $user && ! empty($nik)) {
                $user = User::where('company_id', $this->companyId)->where('nik', trim($nik))->first();
            }

            if (! $user) {
                $this->skippedCount++;
                $this->errors[] = 'Employee with email/NIK ['.($email ?: $nik).'] not found.';

                continue;
            }

            $this->updateUserPayroll($user, $row);
        }
    }

    private function updateUserPayroll($user, array $row)
    {
        $updateData = [];
        $fields = [
            'bank' => ['key' => 'bank_name', 'type' => 'string'],
            'nomor_rekening' => ['key' => 'bank_account_no', 'type' => 'string'],
            'nama_rekening' => ['key' => 'bank_account_name', 'type' => 'string'],
            'cost_center' => ['key' => 'cost_center', 'type' => 'string'],
            'gaji_pokok' => ['key' => 'basic_salary', 'type' => 'float'],
            'tunjangan_tetap' => ['key' => 'fixed_allowance', 'type' => 'float'],
        ];

        foreach ($fields as $prefix => $config) {
            $val = $this->getValue($row, $prefix);
            if ($val !== null) {
                $updateData[$config['key']] = $config['type'] === 'float' ? (float)$val : (string)trim($val);
            }
        }

        if (!empty($updateData)) {
            $user->update($updateData);
            $this->updatedCount++;
        }
    }

    private function getValue(array $row, $keyPrefix)
    {
        foreach ($row as $key => $value) {
            // Slugified keys usually convert "Nomor Rekening" to "nomor_rekening"
            if (str_starts_with($key, $keyPrefix)) {
                return $value;
            }
        }

        return null;
    }
}
