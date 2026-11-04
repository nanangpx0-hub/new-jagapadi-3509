-- Run ONLY against the restored legacy clone, with the intended database selected.
-- Actual legacy table/column names are not available in this workspace.
-- Discovery SELECTs below are executable; extraction templates remain commented.
-- Never pipe a MySQL SQL dump directly into PostgreSQL.

SELECT DATABASE() AS selected_schema, VERSION() AS mysql_version,
       @@character_set_server AS server_charset, @@collation_server AS server_collation,
       @@session.time_zone AS session_time_zone, @@sql_mode AS sql_mode;

SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
-- TABLE_ROWS may be approximate; use COUNT(*) on each selected source for reconciliation.

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE,
       CHARACTER_SET_NAME, COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (LOWER(TABLE_NAME) REGEXP 'ksa|opt|hama|iklim|cuaca|harga|komoditas'
       OR LOWER(COLUMN_NAME) REGEXP 'latin|gejala|curah|kelembap|harga|komoditas|segmen|subsegmen')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, ORDINAL_POSITION;

/*
EXTRACTION TEMPLATES: replace EVERY __...__ using verified schema/joins.
These are contracts, not claims that any particular table exists.
Prefer raw stable IDs and explicit reference dictionaries over name-only joins.
Do not use SELECT DISTINCT to hide legitimate repeated observations.
Do not aggregate KSA segment/subsegment records without a documented method.

-- KSA with real DATE/DATETIME period column. DATE_FORMAT projects monthly period
-- without aggregating or deduplicating source observations.
SELECT
    CAST(k.__PRIMARY_KEY__ AS CHAR) AS source_id,
    DATE_FORMAT(k.__PERIOD_DATE__, '%Y-%m-01') AS period_start,
    CAST(k.__CROP_CODE__ AS CHAR) AS crop_code_raw,
    CAST(k.__REGION_CODE__ AS CHAR) AS region_code_raw,
    CAST(k.__SEGMENT_CODE__ AS CHAR) AS segment_code_raw,
    CAST(k.__SUBSEGMENT_CODE__ AS CHAR) AS subsegment_code_raw,
    CAST(k.__OBSERVED_VALUE__ AS CHAR) AS observed_value_raw,
    CAST(k.__UNIT__ AS CHAR) AS unit_raw
FROM __KSA_TABLE__ k
WHERE k.__PERIOD_DATE__ >= '2018-01-01'
  AND k.__PERIOD_DATE__ < '2027-01-01'
  AND k.__CROP_CODE__ IN (__VERIFIED_PADDY_CODE__, __VERIFIED_MAIZE_CODE__)
ORDER BY k.__PRIMARY_KEY__;

-- Alternative predicate if legacy stores separate numeric year/month columns:
-- WHERE k.__YEAR__ BETWEEN 2018 AND 2026
--   AND k.__MONTH__ BETWEEN 1 AND 12
--   AND k.__CROP_CODE__ IN (...verified codes...)
-- Do not apply DATE_FORMAT to an unknown free-text period format.
-- If crop/region/unit names live in masters, add verified FK joins. Preserve
-- unmatched codes in an exception report rather than dropping rows with INNER JOIN.

-- OPT: verify whether the pest-to-crop relation is one-to-many/many-to-many.
-- For many-to-many targets, export the association separately, not GROUP_CONCAT.
SELECT CAST(o.__PRIMARY_KEY__ AS CHAR) AS source_id,
       o.__PEST_NAME__ AS pest_name_raw,
       o.__LATIN_NAME__ AS latin_name_raw,
       o.__SYMPTOMS__ AS symptoms_raw
FROM __OPT_MASTER_TABLE__ o
ORDER BY o.__PRIMARY_KEY__;

SELECT CAST(x.__OPT_FK__ AS CHAR) AS opt_source_id,
       CAST(x.__CROP_FK__ AS CHAR) AS crop_code_raw
FROM __OPT_CROP_ASSOCIATION_TABLE__ x
ORDER BY x.__OPT_FK__, x.__CROP_FK__;
-- If target crop is stored directly on OPT, project it into the same association contract.

-- Climate: export original observation grain and timezone/unit definitions.
SELECT CAST(c.__PRIMARY_KEY__ AS CHAR) AS source_id,
       CAST(c.__OBSERVED_DATE_OR_TIMESTAMP__ AS CHAR) AS observed_at_raw,
       CAST(c.__STATION_FK__ AS CHAR) AS station_code_raw,
       CAST(c.__REGION_CODE__ AS CHAR) AS region_code_raw,
       CAST(c.__METRIC_CODE__ AS CHAR) AS metric_code_raw,
       CAST(c.__MEASURED_VALUE__ AS CHAR) AS value_raw,
       CAST(c.__UNIT_CODE__ AS CHAR) AS unit_raw
FROM __CLIMATE_TABLE__ c
ORDER BY c.__PRIMARY_KEY__;
-- For wide tables (rainfall, temperature, humidity in separate columns),
-- export each measurement as an independent row using UNION ALL and a metric code,
-- preserving NULL versus zero and a source ID + metric discriminator.

-- Prices: market, grade and unit distinguish different price series.
SELECT CAST(p.__PRIMARY_KEY__ AS CHAR) AS source_id,
       CAST(p.__PRICE_DATE__ AS CHAR) AS price_date_raw,
       CAST(p.__COMMODITY_FK__ AS CHAR) AS commodity_code_raw,
       CAST(p.__MARKET_FK__ AS CHAR) AS market_code_raw,
       CAST(p.__GRADE_FK__ AS CHAR) AS grade_raw,
       CAST(p.__PRICE__ AS CHAR) AS price_raw,
       CAST(p.__CURRENCY__ AS CHAR) AS currency_raw,
       CAST(p.__UNIT__ AS CHAR) AS unit_raw
FROM __PRICE_TABLE__ p
ORDER BY p.__PRIMARY_KEY__;
-- User specified 2018-2026 for KSA only. Do not silently discard older/newer
-- climate or price history. Define any further time/region scope explicitly.
*/
