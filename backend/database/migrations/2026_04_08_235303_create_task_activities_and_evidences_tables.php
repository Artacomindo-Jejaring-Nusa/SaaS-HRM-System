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
        // Task Activities Table
        Schema::create('task_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->onDelete('cascade');
            $table->string('activity_name');
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->enum('status', ['pending', 'in_progress', 'completed'])->default('pending');
            $table->boolean('has_before_photo')->default(false);
            $table->boolean('has_after_photo')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index('task_id');
        });

        // Task Evidences Table
        Schema::create('task_evidences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_activity_id')->constrained()->onDelete('cascade');
            $table->string('photo_before_path')->nullable();
            $table->string('photo_after_path');
            $table->text('notes')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->index('task_activity_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('task_evidences');
        Schema::dropIfExists('task_activities');
    }
};
