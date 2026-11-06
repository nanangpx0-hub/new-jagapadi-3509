<?php

declare(strict_types=1);

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->statefulApi();

        // Aplikasi API-only: tidak ada named route "login"; tamu menerima 401 JSON,
        // bukan redirect (yang memicu RouteNotFoundException -> 500).
        $middleware->redirectGuestsTo(fn () => null);

        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Semua rute API selalu merespons error sebagai JSON (422, 401, 403, dll.),
        // bukan redirect HTML — penting untuk klien PWA/fetch yang tidak selalu
        // mengirim header Accept: application/json.
        $exceptions->shouldRenderJsonWhen(
            fn ($request) => $request->is('api/*')
        );
    })->create();
