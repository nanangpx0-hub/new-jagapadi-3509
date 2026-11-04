<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Explicit invocation only: php artisan db:seed --class=JemberBoundarySeeder
 * Requires database/jember_gis.sql and a PostgreSQL connection with PostGIS.
 * Input: storage/app/gis/jember/{districts,villages}.geojson.
 * Properties must first be normalized using a verified administrative crosswalk.
 * Never infer a BPS code or a village parent from its name or OSM relation ID.
 */
class JemberBoundarySeeder extends Seeder
{
    public function run(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            throw new RuntimeException('PostgreSQL/PostGIS required; database configuration was not changed.');
        }

        $districts = $this->load('districts');
        $villages = $this->load('villages');
        $districtCodes = [];
        foreach ($districts as $feature) {
            $p = $this->properties($feature);
            $districtCodes[$p['code']] = true;
        }
        foreach ($villages as $feature) {
            $p = $this->properties($feature);
            if (! is_string($p['district_code'] ?? null) || ! isset($districtCodes[$p['district_code']])) {
                throw new RuntimeException('Village parent must reference a district in the same input dataset.');
            }
        }

        DB::transaction(function () use ($districts, $villages): void {
            foreach ($districts as $feature) {
                $p = $this->properties($feature);
                [$geom, $centroid] = $this->geometry($feature);
                $this->checkExistingSource('districts', $p);
                DB::statement(
                    'INSERT INTO districts (code, regency_bps_code, name, geom, centroid, source, source_feature_id)
                     VALUES (?, ?, ?, ST_GeomFromEWKT(?), ST_GeomFromEWKT(?), ?, ?)
                     ON CONFLICT (code) DO UPDATE SET
                         name = EXCLUDED.name, geom = EXCLUDED.geom, centroid = EXCLUDED.centroid,
                         source = EXCLUDED.source, source_feature_id = EXCLUDED.source_feature_id, updated_at = now()',
                    [$p['code'], '3509', $p['name'], $geom, $centroid, $p['source'], $p['source_feature_id'] ?? null]
                );
            }
            foreach ($villages as $feature) {
                $p = $this->properties($feature);
                [$geom, $centroid] = $this->geometry($feature);
                $district = DB::table('districts')->where('code', $p['district_code'])->first();
                if (! $district || $district->regency_bps_code !== '3509') {
                    throw new RuntimeException('District is not registered in Jember.');
                }
                $radius = $p['fallback_radius_m'] ?? null;
                if ($radius !== null && (! is_numeric($radius) || ! is_finite((float) $radius) || $radius <= 0 || $radius > 10000)) {
                    throw new RuntimeException('fallback_radius_m must be a documented value in (0, 10000] metres.');
                }
                $this->checkExistingSource('villages', $p);
                DB::statement(
                    'INSERT INTO villages (district_id, code, name, geom, centroid, fallback_radius_m, source, source_feature_id)
                     VALUES (?, ?, ?, ST_GeomFromEWKT(?), ST_GeomFromEWKT(?), ?, ?, ?)
                     ON CONFLICT (code) DO UPDATE SET
                         district_id = EXCLUDED.district_id, name = EXCLUDED.name,
                         geom = EXCLUDED.geom, centroid = EXCLUDED.centroid,
                         fallback_radius_m = EXCLUDED.fallback_radius_m,
                         source = EXCLUDED.source, source_feature_id = EXCLUDED.source_feature_id, updated_at = now()',
                    [$district->id, $p['code'], $p['name'], $geom, $centroid, $radius, $p['source'], $p['source_feature_id'] ?? null]
                );
            }
        });

