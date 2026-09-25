-- Step 6: atomic rate limit slot consumption for guest audio requests.
-- Apply only to the pinned test project in supabase/test-project.json.
-- This does not modify existing rows or earlier migrations.
BEGIN;

CREATE OR REPLACE FUNCTION public.consume_audio_request_slot(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation_id uuid;
  v_audio_window_started_at timestamptz;
  v_audio_requests_in_window integer;
  v_music_path text;
  v_expected_path text;
  v_event_accessible boolean;
  v_current_now timestamptz;
  v_new_window_started_at timestamptz;
  v_new_requests_count integer;
  v_retry_after_seconds integer;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid invitation token' USING ERRCODE = '22023';
  END IF;

  SELECT i.id, i.audio_window_started_at, i.audio_requests_in_window, e.music_path,
         (p.id::text || '/' || e.id::text || '/music.mp3'),
         (e.lifecycle_status = 'active' AND p.lifecycle_status = 'active' AND p.role = 'host')
    INTO v_invitation_id, v_audio_window_started_at, v_audio_requests_in_window, v_music_path,
         v_expected_path, v_event_accessible
  FROM public.invitations AS i
  JOIN public.events AS e ON e.id = i.event_id
  JOIN public.profiles AS p ON p.id = e.user_id
  WHERE i.token = p_token
  FOR UPDATE OF i;

  IF NOT FOUND OR v_event_accessible IS NOT TRUE THEN
    RETURN jsonb_build_object('kind', 'not_found');
  END IF;

  IF v_music_path IS NULL OR v_music_path IS DISTINCT FROM v_expected_path THEN
    RETURN jsonb_build_object('kind', 'no_music');
  END IF;

  v_current_now := clock_timestamp();

  IF v_audio_window_started_at IS NULL OR (v_audio_window_started_at + INTERVAL '60 minutes') <= v_current_now THEN
    v_new_window_started_at := v_current_now;
    v_new_requests_count := 1;
  ELSE
    IF v_audio_requests_in_window >= 30 THEN
      v_retry_after_seconds := LEAST(3600, GREATEST(1, CEIL(EXTRACT(EPOCH FROM ((v_audio_window_started_at + INTERVAL '60 minutes') - v_current_now)))::integer));
      RETURN jsonb_build_object(
        'kind', 'rate_limited',
        'retry_after_seconds', v_retry_after_seconds
      );
    END IF;

    v_new_window_started_at := v_audio_window_started_at;
    v_new_requests_count := v_audio_requests_in_window + 1;
  END IF;

  UPDATE public.invitations
  SET audio_window_started_at = v_new_window_started_at,
      audio_requests_in_window = v_new_requests_count
  WHERE id = v_invitation_id;

  RETURN jsonb_build_object(
    'kind', 'allowed',
    'music_path', v_music_path,
    'requests_in_window', v_new_requests_count,
    'window_started_at', v_new_window_started_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_audio_request_slot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_audio_request_slot(text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
