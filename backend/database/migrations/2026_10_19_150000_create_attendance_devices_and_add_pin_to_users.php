<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('attendance_devices')) {
            Schema::create('attendance_devices', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->string('ip_address');
                $table->integer('port')->default(4370);
                $table->string('comm_key')->default('0');
                $table->string('device_model')->nullable()->default('Solution X100-C');
                $table->string('serial_number')->nullable();
                $table->enum('status', ['online', 'offline', 'error'])->default('offline');
                $table->timestamp('last_sync_at')->nullable();
                $table->text('last_error')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->index(['company_id', 'is_active']);
            });
        }

        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'fingerprint_pin')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('fingerprint_pin')->nullable()->after('nik')->index();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'fingerprint_pin')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('fingerprint_pin');
            });
        }

        Schema::dropIfExists('attendance_devices');
    }
};
