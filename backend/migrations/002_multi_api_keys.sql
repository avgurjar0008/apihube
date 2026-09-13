-- ==========================================================
-- APIHub Migration: 002_multi_api_keys.sql
-- Adds API-specific key scoping & category tracking
-- ==========================================================

ALTER TABLE api_keys 
  ADD COLUMN IF NOT EXISTS api_slug TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS api_name TEXT NOT NULL DEFAULT 'All APIs',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';

CREATE INDEX IF NOT EXISTS api_keys_slug_idx ON api_keys(api_slug);
CREATE INDEX IF NOT EXISTS api_keys_user_slug_idx ON api_keys(user_id, api_slug);

