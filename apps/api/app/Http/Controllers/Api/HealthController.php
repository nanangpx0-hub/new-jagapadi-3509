<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class HealthController extends Controller
{
    /**
     * Memeriksa kesehatan infrastruktur JAGAPADI v3 (PostgreSQL, PostGIS, Redis, dan Storage).
     *
     * @response array{
     *   status: 'ok'|'degraded',
     *   service: string,
     *   timezone: string,
     *   timestamp: string,
     *   checks: array{
     *     database: array{status: 'ok'|'error', driver: string, message?: string},
     *     postgis: array{status: 'ok'|'error', version: string|null, message?: string},
     *     redis: array{status: 'ok'|'error', response: string|null, message?: string},
     *     storage: array{status: 'ok'|'error', writable: bool, message?: string}
     *   }
     * }
     */
    public function __invoke(): JsonResponse
    {
        $healthy = true;

        // 1. Check PostgreSQL connection
        try {
            $driver = DB::connection()->getDriverName();
            DB::select('SELECT 1');
            $dbCheck = [
                'status' => 'ok',
                'driver' => $driver,
            ];
        } catch (Throwable $e) {
            $healthy = false;
            $dbCheck = [
                'status' => 'error',
                'driver' => (string) config('database.default'),
                'message' => $e->getMessage(),
            ];
        }

        // 2. Check PostGIS extension
        try {
            /** @var object{version?: string}|null $row */
            $row = DB::selectOne('SELECT PostGIS_Lib_Version() AS version');
            $version = isset($row->version) ? (string) $row->version : null;
            if ($version === null || $version === '') {
                $healthy = false;
                $postgisCheck = [
                    'status' => 'error',
                    'version' => null,
                    'message' => 'PostGIS version returned empty',
                ];
            } else {
                $postgisCheck = [
                    'status' => 'ok',
                    'version' => $version,
                ];
            }
        } catch (Throwable $e) {
            $healthy = false;
            $postgisCheck = [
                'status' => 'error',
                'version' => null,
                'message' => $e->getMessage(),
            ];
        }

        // 3. Check Redis connectivity
        try {
            $rawPing = Redis::connection()->command('ping');
            $pingStr = is_object($rawPing) && method_exists($rawPing, '__toString')
                ? (string) $rawPing
                : (is_string($rawPing) ? $rawPing : ($rawPing === true || $rawPing === 1 ? 'PONG' : 'UNKNOWN'));

            $redisCheck = [
                'status' => 'ok',
                'response' => $pingStr,
            ];
        } catch (Throwable $e) {
            $healthy = false;
            $redisCheck = [
                'status' => 'error',
                'response' => null,
                'message' => $e->getMessage(),
            ];
        }

        // 4. Check Storage disk writability
        try {
            $disk = Storage::disk((string) config('filesystems.default', 'local'));
            $probeFile = '.healthcheck_probe';
            $written = $disk->put($probeFile, (string) now()->timestamp);
            if ($written && $disk->exists($probeFile)) {
                $disk->delete($probeFile);
            }
            $storageOk = (bool) $written;
            if (! $storageOk) {
                $healthy = false;
            }
            $storageCheck = [
                'status' => $storageOk ? 'ok' : 'error',
                'writable' => $storageOk,
            ];
        } catch (Throwable $e) {
            $healthy = false;
            $storageCheck = [
                'status' => 'error',
                'writable' => false,
                'message' => $e->getMessage(),
            ];
        }

        return response()->json([
            'status' => $healthy ? 'ok' : 'degraded',
            'service' => 'jagapadi-v3-api',
            'timezone' => (string) config('app.timezone', 'Asia/Jakarta'),
            'timestamp' => now()->toIso8601String(),
            'checks' => [
                'database' => $dbCheck,
                'postgis' => $postgisCheck,
                'redis' => $redisCheck,
                'storage' => $storageCheck,
            ],
        ], $healthy ? 200 : 503);
    }
}
