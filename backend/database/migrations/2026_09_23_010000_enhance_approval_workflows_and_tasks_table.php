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
        Schema::table('approval_workflows', function (Blueprint $table) {
            if (!Schema::hasColumn('approval_workflows', 'description')) {
                $table->string('description', 255)->nullable()->after('name');
            }
            if (!Schema::hasColumn('approval_workflows', 'icon')) {
                $table->string('icon', 50)->nullable()->default('GitBranch')->after('description');
            }
            if (!Schema::hasColumn('approval_workflows', 'is_custom')) {
                $table->boolean('is_custom')->default(false)->after('is_active');
            }
            if (!Schema::hasColumn('approval_workflows', 'category')) {
                $table->string('category', 50)->nullable()->default('operasional')->after('is_custom');
            }
        });

        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'current_approval_step')) {
                $table->unsignedInteger('current_approval_step')->nullable()->after('status');
            }
            if (!Schema::hasColumn('tasks', 'approved_by')) {
                $table->foreignId('approved_by')->nullable()->after('current_approval_step')->constrained('users')->onDelete('set null');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('approval_workflows', function (Blueprint $table) {
            if (Schema::hasColumn('approval_workflows', 'category')) {
                $table->dropColumn('category');
            }
            if (Schema::hasColumn('approval_workflows', 'is_custom')) {
                $table->dropColumn('is_custom');
            }
            if (Schema::hasColumn('approval_workflows', 'icon')) {
                $table->dropColumn('icon');
            }
            if (Schema::hasColumn('approval_workflows', 'description')) {
                $table->dropColumn('description');
            }
        });

        Schema::table('tasks', function (Blueprint $table) {
            if (Schema::hasColumn('tasks', 'approved_by')) {
                $table->dropConstrainedForeignId('approved_by');
            }
            if (Schema::hasColumn('tasks', 'current_approval_step')) {
                $table->dropColumn('current_approval_step');
            }
        });
    }
};
