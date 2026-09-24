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
            // First add an index on company_id so MySQL foreign key constraint remains valid
            $table->index('company_id', 'approval_workflows_company_id_fk_idx');
        });

        Schema::table('approval_workflows', function (Blueprint $table) {
            // Now drop the compound unique constraint to allow multiple variants per module (scoped workflows)
            try {
                $table->dropUnique('approval_workflows_company_id_module_key_unique');
            } catch (Throwable $e) {
                // If index already dropped, continue
            }

            if (!Schema::hasColumn('approval_workflows', 'scope_type')) {
                $table->string('scope_type', 30)->default('company')->after('category');
            }

            if (!Schema::hasColumn('approval_workflows', 'scope_id')) {
                $table->unsignedBigInteger('scope_id')->nullable()->after('scope_type');
            }

            if (!Schema::hasColumn('approval_workflows', 'priority')) {
                $table->integer('priority')->default(0)->after('scope_id');
            }

            $table->index(['company_id', 'module_key', 'scope_type'], 'wf_company_module_scope_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('approval_workflows', function (Blueprint $table) {
            try {
                $table->dropIndex('wf_company_module_scope_idx');
            } catch (Throwable $e) {}

            if (Schema::hasColumn('approval_workflows', 'priority')) {
                $table->dropColumn('priority');
            }
            if (Schema::hasColumn('approval_workflows', 'scope_id')) {
                $table->dropColumn('scope_id');
            }
            if (Schema::hasColumn('approval_workflows', 'scope_type')) {
                $table->dropColumn('scope_type');
            }

            try {
                $table->unique(['company_id', 'module_key'], 'approval_workflows_company_id_module_key_unique');
            } catch (Throwable $e) {}

            try {
                $table->dropIndex('approval_workflows_company_id_fk_idx');
            } catch (Throwable $e) {}
        });
    }
};
