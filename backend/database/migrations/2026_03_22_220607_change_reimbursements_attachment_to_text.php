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
        Schema::table('reimbursements', function (Blueprint $table) {
            $table->text('attachment')->nullable()->change();
        });

        // Migrate old data to JSON array format
        $reimbursements = \DB::table('reimbursements')->whereNotNull('attachment')->get();
        foreach ($reimbursements as $reimbursement) {
            $val = $reimbursement->attachment;
            // If not already a json array
            if (! str_starts_with($val, '[')) {
                \DB::table('reimbursements')
                    ->where('id', $reimbursement->id)
                    ->update(['attachment' => json_encode([$val])]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reimbursements', function (Blueprint $table) {
            $table->string('attachment')->nullable()->change();
        });
    }
};