        $this->command?->info('Imported '.count($districts).' districts and '.count($villages).' villages in one transaction.');
        $this->command?->warn('Compare counts with a dated official register. Requested 31/248 are targets, not verified evidence of completeness. No absent rows were deleted.');
    }

    private function load(string $name): array
    {
        $path = storage_path("app/gis/jember/{$name}.geojson");
        if (! is_file($path) || ! is_readable($path)) {
            throw new RuntimeException("Missing readable GeoJSON: {$path}");
        }
        $data = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (($data['type'] ?? null) !== 'FeatureCollection' || ! is_array($data['features'] ?? null) || ! array_is_list($data['features']) || $data['features'] === []) {
            throw new RuntimeException("{$name}: expected a nonempty FeatureCollection.");
        }
        if (isset($data['crs'])) {
            throw new RuntimeException('Reproject to WGS84 longitude/latitude and remove legacy crs metadata before import.');
        }
        $seen = [];
        foreach ($data['features'] as $feature) {
            if (! is_array($feature)) {
                throw new RuntimeException('Each feature must be an object.');
            }
            $p = $this->properties($feature);
            if (isset($seen[$p['code']])) {
                throw new RuntimeException("Duplicate code in {$name}: {$p['code']}");
            }
            $seen[$p['code']] = true;
        }

        return $data['features'];
    }

    private function properties(array $feature): array
    {
        if (($feature['type'] ?? null) !== 'Feature' || ! is_array($feature['properties'] ?? null)) {
            throw new RuntimeException('Invalid GeoJSON Feature.');
        }
        $p = $feature['properties'];
        foreach (['code', 'name', 'source', 'code_system'] as $key) {
            if (! is_string($p[$key] ?? null) || trim($p[$key]) === '') {
                throw new RuntimeException("Required nonempty string property: {$key}");
            }
        }
        if ($p['code_system'] !== 'BPS' || ($p['regency_bps_code'] ?? null) !== '3509') {
            throw new RuntimeException('Use an explicit verified BPS crosswalk and regency_bps_code="3509".');
        }
        if (isset($p['source_feature_id']) && ! is_string($p['source_feature_id'])) {
            throw new RuntimeException('source_feature_id must be a string.');
        }

        return $p;
    }

    private function geometry(array $feature): array
    {
        $geometry = $feature['geometry'] ?? null;
        $geom = null;
        $centroid = null;
        if ($geometry !== null) {
            if (! is_array($geometry) || ! in_array($geometry['type'] ?? '', ['Polygon', 'MultiPolygon'], true)) {
                throw new RuntimeException('Only Polygon/MultiPolygon or null geometries are supported.');
            }
            $row = DB::selectOne(
                'WITH input AS (SELECT ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(?),4326)) AS g)
                 SELECT ST_AsEWKT(ST_Multi(g)) AS geom,
                        ST_AsEWKT(ST_Centroid(g)) AS centroid,
                        CASE WHEN ST_IsValid(g) AND NOT ST_IsEmpty(g)
                             AND ST_CoveredBy(g, ST_MakeEnvelope(-180,-90,180,90,4326))
                             THEN 1 ELSE 0 END AS usable
                 FROM input',
                [json_encode($geometry, JSON_THROW_ON_ERROR)]
            );
            if ((int) $row->usable !== 1) {
                throw new RuntimeException('Invalid, empty, or out-of-range polygon; repair/review upstream. No silent ST_MakeValid.');
            }
            $geom = $row->geom;
            $centroid = $row->centroid;
        } elseif (isset($feature['properties']['centroid'])) {
            $point = $feature['properties']['centroid'];
            if (! is_array($point) || ! array_is_list($point) || count($point) !== 2 || ! is_numeric($point[0]) || ! is_numeric($point[1])) {
                throw new RuntimeException('Fallback centroid must be [longitude, latitude].');
            }
            [$lon, $lat] = array_map('floatval', $point);
            if (! is_finite($lon) || ! is_finite($lat) || $lon < -180 || $lon > 180 || $lat < -90 || $lat > 90) {
                throw new RuntimeException('Invalid fallback centroid coordinates.');
            }
            $centroid = DB::selectOne('SELECT ST_AsEWKT(ST_SetSRID(ST_Point(?, ?),4326)) AS value', [$lon, $lat])->value;
        }

        return [$geom, $centroid];
    }

    private function checkExistingSource(string $table, array $p): void
    {
        $existing = DB::table($table)->where('code', $p['code'])->first();
        if ($existing && $existing->source !== $p['source']) {
            throw new RuntimeException('Source replacement requires explicit review; refusing to overwrite '.$table.' code '.$p['code']);
        }
    }
}
