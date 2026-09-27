-- Migration: 202609270002_system_admin_core.sql
-- Description: Core schema, sync lease manager, maintenance jobs, and index update for /system-admin.
-- Căn cứ: YEU_CAU_DU_AN.md (v1.2) - Mục 0, 2.1, 5, 7 và 9.

BEGIN;

-- 1. Bảng lưu trữ metric snapshots
CREATE TABLE IF NOT EXISTS public.provider_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('supabase', 'brevo', 'netlify', 'github', 'internal')),
  scope_type text NOT NULL CHECK (scope_type IN ('project', 'organization', 'account', 'team', 'application')),
  scope_id text NOT NULL,
  metric_key text NOT NULL,
  display_name text NOT NULL,
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'local')),
  value numeric,
  unit text NOT NULL CHECK (unit IN ('byte', 'count', 'credit', 'percentage', 'boolean', 'text')),
  limit_value numeric,
  remaining_value numeric,
  period_start timestamptz,
  period_end timestamptz,
  period_timezone text,
  provider_updated_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  source_kind text NOT NULL CHECK (source_kind IN ('api', 'documentation', 'internal', 'dashboard')),
  source_url text,
  endpoint text,
  field_path text,
  status text NOT NULL CHECK (status IN ('fresh', 'stale', 'not_connected', 'forbidden', 'rate_limited', 'unavailable', 'invalid_response', 'dashboard_only', 'not_applicable')),
  last_attempt_at timestamptz,
  error_code text,
  mapping_version text NOT NULL DEFAULT '1.0',
  source_checked_at date NOT NULL DEFAULT '2026-09-24',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_metric_unique UNIQUE (provider, scope_id, metric_key)
);

-- 2. Bảng quản lý lease đồng bộ (single-flight lock)
CREATE TABLE IF NOT EXISTS public.provider_sync_state (
  provider text NOT NULL,
  scope_id text NOT NULL,
  last_attempt_at timestamptz,
  next_allowed_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, scope_id)
);

-- 3. Bảng quản lý công việc bảo trì & dọn dẹp storage
CREATE TABLE IF NOT EXISTS public.maintenance_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('delete_event', 'delete_host', 'cleanup_assets')),
  target_id uuid NOT NULL,
  object_prefixes jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'failed', 'completed')),
  last_error_code text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Bỏ ràng buộc 1 host 1 event để hỗ trợ nhiều sự kiện cho 1 host (Mục 0.2)
DROP INDEX IF EXISTS public.events_one_per_host;

-- 5. Trigger bảo vệ không cho anon hoặc authenticated ghi trực tiếp
CREATE OR REPLACE FUNCTION public.system_admin_table_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'table is not writable by the client' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provider_metric_snapshots_before_write ON public.provider_metric_snapshots;
CREATE TRIGGER provider_metric_snapshots_before_write
  BEFORE INSERT OR UPDATE ON public.provider_metric_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.system_admin_table_before_write();

DROP TRIGGER IF EXISTS provider_sync_state_before_write ON public.provider_sync_state;
CREATE TRIGGER provider_sync_state_before_write
  BEFORE INSERT OR UPDATE ON public.provider_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION public.system_admin_table_before_write();

DROP TRIGGER IF EXISTS maintenance_jobs_before_write ON public.maintenance_jobs;
CREATE TRIGGER maintenance_jobs_before_write
  BEFORE INSERT OR UPDATE ON public.maintenance_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.system_admin_table_before_write();

-- 6. Bật RLS
ALTER TABLE public.provider_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_jobs ENABLE ROW LEVEL SECURITY;

-- Thu hồi quyền từ public/anon/authenticated và chỉ cấp cho service_role
REVOKE ALL ON TABLE public.provider_metric_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.provider_sync_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.maintenance_jobs FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.provider_metric_snapshots TO service_role;
GRANT ALL ON TABLE public.provider_sync_state TO service_role;
GRANT ALL ON TABLE public.maintenance_jobs TO service_role;

-- 7. RPC xin lease đồng bộ (single-flight)
CREATE OR REPLACE FUNCTION public.acquire_provider_sync_lease(
  p_provider text,
  p_scope_id text,
  p_ttl_seconds int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_lease_token uuid := gen_random_uuid();
  v_row public.provider_sync_state%ROWTYPE;
BEGIN
  INSERT INTO public.provider_sync_state (provider, scope_id, last_attempt_at, next_allowed_at, lease_until, lease_token)
  VALUES (p_provider, p_scope_id, NULL, v_now, NULL, NULL)
  ON CONFLICT (provider, scope_id) DO NOTHING;

  SELECT * INTO v_row FROM public.provider_sync_state
  WHERE provider = p_provider AND scope_id = p_scope_id
  FOR UPDATE;

  IF v_row.lease_until IS NOT NULL AND v_row.lease_until > v_now THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'locked', 'lease_until', v_row.lease_until);
  END IF;

  IF v_row.next_allowed_at IS NOT NULL AND v_row.next_allowed_at > v_now THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'cooldown', 'next_allowed_at', v_row.next_allowed_at);
  END IF;

  UPDATE public.provider_sync_state
  SET last_attempt_at = v_now,
      lease_until = v_now + (p_ttl_seconds || ' seconds')::interval,
      lease_token = v_lease_token,
      updated_at = v_now
  WHERE provider = p_provider AND scope_id = p_scope_id;

  RETURN jsonb_build_object('acquired', true, 'lease_token', v_lease_token);
END;
$$;

-- 8. RPC giải phóng lease đồng bộ
CREATE OR REPLACE FUNCTION public.release_provider_sync_lease(
  p_provider text,
  p_scope_id text,
  p_lease_token uuid,
  p_cooldown_seconds int DEFAULT 60,
  p_error_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_updated int;
BEGIN
  UPDATE public.provider_sync_state
  SET lease_until = NULL,
      lease_token = NULL,
      next_allowed_at = v_now + (GREATEST(p_cooldown_seconds, 0) || ' seconds')::interval,
      last_error_code = p_error_code,
      updated_at = v_now
  WHERE provider = p_provider
    AND scope_id = p_scope_id
    AND lease_token = p_lease_token;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acquire_provider_sync_lease FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_provider_sync_lease FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_provider_sync_lease TO service_role;
GRANT EXECUTE ON FUNCTION public.release_provider_sync_lease TO service_role;

COMMIT;
