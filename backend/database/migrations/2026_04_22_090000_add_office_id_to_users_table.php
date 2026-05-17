<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Allows assigning employees to specific office/branch locations
     * for multi-office geofencing attendance validation.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('office_id')->nullable()->after('company_id')
                ->constrained('offices')->onDelete('set null');
        });

        // Add optional address column to offices for better context
        Schema::table('offices', function (Blueprint $table) {
            $table->string('address')->nullable()->after('name');
            $table->boolean('is_active')->default(true)->after('radius');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['office_id']);
            $table->dropColumn('office_id');
        });

        Schema::table('offices', function (Blueprint $table) {
            $table->dropColumn(['address', 'is_active']);
        });
    }
};
