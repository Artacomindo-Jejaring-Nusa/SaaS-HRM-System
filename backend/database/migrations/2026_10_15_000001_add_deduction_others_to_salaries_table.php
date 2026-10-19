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
            if (! Schema::hasColumn('salaries', 'deduction_others')) {
                $table->decimal('deduction_others', 15, 2)->default(0)->after('deduction_tax');
            }
            if (! Schema::hasColumn('salaries', 'deduction_others_note')) {
                $table->text('deduction_others_note')->nullable()->after('deduction_others');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('salaries', function (Blueprint $table) {
            if (Schema::hasColumn('salaries', 'deduction_others')) {
                $table->dropColumn('deduction_others');
            }
            if (Schema::hasColumn('salaries', 'deduction_others_note')) {
                $table->dropColumn('deduction_others_note');
            }
        });
    }
};
