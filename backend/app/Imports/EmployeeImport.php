<?php

namespace App\Imports;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use PhpOffice\PhpSpreadsheet\Shared\Date;

class EmployeeImport implements ToModel, WithHeadingRow
{
    protected $companyId;

    public $importedCount = 0;

    public function __construct($companyId)
    {
        $this->companyId = $companyId;
    }

    public function model(array $row)
    {
        $nama = $this->getValue($row, 'nama');
        $email = $this->getValue($row, 'email');

        if ($this->isInstructionOrInvalidRow($nama, $email)) {
            return null;
        }

        $roleId = $this->getValue($row, 'role_id') ?: 3;
        $password = $this->getValue($row, 'password');
        $joinDate = $this->parseDate($this->getValue($row, 'tanggal_gabung'), now()->format('Y-m-d'));
        $dob = $this->parseDate($this->getValue($row, 'tanggal_lahir'));

        $existingUser = User::where('email', trim($email))->first();
        if ($existingUser) {
            $updateData = $this->buildUpdateData($row, $existingUser, $nama, $roleId, $joinDate, $dob, $password);
            $existingUser->update($updateData);
            $this->importedCount++;
            return null;
        }

        $this->importedCount++;
        return $this->buildNewUser($row, $nama, $email, $roleId, $joinDate, $dob, $password);
    }

    private function isInstructionOrInvalidRow(?string $nama, ?string $email): bool
    {
        if (empty($nama) || empty($email)) {
            return true;
        }

        return str_contains($nama, '>>>') || str_contains($nama, 'Panduan') || str_contains($nama, 'Angka');
    }

    private function resolveStringFields(array $row): array
    {
        $stringFields = [
            'nik' => 'nik',
            'phone' => 'nomor_telepon',
            'address' => 'alamat',
            'ktp_no' => 'nomor_ktp',
            'place_of_birth' => 'tempat_lahir',
            'gender' => 'jenis_kelamin',
            'religion' => 'agama',
            'marital_status' => 'status_nikah',
            'blood_type' => 'gol_darah',
            'emergency_contact_name' => 'nama_kontak_darurat',
            'emergency_contact_phone' => 'nomor_kontak_darurat',
        ];

        $data = [];
        foreach ($stringFields as $field => $key) {
            $val = $this->getValue($row, $key);
            if ($val !== null && $val !== '') {
                $data[$field] = (string) $val;
            }
        }
        return $data;
    }

    private function resolveSupervisorId(array $row): ?int
    {
        $supervisorId = $this->getValue($row, 'id_atasan');
        if ($supervisorId === null) {
            return null;
        }
        return is_numeric($supervisorId) ? (int) $supervisorId : null;
    }

    private function buildUpdateData(array $row, User $existingUser, string $nama, $roleId, $joinDate, $dob, $password): array
    {
        $statusKaryawan = $this->getValue($row, 'status_karyawan') ?: ($existingUser->employment_status ?: 'Permanent');
        $lokasiKerja = $this->getValue($row, 'lokasi_kerja') ?: ($existingUser->work_location ?: 'Kantor Pusat');

        $updateData = array_merge($this->resolveStringFields($row), [
            'name' => trim($nama),
            'role_id' => $roleId,
            'join_date' => $joinDate ?: $existingUser->join_date,
            'employment_status' => $statusKaryawan,
            'work_location' => $lokasiKerja,
        ]);

        if ($dob) {
            $updateData['date_of_birth'] = $dob;
        }

        $supervisorId = $this->resolveSupervisorId($row);
        if ($supervisorId !== null) {
            $updateData['supervisor_id'] = $supervisorId;
        }

        if (!empty($password) && !in_array($password, ['***', 'tempPassword123!'], true)) {
            $updateData['password'] = Hash::make($password);
        }

        return $updateData;
    }

    private function buildNewUser(array $row, string $nama, string $email, $roleId, $joinDate, $dob, $password): User
    {
        $userData = array_merge($this->resolveStringFields($row), [
            'company_id' => $this->companyId,
            'name' => trim($nama),
            'email' => trim($email),
            'password' => Hash::make($password ?: 'tempPassword123!'),
            'role_id' => $roleId,
            'join_date' => $joinDate ?: now()->format('Y-m-d'),
            'date_of_birth' => $dob,
            'employment_status' => $this->getValue($row, 'status_karyawan') ?: 'Permanent',
            'work_location' => $this->getValue($row, 'lokasi_kerja') ?: 'Kantor Pusat',
            'supervisor_id' => $this->resolveSupervisorId($row),
        ]);

        return new User($userData);
    }

    /**
     * Helper untuk mengambil value dari row berdasarkan prefix key (karena slugging)
     */
    private function parseDate($raw, $default = null)
    {
        if (empty($raw)) {
            return $default;
        }
        if (is_numeric($raw)) {
            try {
                return Date::excelToDateTimeObject($raw)->format('Y-m-d');
            } catch (\Exception $e) {
                return $default;
            }
        }
        return date('Y-m-d', strtotime($raw));
    }

    private function getValue(array $row, $keyPrefix)
    {
        foreach ($row as $key => $value) {
            if (str_starts_with($key, $keyPrefix)) {
                return $value;
            }
        }

        return null;
    }
}
