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
            $rowArray = $row instanceof Collection ? $row->toArray() : (array) $row;

            $email = $this->getValue($rowArray, 'email');
            $nik = $this->getValue($rowArray, 'nik');

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

            $this->updateUserPayroll($user, $rowArray);
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
            if ($val !== null && trim((string)$val) !== '') {
                if ($config['type'] === 'float') {
                    // Clean currency format like 'Rp 5.000.000' or '5,000,000' or '5000000'
                    $cleanVal = preg_replace('/[^0-9]/', '', (string)$val);
                    $updateData[$config['key']] = (float) $cleanVal;
                } else {
                    $updateData[$config['key']] = trim((string)$val);
                }
            }
        }

        if (!empty($updateData)) {
            $user->update($updateData);
            $this->updatedCount++;
        }
    }

    private function getValue(array $row, $keyPrefix)
    {
        $keyPrefix = strtolower(trim($keyPrefix));
        foreach ($row as $key => $value) {
            $normalizedKey = strtolower(trim((string)$key));
            if (str_starts_with($normalizedKey, $keyPrefix) || str_contains($normalizedKey, $keyPrefix)) {
                return $value;
            }
        }

        return null;
    }
}
