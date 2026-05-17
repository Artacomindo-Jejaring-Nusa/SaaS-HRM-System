<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\VehicleLog;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class VehicleLogSeeder extends Seeder
{
    public function run(): void
    {
        // Ambil semua user dari company pertama yang ada
        $users = User::whereNotNull('company_id')
            ->orderBy('id')
            ->limit(6)
            ->get();

        if ($users->isEmpty()) {
            $this->command->warn('Tidak ada user ditemukan. Seeder VehicleLog dilewati.');

            return;
        }

        $companyId = $users->first()->company_id;

        // Daftar kendaraan operasional perusahaan (berdasarkan SOP Mobil Operational)
        $vehicles = [
            ['name' => 'Toyota Avanza', 'plate' => 'B 1234 NRW'],
            ['name' => 'Mitsubishi L300', 'plate' => 'B 5678 NRW'],
            ['name' => 'Daihatsu Gran Max', 'plate' => 'B 9012 NRW'],
            ['name' => 'Toyota Hilux', 'plate' => 'B 3456 NRW'],
            ['name' => 'Suzuki Carry', 'plate' => 'D 7890 NRW'],
        ];

        // Tujuan-tujuan realistis
        $destinations = [
            ['destination' => 'Jakarta Selatan', 'purpose' => 'Survey Lokasi Proyek Apartemen Cilandak'],
            ['destination' => 'Bekasi', 'purpose' => 'Pengiriman Material ke Proyek Bekasi Timur'],
            ['destination' => 'Tangerang', 'purpose' => 'Meeting Klien PT Sejahtera Abadi'],
            ['destination' => 'Bogor', 'purpose' => 'Inspeksi Proyek Villa Sentul'],
            ['destination' => 'Depok', 'purpose' => 'Kunjungan Supplier CV Maju Jaya'],
            ['destination' => 'Bandung', 'purpose' => 'Negosiasi Kontrak Proyek Dago Atas'],
            ['destination' => 'Cirebon', 'purpose' => 'Pengiriman Alat Berat ke Gudang Cirebon'],
            ['destination' => 'Karawang', 'purpose' => 'Cek Progress Pembangunan Pabrik'],
            ['destination' => 'Cikarang', 'purpose' => 'Pickup Material dari Vendor'],
            ['destination' => 'Serpong', 'purpose' => 'Survei Lahan BSD City'],
            ['destination' => 'Cibubur', 'purpose' => 'Antar Dokumen Tender ke Kantor Klien'],
            ['destination' => 'Kelapa Gading', 'purpose' => 'Presentasi Proposal Renovasi Mall'],
        ];

        $now = Carbon::now();
        $logs = [];

        // ─── 1. Status "approved" — Perjalanan sudah selesai & divalidasi (8 data)
        for ($i = 0; $i < 8; $i++) {
            $user = $users[$i % $users->count()];
            $vehicle = $vehicles[$i % count($vehicles)];
            $trip = $destinations[$i % count($destinations)];
            $departDate = $now->copy()->subDays(rand(15, 45));
            $returnDate = $departDate->copy()->addDays(rand(0, 2));
            $kmStart = rand(15000, 80000);
            $distance = rand(25, 350);
            $kmEnd = $kmStart + $distance;
            $fuelCost = round($distance * rand(900, 1400)); // ~Rp 900-1400/km
            $tollCost = rand(0, 1) ? rand(15000, 85000) : 0;
            $parkingCost = rand(5000, 30000);
            $otherCost = rand(0, 1) ? rand(10000, 50000) : 0;
            $totalCost = $fuelCost + $tollCost + $parkingCost + $otherCost;

            $logs[] = [
                'company_id' => $companyId,
                'user_id' => $user->id,
                'vehicle_name' => $vehicle['name'],
                'plate_number' => $vehicle['plate'],
                'purpose' => $trip['purpose'],
                'destination' => $trip['destination'],
                'departure_date' => $departDate->format('Y-m-d'),
                'return_date' => $returnDate->format('Y-m-d'),
                'odometer_start' => $kmStart,
                'odometer_end' => $kmEnd,
                'distance' => $distance,
                'odometer_start_photo' => null,
                'odometer_end_photo' => null,
                'fuel_cost' => $fuelCost,
                'toll_cost' => $tollCost,
                'parking_cost' => $parkingCost,
                'other_cost' => $otherCost,
                'total_cost' => $totalCost,
                'expense_attachments' => null,
                'notes' => 'Perjalanan dinas '.$trip['destination'].' berjalan lancar.',
                'status' => 'approved',
                'approved_by' => $users->first()->id,
                'remark' => 'Divalidasi. Jarak & biaya sesuai.',
                'created_at' => $departDate,
                'updated_at' => $returnDate,
            ];
        }

        // ─── 2. Status "completed" — Sudah selesai, menunggu validasi (4 data)
        for ($i = 0; $i < 4; $i++) {
            $user = $users[($i + 2) % $users->count()];
            $vehicle = $vehicles[($i + 1) % count($vehicles)];
            $trip = $destinations[($i + 8) % count($destinations)];
            $departDate = $now->copy()->subDays(rand(3, 10));
            $returnDate = $departDate->copy()->addDays(rand(0, 1));
            $kmStart = rand(20000, 70000);
            $distance = rand(30, 200);
            $kmEnd = $kmStart + $distance;
            $fuelCost = round($distance * rand(1000, 1300));
            $tollCost = rand(0, 1) ? rand(20000, 60000) : 0;
            $parkingCost = rand(5000, 25000);
            $otherCost = 0;
            $totalCost = $fuelCost + $tollCost + $parkingCost;

            $logs[] = [
                'company_id' => $companyId,
                'user_id' => $user->id,
                'vehicle_name' => $vehicle['name'],
                'plate_number' => $vehicle['plate'],
                'purpose' => $trip['purpose'],
                'destination' => $trip['destination'],
                'departure_date' => $departDate->format('Y-m-d'),
                'return_date' => $returnDate->format('Y-m-d'),
                'odometer_start' => $kmStart,
                'odometer_end' => $kmEnd,
                'distance' => $distance,
                'odometer_start_photo' => null,
                'odometer_end_photo' => null,
                'fuel_cost' => $fuelCost,
                'toll_cost' => $tollCost,
                'parking_cost' => $parkingCost,
                'other_cost' => $otherCost,
                'total_cost' => $totalCost,
                'expense_attachments' => null,
                'notes' => 'Mohon validasi perjalanan ke '.$trip['destination'],
                'status' => 'completed',
                'approved_by' => null,
                'remark' => null,
                'created_at' => $departDate,
                'updated_at' => $returnDate,
            ];
        }

        // ─── 3. Status "departure" — Sedang dalam perjalanan (3 data)
        for ($i = 0; $i < 3; $i++) {
            $user = $users[($i + 1) % $users->count()];
            $vehicle = $vehicles[($i + 3) % count($vehicles)];
            $departDate = $now->copy()->subDays(rand(0, 2));
            $kmStart = rand(30000, 60000);

            $destinationsActive = [
                ['destination' => 'Surabaya', 'purpose' => 'Pengiriman Material Proyek Jawa Timur'],
                ['destination' => 'Semarang', 'purpose' => 'Meeting Vendor Baja Ringan'],
                ['destination' => 'Purwakarta', 'purpose' => 'Inspeksi Gudang Material'],
            ];
            $trip = $destinationsActive[$i];

            $logs[] = [
                'company_id' => $companyId,
                'user_id' => $user->id,
                'vehicle_name' => $vehicle['name'],
                'plate_number' => $vehicle['plate'],
                'purpose' => $trip['purpose'],
                'destination' => $trip['destination'],
                'departure_date' => $departDate->format('Y-m-d'),
                'return_date' => null,
                'odometer_start' => $kmStart,
                'odometer_end' => null,
                'distance' => null,
                'odometer_start_photo' => null,
                'odometer_end_photo' => null,
                'fuel_cost' => 0,
                'toll_cost' => 0,
                'parking_cost' => 0,
                'other_cost' => 0,
                'total_cost' => 0,
                'expense_attachments' => null,
                'notes' => 'Berangkat ke '.$trip['destination'],
                'status' => 'departure',
                'approved_by' => null,
                'remark' => null,
                'created_at' => $departDate,
                'updated_at' => $departDate,
            ];
        }

        // ─── 4. Status "rejected" — Ditolak (2 data)
        for ($i = 0; $i < 2; $i++) {
            $user = $users[($i + 3) % $users->count()];
            $vehicle = $vehicles[($i + 2) % count($vehicles)];
            $departDate = $now->copy()->subDays(rand(8, 20));
            $returnDate = $departDate->copy()->addDays(1);
            $kmStart = rand(25000, 55000);
            $distance = rand(15, 100);
            $kmEnd = $kmStart + $distance;
            $fuelCost = round($distance * rand(2000, 3000)); // Sengaja mahal → ditolak
            $tollCost = rand(50000, 150000);
            $parkingCost = rand(20000, 50000);
            $totalCost = $fuelCost + $tollCost + $parkingCost;

            $rejectionReasons = [
                'Biaya BBM tidak sesuai dengan jarak tempuh. Mohon ajukan ulang dengan bukti yang valid.',
                'Kendaraan tidak terdaftar dalam SK Mobil Operasional. Silakan koordinasi dengan HRD.',
            ];

            $logs[] = [
                'company_id' => $companyId,
                'user_id' => $user->id,
                'vehicle_name' => $vehicle['name'],
                'plate_number' => $vehicle['plate'],
                'purpose' => 'Perjalanan Dinas ke Luar Kota',
                'destination' => $i === 0 ? 'Yogyakarta' : 'Surabaya',
                'departure_date' => $departDate->format('Y-m-d'),
                'return_date' => $returnDate->format('Y-m-d'),
                'odometer_start' => $kmStart,
                'odometer_end' => $kmEnd,
                'distance' => $distance,
                'odometer_start_photo' => null,
                'odometer_end_photo' => null,
                'fuel_cost' => $fuelCost,
                'toll_cost' => $tollCost,
                'parking_cost' => $parkingCost,
                'other_cost' => 0,
                'total_cost' => $totalCost,
                'expense_attachments' => null,
                'notes' => 'Perjalanan dinas luar kota.',
                'status' => 'rejected',
                'approved_by' => $users->first()->id,
                'remark' => $rejectionReasons[$i],
                'created_at' => $departDate,
                'updated_at' => $returnDate->addDay(),
            ];
        }

        // Insert all logs
        foreach ($logs as $log) {
            VehicleLog::create($log);
        }

        $this->command->info('✅ VehicleLogSeeder: '.count($logs).' data dummy berhasil dibuat!');
        $this->command->info('   → 8 Approved | 4 Completed (Menunggu Validasi) | 3 Departure (Dalam Perjalanan) | 2 Rejected');
    }
}
