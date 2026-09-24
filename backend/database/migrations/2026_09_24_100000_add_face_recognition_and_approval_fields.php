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
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'face_embedding')) {
                $table->text('face_embedding')->nullable()->after('profile_photo_path');
            }
            if (!Schema::hasColumn('users', 'face_status')) {
                $table->enum('face_status', ['not_registered', 'pending', 'approved', 'rejected'])
                    ->default('not_registered')
                    ->after('face_embedding');
            }
            if (!Schema::hasColumn('users', 'face_registered_photo_path')) {
                $table->string('face_registered_photo_path', 2048)->nullable()->after('face_status');
            }
            if (!Schema::hasColumn('users', 'face_rejection_reason')) {
                $table->string('face_rejection_reason', 500)->nullable()->after('face_registered_photo_path');
            }
            if (!Schema::hasColumn('users', 'face_registered_at')) {
                $table->timestamp('face_registered_at')->nullable()->after('face_rejection_reason');
            }
            if (!Schema::hasColumn('users', 'face_approved_at')) {
                $table->timestamp('face_approved_at')->nullable()->after('face_registered_at');
            }
            if (!Schema::hasColumn('users', 'face_approved_by')) {
                $table->foreignId('face_approved_by')->nullable()->constrained('users')->nullOnDelete()->after('face_approved_at');
            }
        });

        Schema::table('attendances', function (Blueprint $table) {
            if (!Schema::hasColumn('attendances', 'face_similarity_score_in')) {
                $table->decimal('face_similarity_score_in', 5, 4)->nullable()->after('image_in');
            }
            if (!Schema::hasColumn('attendances', 'is_face_verified_in')) {
                $table->boolean('is_face_verified_in')->default(false)->after('face_similarity_score_in');
            }
            if (!Schema::hasColumn('attendances', 'face_similarity_score_out')) {
                $table->decimal('face_similarity_score_out', 5, 4)->nullable()->after('image_out');
            }
            if (!Schema::hasColumn('attendances', 'is_face_verified_out')) {
                $table->boolean('is_face_verified_out')->default(false)->after('face_similarity_score_out');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropColumn([
                'face_similarity_score_in',
                'is_face_verified_in',
                'face_similarity_score_out',
                'is_face_verified_out'
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['face_approved_by']);
            $table->dropColumn([
                'face_status',
                'face_registered_photo_path',
                'face_rejection_reason',
                'face_registered_at',
                'face_approved_at',
                'face_approved_by'
            ]);
        });
    }
};
