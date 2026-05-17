<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

use App\Models\Salary;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;

$user = User::where('email', 'staff@example.com')->first();
if ($user) {
    $salaries = Salary::where('user_id', $user->id)->get();
    echo 'Total: '.$salaries->count()."\n";
    echo json_encode($salaries, JSON_PRETTY_PRINT);
} else {
    echo 'User not found';
}
