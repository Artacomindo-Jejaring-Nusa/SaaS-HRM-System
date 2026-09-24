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
        Schema::create('payroll_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('name');
            $table->string('code')->nullable();
            $table->enum('type', ['earning', 'deduction']);
            $table->string('calculation_rule')->default('fixed'); // fixed, attendance, percentage, formula, adhoc
            $table->decimal('default_amount', 15, 2)->default(0);
            $table->decimal('percentage_value', 8, 2)->nullable();
            $table->string('percentage_basis')->nullable(); // basic_salary, gross_salary, etc.
            $table->text('formula_expression')->nullable();
            $table->boolean('is_taxable')->default(true);
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'is_active', 'type']);
        });

        Schema::create('component_triggers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('component_id')->constrained('payroll_components')->onDelete('cascade');
            $table->string('trigger_type')->default('recurring_monthly'); // recurring_monthly, fixed_calendar_date, date_range, employee_anniversary, manual
            $table->json('config')->nullable();
            $table->timestamps();

            $table->index(['component_id', 'trigger_type']);
        });

        Schema::create('employee_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('component_id')->constrained('payroll_components')->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('cascade');
            $table->foreignId('role_id')->nullable()->constrained('roles')->onDelete('cascade');
            $table->boolean('is_global')->default(false);
            $table->decimal('custom_amount', 15, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['component_id', 'user_id', 'role_id']);
        });

        Schema::create('payslip_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salary_id')->constrained('salaries')->onDelete('cascade');
            $table->foreignId('component_id')->nullable()->constrained('payroll_components')->nullOnDelete();
            $table->string('component_name');
            $table->enum('type', ['earning', 'deduction']);
            $table->string('calculation_rule')->nullable();
            $table->decimal('amount', 15, 2)->default(0);
            $table->string('note')->nullable();
            $table->boolean('is_adhoc')->default(false);
            $table->timestamps();

            $table->index(['salary_id', 'type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payslip_details');
        Schema::dropIfExists('employee_components');
        Schema::dropIfExists('component_triggers');
        Schema::dropIfExists('payroll_components');
    }
};
