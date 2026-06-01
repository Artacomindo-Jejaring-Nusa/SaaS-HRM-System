<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Widen columns that will store AES-256 encrypted data.
     * Ciphertext is significantly longer than plaintext (~200+ chars for short values).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('ktp_no')->nullable()->change();
            $table->text('bank_account_no')->nullable()->change();
            $table->text('bpjs_kesehatan_no')->nullable()->change();
            $table->text('bpjs_ketenagakerjaan_no')->nullable()->change();
        });

        Schema::table('salaries', function (Blueprint $table) {
            $table->text('bank_account_no')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('ktp_no')->nullable()->change();
            $table->string('bank_account_no')->nullable()->change();
            $table->string('bpjs_kesehatan_no')->nullable()->change();
            $table->string('bpjs_ketenagakerjaan_no')->nullable()->change();
        });

        Schema::table('salaries', function (Blueprint $table) {
            $table->string('bank_account_no')->nullable()->change();
        });
    }
};
