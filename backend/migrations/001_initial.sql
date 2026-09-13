-- ==========================================================
-- APIHub Database Schema Migration (001_initial.sql)
-- Designed for PostgreSQL & Supabase
-- ==========================================================

-- Enable pgcrypto for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------
-- 1. Users Table
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(LOWER(email));

-- ----------------------------------------------------------
-- 2. API Keys Table
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS api_keys_created_at_idx ON api_keys(created_at DESC);

-- ----------------------------------------------------------
-- 3. User APIs Table (Custom APIs created by developers)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'REST',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_apis_user_id_idx ON user_apis(user_id);
CREATE INDEX IF NOT EXISTS user_apis_name_idx ON user_apis(LOWER(name));

-- ----------------------------------------------------------
-- 4. User Endpoints Table (Endpoints under custom APIs)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID NOT NULL REFERENCES user_apis(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  parameters TEXT NOT NULL DEFAULT '',
  request_body TEXT NOT NULL DEFAULT '',
  response_example TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_endpoints_api_id_idx ON user_endpoints(api_id);
CREATE INDEX IF NOT EXISTS user_endpoints_method_path_idx ON user_endpoints(api_id, method, path);

-- ----------------------------------------------------------
-- 5. Saved Requests Table (Tester saved requests)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  headers TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  params JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_requests_user_id_idx ON saved_requests(user_id);
CREATE INDEX IF NOT EXISTS saved_requests_created_at_idx ON saved_requests(created_at DESC);

-- ----------------------------------------------------------
-- 6. Request History Table (Tester execution log)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_history_user_id_idx ON request_history(user_id);
CREATE INDEX IF NOT EXISTS request_history_created_at_idx ON request_history(created_at DESC);

-- ----------------------------------------------------------
-- 7. Gateway Usage Table (API analytics and rate limit tracking)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS gateway_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_identifier TEXT NOT NULL,
  method TEXT NOT NULL,
  endpoint_path TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gateway_usage_api_key_id_idx ON gateway_usage(api_key_id);
CREATE INDEX IF NOT EXISTS gateway_usage_user_id_idx ON gateway_usage(user_id);
CREATE INDEX IF NOT EXISTS gateway_usage_created_at_idx ON gateway_usage(created_at DESC);

-- ----------------------------------------------------------
-- 8. Auto-update `updated_at` Trigger Function
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_user_apis_updated_at ON user_apis;
CREATE TRIGGER trg_user_apis_updated_at
  BEFORE UPDATE ON user_apis
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_user_endpoints_updated_at ON user_endpoints;
CREATE TRIGGER trg_user_endpoints_updated_at
  BEFORE UPDATE ON user_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_saved_requests_updated_at ON saved_requests;
CREATE TRIGGER trg_saved_requests_updated_at
  BEFORE UPDATE ON saved_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
