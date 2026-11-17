<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\Activitylog\Models\Activity;

final class AuditLogController extends Controller
{
    /**
     * Riwayat aktivitas sistem (login, kelola pengguna, siklus laporan).
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(5, (int) $request->query('per_page', 15)));

        $query = Activity::with('causer:id,name,email')->latest('id');

        if ($logName = trim((string) $request->query('log_name', ''))) {
            $query->where('log_name', $logName);
        }
        if ($event = trim((string) $request->query('event', ''))) {
            $query->where('event', $event);
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $driver = DB::connection()->getDriverName();
            $needle = '%'.$search.'%';
            // `ilike` hanya tersedia di PostgreSQL; LIKE bersifat case-insensitive di MySQL.
            $query->where('description', $driver === 'pgsql' ? 'ilike' : 'like', $needle);
        }

        $logs = $query->paginate($perPage);

        return response()->json([
            'status' => 'ok',
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
