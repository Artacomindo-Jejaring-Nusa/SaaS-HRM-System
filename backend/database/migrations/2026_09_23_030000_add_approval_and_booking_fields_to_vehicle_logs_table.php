<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Integrasi Alur Persetujuan & Peminjaman Kendaraan Dinas.
     */
    public function up(): void
    {
        Schema::table('vehicle_logs', function (Blueprint $table) {
            // Nullable odometer start for initial loan requests before departure
            $table->unsignedInteger('odometer_start')->nullable()->change();

            // Approval Workflow tracking
            $table->unsignedTinyInteger('current_approval_step')->nullable()->after('status');

            // Driver & Schedule details
            $table->string('driver_type')->default('self')->after('plate_number'); // 'self', 'driver'
            $table->string('driver_name')->nullable()->after('driver_type');
            $table->string('departure_time', 10)->nullable()->after('departure_date'); // e.g. "08:30"
            $table->string('return_time', 10)->nullable()->after('return_date'); // e.g. "17:00"
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vehicle_logs', function (Blueprint $table) {
            $table->unsignedInteger('odometer_start')->nullable(false)->change();
            $table->dropColumn([
                'current_approval_step',
                'driver_type',
                'driver_name',
                'departure_time',
                'return_time',
            ]);
        });
    }
};
