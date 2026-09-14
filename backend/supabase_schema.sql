-- ==============================================================================
-- APIHub — Complete Supabase Database Schema
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/_
-- 2. Go to "SQL Editor" in the left navigation sidebar.
-- 3. Click "New query", paste the entire contents of this file, and click "Run".
-- 4. All tables, indexes, triggers, and Row Level Security (RLS) policies will be created!
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(LOWER(email));

-- 3. API KEYS TABLE
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS api_keys_created_at_idx ON public.api_keys(created_at DESC);

-- 4. USER APIS TABLE (Custom APIs created by developers)
CREATE TABLE IF NOT EXISTS public.user_apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'REST',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_apis_user_id_idx ON public.user_apis(user_id);
CREATE INDEX IF NOT EXISTS user_apis_name_idx ON public.user_apis(LOWER(name));

-- 5. USER ENDPOINTS TABLE (Endpoints under custom APIs)
CREATE TABLE IF NOT EXISTS public.user_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID NOT NULL REFERENCES public.user_apis(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS user_endpoints_api_id_idx ON public.user_endpoints(api_id);
CREATE INDEX IF NOT EXISTS user_endpoints_method_path_idx ON public.user_endpoints(api_id, method, path);

-- 6. SAVED REQUESTS TABLE (Tester saved requests)
CREATE TABLE IF NOT EXISTS public.saved_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  headers TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  params JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_requests_user_id_idx ON public.saved_requests(user_id);
CREATE INDEX IF NOT EXISTS saved_requests_created_at_idx ON public.saved_requests(created_at DESC);

-- 7. REQUEST HISTORY TABLE (Tester execution log)
CREATE TABLE IF NOT EXISTS public.request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_history_user_id_idx ON public.request_history(user_id);
CREATE INDEX IF NOT EXISTS request_history_created_at_idx ON public.request_history(created_at DESC);

-- 8. GATEWAY USAGE TABLE (API usage analytics and tracking)
CREATE TABLE IF NOT EXISTS public.gateway_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  api_identifier TEXT NOT NULL,
  method TEXT NOT NULL,
  endpoint_path TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gateway_usage_api_key_id_idx ON public.gateway_usage(api_key_id);
CREATE INDEX IF NOT EXISTS gateway_usage_user_id_idx ON public.gateway_usage(user_id);
CREATE INDEX IF NOT EXISTS gateway_usage_created_at_idx ON public.gateway_usage(created_at DESC);

-- 9. AUTOMATIC TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_user_apis_updated_at ON public.user_apis;
CREATE TRIGGER trg_user_apis_updated_at
  BEFORE UPDATE ON public.user_apis
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_user_endpoints_updated_at ON public.user_endpoints;
CREATE TRIGGER trg_user_endpoints_updated_at
  BEFORE UPDATE ON public.user_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_saved_requests_updated_at ON public.saved_requests;
CREATE TRIGGER trg_saved_requests_updated_at
  BEFORE UPDATE ON public.saved_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- NOTE: The APIHub Node.js backend connects using DATABASE_URL (postgres superuser role),
-- which automatically bypasses RLS. Enabling RLS here ensures the database is secure
-- if you ever enable direct Supabase client access (anon/authenticated keys).

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_apis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_usage ENABLE ROW LEVEL SECURITY;

-- Allow full access to service_role / postgres backend
DROP POLICY IF EXISTS "service_role_all_users" ON public.users;
CREATE POLICY "service_role_all_users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_api_keys" ON public.api_keys;
CREATE POLICY "service_role_all_api_keys" ON public.api_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_user_apis" ON public.user_apis;
CREATE POLICY "service_role_all_user_apis" ON public.user_apis FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_user_endpoints" ON public.user_endpoints;
CREATE POLICY "service_role_all_user_endpoints" ON public.user_endpoints FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_saved_requests" ON public.saved_requests;
CREATE POLICY "service_role_all_saved_requests" ON public.saved_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_request_history" ON public.request_history;
CREATE POLICY "service_role_all_request_history" ON public.request_history FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_gateway_usage" ON public.gateway_usage;
CREATE POLICY "service_role_all_gateway_usage" ON public.gateway_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 11. REVIEWS TABLE (Public user reviews & ratings)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT NOT NULL,
  feature TEXT NOT NULL DEFAULT 'Overall APIHub',
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON public.reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS reviews_rating_idx ON public.reviews(rating DESC);
CREATE INDEX IF NOT EXISTS reviews_status_idx ON public.reviews(status);

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_reviews" ON public.reviews;
CREATE POLICY "service_role_all_reviews" ON public.reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_approved_reviews" ON public.reviews;
CREATE POLICY "public_read_approved_reviews" ON public.reviews FOR SELECT USING (status = 'approved');

-- Done! Verification query:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

