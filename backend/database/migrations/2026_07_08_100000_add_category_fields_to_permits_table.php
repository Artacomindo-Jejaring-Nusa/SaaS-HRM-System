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
        Schema::table('permits', function (Blueprint $table) {
            $table->string('category', 2)->default('I')->after('type'); // I=Izin, A=Alpha, S=Sakit, L=Lainnya
            $table->boolean('has_doctor_note')->default(false)->after('category'); // Khusus kategori S
            $table->boolean('is_deducted')->default(false)->after('has_doctor_note'); // Potong gaji atau tidak
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('permits', function (Blueprint $table) {
            $table->dropColumn(['category', 'has_doctor_note', 'is_deducted']);
        });
    }
};
