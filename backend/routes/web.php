<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'app' => 'HRM SaaS API',
        'version' => '1.0.0',
        'status' => 'Running',
    ]);
});
