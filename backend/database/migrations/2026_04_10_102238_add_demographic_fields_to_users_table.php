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
        Schema::table('users', function (Blueprint $table) {
            // Demographic / Personal Data
            $table->string('ktp_no')->nullable()->after('nik'); // Nomor Induk Kependudukan (KTP)
            $table->string('place_of_birth')->nullable()->after('address');
            $table->date('date_of_birth')->nullable()->after('place_of_birth');
            $table->enum('gender', ['Laki-laki', 'Perempuan'])->nullable()->after('date_of_birth');
            $table->string('marital_status')->nullable()->after('gender'); // e.g. Single, Menikah, Janda, Duda
            $table->string('religion')->nullable()->after('marital_status');
            $table->string('blood_type', 5)->nullable()->after('religion'); // A, B, AB, O

            // Emergency Contact Data
            $table->string('emergency_contact_name')->nullable()->after('phone');
            $table->string('emergency_contact_phone')->nullable()->after('emergency_contact_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'ktp_no',
                'place_of_birth',
                'date_of_birth',
                'gender',
                'marital_status',
                'religion',
                'blood_type',
                'emergency_contact_name',
                'emergency_contact_phone',
            ]);
        });
    }
};
