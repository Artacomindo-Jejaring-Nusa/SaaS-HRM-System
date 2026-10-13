<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('approval_workflows')) {
            $workflowIds = DB::table('approval_workflows')
                ->whereIn('module_key', ['performance_review', 'kpi', 'profile', 'profile_update', 'profil'])
                ->orWhere('name', 'like', '%Kinerja%')
                ->orWhere('name', 'like', '%KPI%')
                ->orWhere('name', 'like', '%Profil%')
                ->pluck('id');

            if ($workflowIds->isNotEmpty()) {
                if (Schema::hasTable('workflow_steps')) {
                    DB::table('workflow_steps')->whereIn('workflow_id', $workflowIds)->delete();
                }
                DB::table('approval_workflows')->whereIn('id', $workflowIds)->delete();
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op: Permanently removed from workflow system
    }
};
