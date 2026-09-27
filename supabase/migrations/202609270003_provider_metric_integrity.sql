BEGIN;
ALTER TABLE public.provider_metric_snapshots DROP CONSTRAINT IF EXISTS provider_metric_unique;
ALTER TABLE public.provider_metric_snapshots ADD CONSTRAINT provider_metric_unique
  UNIQUE (provider, scope_id, metric_key, environment);

-- Both writes and the ownership check occur under the same row lock. An expired
-- worker can never overwrite a newer holder, even after slow provider requests.
CREATE OR REPLACE FUNCTION public.persist_provider_metric_snapshots(p_lease_token uuid, p_snapshots jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_state public.provider_sync_state%ROWTYPE;
BEGIN
  SELECT * INTO v_state FROM public.provider_sync_state
    WHERE provider = 'global' AND scope_id = 'admin_sync' FOR UPDATE;
  IF NOT FOUND OR v_state.lease_token IS DISTINCT FROM p_lease_token
      OR v_state.lease_until IS NULL OR v_state.lease_until <= clock_timestamp() THEN
    RETURN false;
  END IF;
  IF jsonb_typeof(p_snapshots) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'snapshots must be an array';
  END IF;
  INSERT INTO public.provider_metric_snapshots (
    provider, scope_type, scope_id, metric_key, display_name, environment,
    value, unit, limit_value, remaining_value, period_start, period_end, period_timezone,
    provider_updated_at, fetched_at, source_kind, source_url, endpoint, field_path,
    status, last_attempt_at, error_code, mapping_version, source_checked_at
  ) SELECT
    s.provider, s.scope_type, s.scope_id, s.metric_key, s.display_name, s.environment,
    s.value, s.unit, s.limit_value, s.remaining_value, s.period_start, s.period_end, s.period_timezone,
    s.provider_updated_at, s.fetched_at, s.source_kind, s.source_url, s.endpoint, s.field_path,
    s.status, s.last_attempt_at, s.error_code, s.mapping_version, s.source_checked_at
  FROM jsonb_populate_recordset(NULL::public.provider_metric_snapshots, p_snapshots) AS s
  ON CONFLICT (provider, scope_id, metric_key, environment) DO UPDATE SET
    scope_type = EXCLUDED.scope_type, display_name = EXCLUDED.display_name,
    value = EXCLUDED.value, unit = EXCLUDED.unit, limit_value = EXCLUDED.limit_value,
    remaining_value = EXCLUDED.remaining_value, period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end, period_timezone = EXCLUDED.period_timezone,
    provider_updated_at = EXCLUDED.provider_updated_at, fetched_at = EXCLUDED.fetched_at,
    source_kind = EXCLUDED.source_kind, source_url = EXCLUDED.source_url,
    endpoint = EXCLUDED.endpoint, field_path = EXCLUDED.field_path, status = EXCLUDED.status,
    last_attempt_at = EXCLUDED.last_attempt_at, error_code = EXCLUDED.error_code,
    mapping_version = EXCLUDED.mapping_version, source_checked_at = EXCLUDED.source_checked_at,
    raw_payload = NULL, updated_at = clock_timestamp();
  RETURN true;
END;
$$;

-- A crash/release failure must also throttle retries, not just a successful sync.
CREATE OR REPLACE FUNCTION public.acquire_provider_sync_lease(p_provider text, p_scope_id text, p_ttl_seconds int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_now timestamptz; v_token uuid := gen_random_uuid(); v_row public.provider_sync_state%ROWTYPE;
BEGIN
  INSERT INTO public.provider_sync_state(provider,scope_id) VALUES(p_provider,p_scope_id)
    ON CONFLICT(provider,scope_id) DO NOTHING;
  SELECT * INTO v_row FROM public.provider_sync_state
    WHERE provider=p_provider AND scope_id=p_scope_id FOR UPDATE;
  v_now := clock_timestamp();
  IF v_row.lease_until > v_now THEN RETURN jsonb_build_object('acquired',false,'reason','locked'); END IF;
  IF v_row.next_allowed_at > v_now THEN RETURN jsonb_build_object('acquired',false,'reason','cooldown'); END IF;
  UPDATE public.provider_sync_state SET last_attempt_at=v_now,
    lease_until=v_now + make_interval(secs=>GREATEST(1,LEAST(p_ttl_seconds,120))),
    lease_token=v_token, next_allowed_at=v_now + interval '60 seconds', updated_at=v_now
    WHERE provider=p_provider AND scope_id=p_scope_id;
  RETURN jsonb_build_object('acquired',true,'lease_token',v_token);
END;
$$;
CREATE OR REPLACE FUNCTION public.release_provider_sync_lease(p_provider text,p_scope_id text,p_lease_token uuid,
  p_cooldown_seconds int DEFAULT 60,p_error_code text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_updated int;
BEGIN
  UPDATE public.provider_sync_state SET lease_until=NULL,lease_token=NULL,
    next_allowed_at=clock_timestamp()+make_interval(secs=>GREATEST(COALESCE(p_cooldown_seconds,60),60)),
    last_error_code=p_error_code,updated_at=clock_timestamp()
    WHERE provider=p_provider AND scope_id=p_scope_id AND lease_token=p_lease_token;
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  RETURN v_updated>0;
END;
$$;
-- Only the fenced security-definer RPC writes measurements. No service-role fallback.
REVOKE INSERT, UPDATE, DELETE ON public.provider_metric_snapshots FROM service_role;
REVOKE EXECUTE ON FUNCTION public.persist_provider_metric_snapshots(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_provider_metric_snapshots(uuid,jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.acquire_provider_sync_lease(text,text,int) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.release_provider_sync_lease(text,text,uuid,int,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_provider_sync_lease(text,text,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_provider_sync_lease(text,text,uuid,int,text) TO service_role;
COMMIT;
