-- Migration: add_fulltext_search_index
-- Purpose: Enable PostgreSQL full-text search with tsvector/tsquery
--          for faster keyword search on inspections.
--
-- This migration adds:
-- 1. unaccent extension (for accent-insensitive search)
-- 2. Combined GIN index on to_tsvector for multiple searchable fields
--
-- The tsvector index covers: vehiclePlateNumber, vehicleData.merekKendaraan,
-- vehicleData.tipeKendaraan, identityDetails.namaCustomer, identityDetails.namaInspektor
--
-- Note: pretty_id uses existing trigram index (pg_trgm) which is more suitable
-- for short codes/IDs like "YOG-13082025-001".

-- 1. Enable unaccent extension for accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Create combined tsvector GIN index for full-text search
-- This index enables O(log n) search instead of O(n) sequential scan
CREATE INDEX IF NOT EXISTS "inspections_search_gin_idx"
  ON "inspections" USING GIN (
    to_tsvector('english',
      COALESCE("vehiclePlateNumber", '') || ' ' ||
      COALESCE("vehicleData"->>'merekKendaraan', '') || ' ' ||
      COALESCE("vehicleData"->>'tipeKendaraan', '') || ' ' ||
      COALESCE("identityDetails"->>'namaCustomer', '') || ' ' ||
      COALESCE("identityDetails"->>'namaInspektor', '')
    )
  );
