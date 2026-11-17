<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PestClusterController extends Controller
{
    /**
     * Deteksi kluster serangan hama (GeoJSON FeatureCollection).
     *
     * Mengelompokkan laporan hama berstatus Submitted/Diverifikasi dengan
     * intensitas Sedang/Berat/Puso yang berdekatan (DBSCAN eps 0.02° ≈ 2 km,
     * minpoints 2) dalam rentang hari terakhir, lalu mengembalikan poligon
     * buffer 2.000 m di sekitar centroid tiap kluster untuk Leaflet.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'opt_id' => ['sometimes', 'nullable', 'exists:opts,id'],
        ]);

        $days = (int) ($validated['days'] ?? 7);
        $optId = isset($validated['opt_id']) ? (int) $validated['opt_id'] : null;
        $userId = $user->hasRole('petugas') ? $user->id : null;

        $rows = DB::select(<<<'SQL'
            WITH clustered AS (
                SELECT
                    r.id,
                    r.geom,
                    r.user_id,
                    pd.opt_id,
                    pd.affected_area_ha,
                    ST_ClusterDBSCAN(r.geom, 0.02, 2) OVER () AS cluster_id
                FROM reports r
                JOIN report_pest_details pd ON pd.report_id = r.id
                WHERE r.report_type = 'pest'
                  AND r.status IN ('Submitted', 'Diverifikasi')
                  AND pd.intensity_level IN ('Sedang', 'Berat', 'Puso')
                  AND r.geom IS NOT NULL
                  AND r.deleted_at IS NULL
                  AND r.report_date >= (CURRENT_DATE - (? || ' days')::interval)::date
                  AND (?::bigint IS NULL OR pd.opt_id = ?)
                  AND (?::bigint IS NULL OR r.user_id = ?)
            ),
            grouped AS (
                SELECT
                    cluster_id,
                    opt_id,
                    COUNT(*)::int AS point_count,
                    COALESCE(SUM(affected_area_ha), 0)::float AS total_affected_ha,
                    ST_Centroid(ST_Collect(geom)) AS centroid
                FROM clustered
                WHERE cluster_id IS NOT NULL
                GROUP BY cluster_id, opt_id
            )
            SELECT
                g.cluster_id::text AS cluster_id,
                g.opt_id,
                o.name AS opt_name,
                g.point_count,
                g.total_affected_ha,
                ST_X(g.centroid) AS lng,
                ST_Y(g.centroid) AS lat,
                ST_AsGeoJSON(
                    ST_Buffer(g.centroid::geography, 2000)::geometry, 6
                ) AS buffer_geojson
            FROM grouped g
            JOIN opts o ON o.id = g.opt_id
            ORDER BY g.point_count DESC, g.total_affected_ha DESC
        SQL, [$days, $optId, $optId, $userId, $userId]);

        $features = [];
        $totalPoints = 0;
        foreach ($rows as $row) {
            $buffer = json_decode((string) $row->buffer_geojson, true);
            $pointCount = (int) $row->point_count;
            $features[] = [
                'type' => 'Feature',
                'properties' => [
                    'cluster_id' => $row->cluster_id,
                    'opt_id' => (int) $row->opt_id,
                    'opt_name' => $row->opt_name,
                    'point_count' => $pointCount,
                    'total_affected_ha' => round((float) $row->total_affected_ha, 2),
                    'centroid' => [
                        'latitude' => (float) $row->lat,
                        'longitude' => (float) $row->lng,
                    ],
                    'buffer_radius_m' => 2000,
                    'days' => $days,
                ],
                'geometry' => is_array($buffer) ? $buffer : null,
            ];
            $totalPoints += $pointCount;
        }

        return response()->json([
            'type' => 'FeatureCollection',
            'features' => $features,
            'meta' => [
                'days' => $days,
                'opt_id' => $optId,
                'cluster_count' => count($features),
                'total_points' => $totalPoints,
                'buffer_radius_m' => 2000,
                'eps_degrees' => 0.02,
            ],
        ]);
    }
}
