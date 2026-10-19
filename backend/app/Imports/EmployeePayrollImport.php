<?php

namespace App\Imports;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class EmployeePayrollImport implements ToCollection, WithHeadingRow
{
    protected $companyId;

    public $updatedCount = 0;

    public $createdCount = 0;

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
            $user = $this->findUserByRow($rowArray);

            if ($user) {
                $this->updateUserPayroll($user, $rowArray);
            }
        }
    }

    private function findUserByRow(array $rowArray): ?User
    {
        $email = trim((string) ($this->getValue($rowArray, 'email') ?? ''));
        $nik = trim((string) ($this->getValue($rowArray, 'nik') ?? ''));

        if ($email === '' && $nik === '') {
            $this->skippedCount++;

            return null;
        }

        $user = null;
        if ($email !== '') {
            $user = User::where('company_id', $this->companyId)->where('email', $email)->first();
        }

        if (! $user && $nik !== '') {
            $user = User::where('company_id', $this->companyId)->where('nik', $nik)->first();
        }

        if (! $user) {
            $name = trim((string) ($this->getValue($rowArray, 'nama') ?? ''));
            if ($name !== '' && $email !== '') {
                $user = $this->createEmployeeFromRow($name, $email, $nik);
            } else {
                $this->skippedCount++;
                $identifier = $email !== '' ? $email : $nik;
                $this->errors[] = "Employee with email/NIK [{$identifier}] not found.";
            }
        }

        return $user;
    }

    private function createEmployeeFromRow(string $name, string $email, string $nik): User
    {
        $this->createdCount++;

        return User::create([
            'name' => $name,
            'email' => $email,
            'nik' => $nik !== '' ? $nik : null,
            'password' => Hash::make('password123'),
            'company_id' => $this->companyId,
            'role_id' => 3,
            'attendance_type' => 'office_hour',
            'employment_status' => 'Permanent',
            'join_date' => now()->toDateString(),
            'ptkp_status' => 'TK/0',
        ]);
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
            'ptkp' => ['key' => 'ptkp_status', 'type' => 'string'],
        ];

        foreach ($fields as $prefix => $config) {
            $val = $this->getValue($row, $prefix);
            if ($val !== null && trim((string) $val) !== '') {
                if ($config['type'] === 'float') {
                    // Clean currency format like 'Rp 5.000.000' or '5,000,000' or '5000000'
                    $cleanVal = preg_replace('/\D/', '', (string) $val);
                    $updateData[$config['key']] = (float) $cleanVal;
                } else {
                    $updateData[$config['key']] = trim((string) $val);
                }
            }
        }

        if (! empty($updateData)) {
            $user->update($updateData);
            $this->updatedCount++;
        }
    }

    private function getValue(array $row, $keyPrefix)
    {
        $keyPrefix = strtolower(trim($keyPrefix));
        foreach ($row as $key => $value) {
            $normalizedKey = strtolower(trim((string) $key));
            if (str_starts_with($normalizedKey, $keyPrefix) || str_contains($normalizedKey, $keyPrefix)) {
                return $value;
            }
        }

        return null;
    }
}
