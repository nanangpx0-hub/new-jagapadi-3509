<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Aplikasi bisa di-mount di subpath oleh Apache (Alias /api -> public). Dalam kondisi
// itu Apache mengisi SCRIPT_NAME dengan "/api/index.php" sehingga Laravel menganggap
// "/api" sebagai base URL dan memotong prefix "/api" dari path rute. Paksa base URL
// ke root agar REQUEST_URI "/api/..." tetap utuh saat routing. Tidak berefek saat
// DocumentRoot menunjuk langsung ke folder public (SCRIPT_NAME memang "/index.php").
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';

// Bootstrap Laravel and handle the request...
(require_once __DIR__.'/../bootstrap/app.php')
    ->handleRequest(Request::capture());
