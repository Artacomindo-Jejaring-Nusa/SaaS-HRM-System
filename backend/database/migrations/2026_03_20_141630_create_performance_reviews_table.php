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
        Schema::create('performance_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade'); // The employee being reviewed
            $table->foreignId('reviewer_id')->constrained('users')->onDelete('cascade');
            $table->string('period'); // e.g., '2026-03' or '2026-Q1'

            // Scores (1-100/100)
            $table->integer('score_discipline')->default(0);
            $table->integer('score_technical')->default(0);
            $table->integer('score_cooperation')->default(0);
            $table->integer('score_attitude')->default(0);
            $table->integer('score_total')->default(0);

            $table->text('achievements')->nullable();
            $table->text('improvements')->nullable();
            $table->text('comments')->nullable();
            $table->string('status')->default('draft'); // draft, published

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('performance_reviews');
    }
};
