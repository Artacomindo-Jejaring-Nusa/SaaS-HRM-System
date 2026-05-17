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
        // Silent bypass if column exists but Schema::hasColumn fails to detect it
        try {
            Schema::table('users', function (Blueprint $table) {
                if (! Schema::hasColumn('users', 'employment_status')) {
                    $table->string('employment_status')->nullable()->after('join_date');
                }
            });
        } catch (Throwable $e) {
        }

        try {
            Schema::table('users', function (Blueprint $table) {
                if (! Schema::hasColumn('users', 'work_location')) {
                    $table->string('work_location')->nullable()->after('employment_status');
                }
            });
        } catch (Throwable $e) {
        }

        try {
            Schema::table('users', function (Blueprint $table) {
                if (! Schema::hasColumn('users', 'email_verified_at')) {
                    $table->timestamp('email_verified_at')->nullable()->after('email');
                }
            });
        } catch (Throwable $e) {
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $columnsToDrop = [];
            if (Schema::hasColumn('users', 'employment_status')) {
                $columnsToDrop[] = 'employment_status';
            }
            if (Schema::hasColumn('users', 'work_location')) {
                $columnsToDrop[] = 'work_location';
            }
            // We usually don't want to drop email_verified_at if it's a standard Laravel column
            // $columnsToDrop[] = 'email_verified_at';

            if (! empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
