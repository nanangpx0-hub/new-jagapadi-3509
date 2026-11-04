-- Jember GIS: explicit opt-in SQL installation; this file is NOT executed automatically.
-- Requires PostgreSQL with PostGIS installed by an administrator.
-- Run against the intended database only. Existing incompatible tables cause failure.
BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE districts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    regency_bps_code text NOT NULL DEFAULT '3509' CHECK (regency_bps_code = '3509'),
    name text NOT NULL,
    geom geometry(MultiPolygon,4326),
    centroid geometry(Point,4326),
    source text NOT NULL,
    source_feature_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (geom IS NULL OR (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))),
    CHECK (centroid IS NULL OR (NOT ST_IsEmpty(centroid) AND ST_X(centroid) BETWEEN -180 AND 180 AND ST_Y(centroid) BETWEEN -90 AND 90))
);
CREATE INDEX districts_geom_gist ON districts USING gist (geom);

CREATE TABLE villages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    district_id bigint NOT NULL REFERENCES districts(id),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    geom geometry(MultiPolygon,4326),
    centroid geometry(Point,4326),
    fallback_radius_m double precision,
    source text NOT NULL,
    source_feature_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (geom IS NULL OR (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))),
    CHECK (centroid IS NULL OR (NOT ST_IsEmpty(centroid) AND ST_X(centroid) BETWEEN -180 AND 180 AND ST_Y(centroid) BETWEEN -90 AND 90)),
    CHECK (fallback_radius_m IS NULL OR (fallback_radius_m > 0 AND fallback_radius_m <= 10000))
);
CREATE INDEX villages_district_id_idx ON villages (district_id);
CREATE INDEX villages_geom_gist ON villages USING gist (geom);
CREATE INDEX villages_centroid_gist ON villages USING gist (centroid);

-- NULL means unknown/unconfigured: never substitute an invented centroid/radius.
-- Dynamic tolerance = surveyed/configured radius + bounded device uncertainty,
-- subject to a caller-configurable hard cap. All distances are metres.
-- A fallback result is proximity evidence, NOT administrative membership proof.
CREATE OR REPLACE FUNCTION validate_village_report(
    p_village_code text,
    p_lon double precision,
    p_lat double precision,
    p_accuracy_m double precision DEFAULT 0,
    p_max_tolerance_m double precision DEFAULT 3000
)
RETURNS TABLE (
    accepted boolean,
    method text,
    distance_m double precision,
    tolerance_m double precision,
    reason text
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v villages%ROWTYPE;
    pt geometry(Point,4326);
    d double precision;
    tolerance double precision;
BEGIN
    IF p_lon IS NULL OR p_lat IS NULL
       OR NOT (p_lon BETWEEN -180 AND 180)
       OR NOT (p_lat BETWEEN -90 AND 90) THEN
        RETURN QUERY SELECT false, 'invalid_input'::text, NULL::double precision, NULL::double precision, 'Longitude/latitude invalid'::text;
        RETURN;
    END IF;
    IF p_accuracy_m IS NULL OR NOT (p_accuracy_m BETWEEN 0 AND 1000)
       OR p_max_tolerance_m IS NULL OR NOT (p_max_tolerance_m > 0 AND p_max_tolerance_m <= 10000) THEN
        RETURN QUERY SELECT false, 'invalid_input'::text, NULL::double precision, NULL::double precision, 'Accuracy/cap outside allowed range'::text;
        RETURN;
    END IF;
    SELECT * INTO v FROM villages WHERE code = p_village_code;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'not_found'::text, NULL::double precision, NULL::double precision, 'Village code not found'::text;
        RETURN;
    END IF;
    pt := ST_SetSRID(ST_Point(p_lon, p_lat), 4326);
    IF v.geom IS NOT NULL AND NOT ST_IsEmpty(v.geom) THEN
        IF NOT ST_IsValid(v.geom) THEN
            RETURN QUERY SELECT false, 'invalid_geometry'::text, NULL::double precision, NULL::double precision, 'Polygon must be repaired before validation'::text;
        ELSE
            RETURN QUERY SELECT ST_Contains(v.geom, pt), 'polygon'::text, NULL::double precision, NULL::double precision,
                CASE WHEN ST_Contains(v.geom, pt) THEN 'Inside polygon'
                     WHEN ST_Covers(v.geom, pt) THEN 'On boundary: manual review; ST_Contains excludes boundary'
                     ELSE 'Outside polygon; centroid fallback deliberately disabled' END;
        END IF;
        RETURN;
    END IF;
    IF v.centroid IS NULL OR ST_IsEmpty(v.centroid) OR v.fallback_radius_m IS NULL THEN
        RETURN QUERY SELECT false, 'missing_reference'::text, NULL::double precision, NULL::double precision, 'Missing polygon and trusted centroid/radius'::text;
        RETURN;
    END IF;
    tolerance := LEAST(p_max_tolerance_m, v.fallback_radius_m + p_accuracy_m);
    d := ST_DistanceSphere(v.centroid, pt);
    RETURN QUERY SELECT d <= tolerance, 'centroid_proximity'::text, d, tolerance,
        CASE WHEN d <= tolerance THEN 'Provisional proximity match; not proof of village membership'
             ELSE 'Outside centroid tolerance' END;
END;
$$;
COMMIT;

-- Example (replace the code with an actual imported village code):
-- SELECT * FROM validate_village_report('actual-village-code', 113.70, -8.17, 20, 3000);
-- Never pass (latitude, longitude) to ST_Point.
