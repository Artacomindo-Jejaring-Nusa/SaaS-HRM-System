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
            $table->text('signature')->nullable()->after('remark');
            $table->json('items')->nullable()->after('title');
            $table->string('divisi')->nullable()->after('items');
            $table->string('tujuan')->nullable()->after('divisi');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reimbursements', function (Blueprint $table) {
            $table->dropColumn(['signature', 'items', 'divisi', 'tujuan']);
        });
    }
};
