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
        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('module_key', 50);
            $table->string('name', 100);
            $table->boolean('is_active')->default(true);
            $table->longText('flow_json')->nullable();
            $table->timestamps();

            // Compound key: each company can have one workflow per module
            $table->unique(['company_id', 'module_key']);
        });

        Schema::create('workflow_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained('approval_workflows')->onDelete('cascade');
            $table->integer('step_number');
            $table->foreignId('approver_role_id')->nullable()->constrained('roles')->onDelete('set null');
            $table->string('approver_type', 50); // 'supervisor', 'role', 'user'
            $table->integer('sla_hours')->default(24);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('workflow_steps');
        Schema::dropIfExists('approval_workflows');
    }
};
