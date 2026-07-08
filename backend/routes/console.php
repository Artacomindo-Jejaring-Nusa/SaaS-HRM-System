<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');


Schedule::command('notifications:prune')->daily();
Schedule::command('attendance:remind-checkout')->dailyAt('17:00');
Schedule::command('approvals:remind-pending')->dailyAt('09:00');
Schedule::command('leave:accumulate-annual')->yearlyOn(12, 31, '23:59');
