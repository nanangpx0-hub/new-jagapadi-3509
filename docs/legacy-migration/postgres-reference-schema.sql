-- Manual, reviewed installation only. Not mounted into docker-entrypoint-initdb.d.
-- Run on PostgreSQL 16 after backup and confirmation of the database target.
-- Legacy tables have not been identified; this is a proposed reference schema.
BEGIN;
CREATE SCHEMA legacy_stage;
CREATE SCHEMA reference;

CREATE TABLE legacy_stage.import_batches (
    id uuid PRIMARY KEY,
    source_label text NOT NULL,
    dump_sha256 text NOT NULL CHECK (dump_sha256 ~ '^[0-9a-fA-F]{64}$'),
    mapping_version text NOT NULL,
    source_timezone text,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

-- Decode source text strictly to UTF-8 before inserting JSON. Preserve original
-- dump bytes separately; invalid byte sequences/NUL cannot be stored here.
CREATE TABLE legacy_stage.raw_records (
    batch_id uuid NOT NULL REFERENCES legacy_stage.import_batches(id),
    entity text NOT NULL CHECK (entity IN ('ksa', 'opt', 'opt_crop', 'climate', 'price', 'dictionary')),
    source_id text NOT NULL,
    source_payload jsonb NOT NULL,
    PRIMARY KEY (batch_id, entity, source_id)
);
CREATE TABLE legacy_stage.rejects (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id uuid NOT NULL REFERENCES legacy_stage.import_batches(id),
    entity text NOT NULL,
    source_id text,
    field_name text,
    raw_value text,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reference.crops (
    code text PRIMARY KEY,
    name text NOT NULL
);
-- Canonical migration codes, NOT BPS/legacy code assumptions.
INSERT INTO reference.crops (code, name) VALUES ('padi', 'Padi'), ('jagung', 'Jagung');
-- Add other verified crops for OPT associations rather than discarding them.

CREATE TABLE reference.ksa_observations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_system text NOT NULL,
    source_id text NOT NULL,
    batch_id uuid NOT NULL REFERENCES legacy_stage.import_batches(id),
    period_start date NOT NULL,
    crop_code text NOT NULL REFERENCES reference.crops(code),
    region_code text,
    region_code_system text,
    segment_code text,
    subsegment_code text,
    metric_code text NOT NULL,
    observed_value numeric(24,8),
    unit text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    CHECK (period_start >= DATE '2018-01-01' AND period_start < DATE '2027-01-01'),
    CHECK (EXTRACT(DAY FROM period_start) = 1),
    CHECK (crop_code IN ('padi', 'jagung')),
    CHECK (observed_value IS NULL OR observed_value NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
    UNIQUE (source_system, source_id, metric_code)
);
CREATE INDEX ksa_period_crop_idx ON reference.ksa_observations(period_start, crop_code);

CREATE TABLE reference.opt_master (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_system text NOT NULL,
    source_id text NOT NULL,
    batch_id uuid NOT NULL REFERENCES legacy_stage.import_batches(id),
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    latin_name text,
    symptoms text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (source_system, source_id)
);
CREATE TABLE reference.opt_target_crops (
    opt_id bigint NOT NULL REFERENCES reference.opt_master(id),
    crop_code text NOT NULL REFERENCES reference.crops(code),
    PRIMARY KEY (opt_id, crop_code)
);

CREATE TABLE reference.climate_observations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_system text NOT NULL,
    source_id text NOT NULL,
    batch_id uuid NOT NULL REFERENCES legacy_stage.import_batches(id),
    station_code text,
    region_code text,
    region_code_system text,
    observation_date date,
    observed_at timestamptz,
    metric_code text NOT NULL,
    value numeric(24,8),
    unit text NOT NULL,
    quality_flag text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    CHECK (num_nonnulls(observation_date, observed_at) = 1),
    CHECK (observation_date IS NULL OR isfinite(observation_date)),
    CHECK (observed_at IS NULL OR isfinite(observed_at)),
    CHECK (value IS NULL OR value NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
    UNIQUE (source_system, source_id, metric_code)
);
CREATE INDEX climate_date_idx ON reference.climate_observations(observation_date);
CREATE INDEX climate_timestamp_idx ON reference.climate_observations(observed_at);

CREATE TABLE reference.commodity_prices (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_system text NOT NULL,
    source_id text NOT NULL,
    batch_id uuid NOT NULL REFERENCES legacy_stage.import_batches(id),
    price_date date NOT NULL CHECK (isfinite(price_date)),
    commodity_code text NOT NULL,
    market_code text,
    grade text,
    price numeric(24,8) NOT NULL CHECK (price >= 0 AND price NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
    currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
    unit text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (source_system, source_id)
);
CREATE INDEX commodity_prices_series_idx ON reference.commodity_prices(commodity_code, market_code, price_date);
COMMIT;

-- No cross-family aggregate is performed here. A KSA phase/category is not an
-- area or production value: use metric_code + metadata with a verified dictionary.
-- A wide legacy price row with several grade columns must be unpivoted with
-- stable source_id suffixes. Never use a generated row number as a durable ID.
-- numeric(24,8) is a proposal; profile source ranges/scale before approval.
-- This schema intentionally does not create spatial geometry for rows lacking
-- verified coordinates/boundaries. PostGIS remains available in the existing stack.
