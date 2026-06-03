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
        // Enhance overtimes table
        Schema::table('overtimes', function (Blueprint $table) {
            $table->string('title')->nullable()->after('company_id');
            $table->string('status')->default('draft')->change();
            $table->text('signature')->nullable()->after('remark');
            $table->date('date')->nullable()->change();
            $table->time('start_time')->nullable()->change();
            $table->time('end_time')->nullable()->change();
            $table->text('reason')->nullable()->change();
        });

        // Create overtime_items table
        Schema::create('overtime_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('overtime_id')->constrained('overtimes')->onDelete('cascade');
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->text('reason');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('overtime_items');

        Schema::table('overtimes', function (Blueprint $table) {
            $table->dropColumn(['title', 'signature']);
            // Note: Reverting column nullability is skipped to avoid DB mismatch if data is present
        });
    }
};
