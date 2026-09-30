-- Step 8: host invitation status rollups + scheduled stale-send expiry.
-- Apply only to the pinned project in supabase/test-project.json.
-- Does not modify earlier migrations or existing rows.
--
-- Two changes:
--   1) public.invitations_status_counts(uuid) returns pending/accepted/declined
--      counts for one event in a single GROUP BY scan, replacing the three
--      separate count queries the dashboard issued on every poll.
--   2) public.expire_all_stale_email_sends() fans expire_stale_email_sends(uuid)
--      out across every actor that still has an unresolved send attempt, so the
--      reconciliation no longer needs to run inside the dashboard read path.
--      A pg_cron schedule calls it periodically; see notes at the bottom.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Per-event RSVP status rollup in one scan.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invitations_status_counts(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pending integer := 0;
  v_accepted integer := 0;
  v_declined integer := 0;
BEGIN
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event id is required' USING ERRCODE = '22023';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE i.status = 'pending'),
    COUNT(*) FILTER (WHERE i.status = 'accepted'),
    COUNT(*) FILTER (WHERE i.status = 'declined')
  INTO v_pending, v_accepted, v_declined
  FROM public.invitations AS i
  WHERE i.event_id = p_event_id;

  RETURN jsonb_build_object(
    'pending', COALESCE(v_pending, 0),
    'accepted', COALESCE(v_accepted, 0),
    'declined', COALESCE(v_declined, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invitations_status_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invitations_status_counts(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Cluster-wide stale-send expiry for the scheduled job.
--    expire_stale_email_sends(uuid) is per-actor, so the cron entry calls this
--    fan-out wrapper which iterates every actor holding an open attempt.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_all_stale_email_sends()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_total integer := 0;
BEGIN
  FOR v_actor IN
    SELECT DISTINCT a.actor_id
    FROM public.email_send_attempts AS a
    WHERE a.actor_id IS NOT NULL
      AND a.status IN ('reserved', 'sending')
      AND a.resolved_at IS NULL
      AND a.started_at < clock_timestamp() - interval '2 minutes'
  LOOP
    v_total := v_total + public.expire_stale_email_sends(v_actor);
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_all_stale_email_sends() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_all_stale_email_sends() TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Schedule the cleanup every 5 minutes via pg_cron.
--    pg_cron must be enabled once in the project (Database -> Extensions).
--    The schedule line is wrapped in a guard so this migration still applies on
--    databases where pg_cron is not yet available; if it is skipped, run the
--    SELECT cron.schedule(...) manually after enabling the extension.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule idempotently before re-adding, so re-running is safe.
    PERFORM cron.unschedule('expire-stale-email-sends')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-email-sends');
    PERFORM cron.schedule('expire-stale-email-sends', '*/5 * * * *',
      'SELECT public.expire_all_stale_email_sends()');
  ELSE
    RAISE NOTICE 'pg_cron not enabled — enable it in Supabase (Database -> Extensions), then run: SELECT cron.schedule(''expire-stale-email-sends'', ''*/5 * * * *'', ''SELECT public.expire_all_stale_email_sends()'');';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
