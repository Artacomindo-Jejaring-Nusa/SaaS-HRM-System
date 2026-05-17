<?php

namespace App\Console\Commands;

use App\Models\RefreshToken;
use Illuminate\Console\Command;
use Laravel\Sanctum\PersonalAccessToken;

class PurgeExpiredTokens extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'tokens:purge';

    /**
     * The console command description.
     */
    protected $description = 'Purge expired and revoked refresh tokens from the database';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $deleted = RefreshToken::purgeExpired();

        // Also clean up expired Sanctum personal access tokens
        $sanctumDeleted = PersonalAccessToken::where('expires_at', '<', now())->delete();

        $this->info("Purged {$deleted} expired/revoked refresh tokens.");
        $this->info("Purged {$sanctumDeleted} expired Sanctum access tokens.");

        return Command::SUCCESS;
    }
}
