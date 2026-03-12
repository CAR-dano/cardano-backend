-- Migration: add_session_version_to_users
-- Adds sessionVersion column to users table for JWT rotation and token invalidation mechanism.
-- This allows invalidating all existing tokens when a security event occurs (e.g. password change, forced logout).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;
