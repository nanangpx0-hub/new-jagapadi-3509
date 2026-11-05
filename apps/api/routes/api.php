<?php

declare(strict_types=1);

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DistrictController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\OptController;
use App\Http\Controllers\Api\ReportController;
use Illuminate\Support\Facades\Route;

// Health Check
Route::get('/health', HealthController::class)->name('api.health');

// Autentikasi Publik
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->name('auth.login');
});

// Master Wilayah (Publik / Referensi Form)
Route::prefix('districts')->group(function () {
    Route::get('/', [DistrictController::class, 'index'])->name('districts.index');
    Route::get('/{district}/villages', [DistrictController::class, 'villages'])->name('districts.villages');
});

// Master OPT (Baca Publik untuk Form Draf)
Route::prefix('opts')->group(function () {
    Route::get('/', [OptController::class, 'index'])->name('opts.index');
    Route::get('/{opt}', [OptController::class, 'show'])->name('opts.show');
});

// Endpoint Terautentikasi (Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    // Profil & Sesi
    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::post('/change-password', [AuthController::class, 'changePassword'])->name('auth.change-password');
    });

    // Manajemen Master OPT (Hanya Admin & Operator)
    Route::middleware('permission:opts.manage')->prefix('opts')->group(function () {
        Route::post('/', [OptController::class, 'store'])->name('opts.store');
        Route::put('/{opt}', [OptController::class, 'update'])->name('opts.update');
        Route::delete('/{opt}', [OptController::class, 'destroy'])->name('opts.destroy');
    });

    // Modul Pelaporan (Fase 2: Hama & Irigasi)
    Route::prefix('reports')->group(function () {
        Route::get('/', [ReportController::class, 'index'])->name('reports.index');
        Route::get('/{report}', [ReportController::class, 'show'])->name('reports.show');
        Route::post('/', [ReportController::class, 'store'])->name('reports.store');
        Route::post('/{report}/submit', [ReportController::class, 'submit'])->name('reports.submit');
        Route::post('/{report}/photos', [ReportController::class, 'uploadPhoto'])->name('reports.photos');

        // Verifikasi & Penolakan Laporan (Admin, Operator, Statistisi)
        Route::middleware('permission:reports.verify')->group(function () {
            Route::post('/{report}/verify', [ReportController::class, 'verify'])->name('reports.verify');
            Route::post('/{report}/reject', [ReportController::class, 'reject'])->name('reports.reject');
        });
    });
});
