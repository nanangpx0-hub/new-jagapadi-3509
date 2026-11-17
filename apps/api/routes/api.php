<?php

declare(strict_types=1);

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DistrictController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OptController;
use App\Http\Controllers\Api\OptProposalController;
use App\Http\Controllers\Api\PestClusterController;
use App\Http\Controllers\Api\PhenomenonController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SlsController;
use App\Http\Controllers\Api\UserController;
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
    Route::get('/{district}/sls-stats', [SlsController::class, 'statsByDistrict'])->name('districts.sls-stats');
});
Route::get('/villages/{village}/sls', [SlsController::class, 'byVillage'])->name('villages.sls');
Route::get('/regions/locate', [DistrictController::class, 'locate'])->name('regions.locate');

// Master OPT (Baca Publik untuk Form Draf)
Route::prefix('opts')->group(function () {
    Route::get('/', [OptController::class, 'index'])->name('opts.index');
    Route::get('/{opt}', [OptController::class, 'show'])->name('opts.show');
});

// Endpoint Terautentikasi (Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    // Audit Log Sistem (khusus pemegang permission audit.view)
    Route::middleware('permission:audit.view')->get('/audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');

    // Notifikasi In-App
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index'])->name('notifications.index');
        Route::post('/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
        Route::post('/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');
    });

    // Profil & Sesi
    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::post('/change-password', [AuthController::class, 'changePassword'])->name('auth.change-password');
        Route::put('/theme', [AuthController::class, 'updateTheme'])->name('auth.theme');
    });

    // Manajemen Pengguna (Khusus Admin)
    Route::middleware('permission:users.manage')->prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index'])->name('users.index');
        Route::post('/', [UserController::class, 'store'])->name('users.store');
        Route::get('/{user}', [UserController::class, 'show'])->name('users.show');
        Route::put('/{user}', [UserController::class, 'update'])->name('users.update');
        Route::patch('/{user}/toggle-active', [UserController::class, 'toggleStatus'])->name('users.toggle-active');
        Route::post('/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset-password');
        Route::delete('/{user}', [UserController::class, 'destroy'])->name('users.destroy');
    });

    // Manajemen Master OPT (Hanya Admin & Operator)
    Route::middleware('permission:opts.manage')->prefix('opts')->group(function () {
        Route::post('/', [OptController::class, 'store'])->name('opts.store');
        Route::put('/{opt}', [OptController::class, 'update'])->name('opts.update');
        Route::delete('/{opt}', [OptController::class, 'destroy'])->name('opts.destroy');
    });

    // Rekapitulasi & narasi fenomena BPS (KSA / Ubinan / PDRB)
    Route::prefix('phenomena')->group(function () {
        Route::get('/summary', [PhenomenonController::class, 'summary'])->name('phenomena.summary');
        Route::get('/export', [PhenomenonController::class, 'export'])->name('phenomena.export');
    });

    // Usulan OPT dari lapangan
    Route::prefix('opt-proposals')->group(function () {
        Route::get('/', [OptProposalController::class, 'index'])->name('opt-proposals.index');
        Route::post('/', [OptProposalController::class, 'store'])->middleware('permission:opt-proposals.create')->name('opt-proposals.store');
        Route::post('/{optProposal}/approve', [OptProposalController::class, 'approve'])->middleware('permission:opt-proposals.review')->name('opt-proposals.approve');
        Route::post('/{optProposal}/reject', [OptProposalController::class, 'reject'])->middleware('permission:opt-proposals.review')->name('opt-proposals.reject');
    });

    // Modul Pelaporan (Fase 2: Hama & Irigasi)
    Route::prefix('reports')->group(function () {
        Route::get('/', [ReportController::class, 'index'])->name('reports.index');
        Route::get('/metrics', [ReportController::class, 'metrics'])->name('reports.metrics');
        Route::get('/pest-clusters', [PestClusterController::class, 'index'])->name('reports.pest-clusters');
        Route::get('/{report}', [ReportController::class, 'show'])->name('reports.show');
        Route::post('/', [ReportController::class, 'store'])->name('reports.store')->middleware('permission:reports.create');
        Route::put('/{report}', [ReportController::class, 'update'])->name('reports.update')->middleware('permission:reports.update');
        Route::delete('/{report}', [ReportController::class, 'destroy'])->name('reports.destroy')->middleware('permission:reports.delete');
        Route::post('/{report}/submit', [ReportController::class, 'submit'])->name('reports.submit');
        Route::post('/{report}/photos', [ReportController::class, 'uploadPhoto'])->name('reports.photos');
        Route::get('/{report}/followups', [ReportController::class, 'indexFollowups'])->name('reports.followups.index');
        Route::post('/{report}/followups', [ReportController::class, 'storeFollowup'])->name('reports.followups.store');

        // Verifikasi & Penolakan Laporan (Admin, Operator, Statistisi)
        Route::middleware('permission:reports.verify')->group(function () {
            Route::post('/{report}/verify', [ReportController::class, 'verify'])->name('reports.verify');
            Route::post('/{report}/reject', [ReportController::class, 'reject'])->name('reports.reject');
        });

        // Arsip Laporan (Admin, Operator)
        Route::post('/{report}/archive', [ReportController::class, 'archive'])->name('reports.archive')->middleware('permission:reports.archive');
    });
});
