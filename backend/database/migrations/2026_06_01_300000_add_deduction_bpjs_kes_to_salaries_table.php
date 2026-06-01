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
        Schema::table('salaries', function (Blueprint $table) {
            if (!Schema::hasColumn('salaries', 'deduction_bpjs_kes')) {
                $table->decimal('deduction_bpjs_kes', 15, 2)->default(0)->after('deduction_bpjs_jp');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('salaries', function (Blueprint $table) {
            if (Schema::hasColumn('salaries', 'deduction_bpjs_kes')) {
                $table->dropColumn('deduction_bpjs_kes');
            }
        });
    }
};
