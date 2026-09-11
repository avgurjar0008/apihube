CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys(key_hash);
CREATE TABLE IF NOT EXISTS user_apis (
  id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', base_url TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'REST', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_apis_user_id_idx ON user_apis(user_id);
CREATE TABLE IF NOT EXISTS user_endpoints (
  id UUID PRIMARY KEY, api_id UUID NOT NULL REFERENCES user_apis(id) ON DELETE CASCADE,
  method TEXT NOT NULL, path TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', parameters TEXT NOT NULL DEFAULT '', request_body TEXT NOT NULL DEFAULT '', response_example TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_endpoints_api_id_idx ON user_endpoints(api_id);
CREATE TABLE IF NOT EXISTS saved_requests (
  id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL, url TEXT NOT NULL, headers TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', params JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_requests_user_id_idx ON saved_requests(user_id);
CREATE TABLE IF NOT EXISTS request_history (
  id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL, url TEXT NOT NULL, status INTEGER, response_time_ms INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_history_user_id_idx ON request_history(user_id);
