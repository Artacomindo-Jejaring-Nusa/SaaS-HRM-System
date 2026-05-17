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
        // Debugging keys if needed: Log::info(array_keys($row));

        // Cari key yang mengandung 'nama', 'email', dll karena HeadingRow slugifier
        // akan mengubah "nama (WAJIB)" menjadi "nama_wajib"
        $nama = $this->getValue($row, 'nama');
        $email = $this->getValue($row, 'email');

        if (empty($nama) || empty($email)) {
            return null; // Skip invalid row or instruction row
        }

        // Skip rows that look like instructions
        if (str_contains($nama, '>>>') || str_contains($nama, 'Panduan') || str_contains($nama, 'Angka')) {
            return null;
        }

        // Cek kalau email sudah terdaftar
        if (User::where('email', $email)->exists()) {
            return null;
        }

        $roleId = $this->getValue($row, 'role_id') ?: 3;
        $password = $this->getValue($row, 'password') ?: 'password123';

        $joinDate = $this->parseDate($this->getValue($row, 'tanggal_gabung'), now()->format('Y-m-d'));
        $dob = $this->parseDate($this->getValue($row, 'tanggal_lahir'));

        $this->importedCount++;

        return new User([
            'company_id' => $this->companyId,
            'name' => trim($nama),
            'email' => trim($email),
            'nik' => (string) $this->getValue($row, 'nik'),
            'password' => Hash::make($password),
            'role_id' => $roleId,
            'join_date' => $joinDate,
            'phone' => (string) $this->getValue($row, 'nomor_telepon'),
            'address' => $this->getValue($row, 'alamat'),
            'ktp_no' => (string) $this->getValue($row, 'nomor_ktp'),
            'place_of_birth' => $this->getValue($row, 'tempat_lahir'),
            'date_of_birth' => $dob,
            'gender' => $this->getValue($row, 'jenis_kelamin'),
            'religion' => $this->getValue($row, 'agama'),
            'marital_status' => $this->getValue($row, 'status_nikah'),
            'blood_type' => $this->getValue($row, 'gol_darah'),
            'employment_status' => $this->getValue($row, 'status_karyawan') ?: 'Permanent',
            'work_location' => $this->getValue($row, 'lokasi_kerja') ?: 'Kantor Pusat',
            'supervisor_id' => $this->getValue($row, 'id_atasan'),
            'emergency_contact_name' => $this->getValue($row, 'nama_kontak_darurat'),
            'emergency_contact_phone' => $this->getValue($row, 'nomor_kontak_darurat'),
        ]);
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
