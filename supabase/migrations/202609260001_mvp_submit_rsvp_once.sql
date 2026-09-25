-- Step 4: atomic one-time RSVP for an accessible invitation.
-- Apply only to the pinned test project in supabase/test-project.json.
-- This does not modify existing rows or earlier migrations.
BEGIN;

CREATE OR REPLACE FUNCTION public.submit_rsvp_once(
  p_token text,
  p_decision text,
  p_guest_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invitation_id uuid;
  current_status text;
  current_message text;
  current_responded_at timestamptz;
  event_accessible boolean;
  normalized_message text;
  saved_status text;
  saved_message text;
  saved_responded_at timestamptz;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid invitation token' USING ERRCODE = '22023';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'invalid rsvp decision' USING ERRCODE = '22023';
  END IF;

  normalized_message := NULLIF(btrim(COALESCE(p_guest_message, '')), '');
  IF normalized_message IS NOT NULL AND char_length(normalized_message) > 1000 THEN
    RAISE EXCEPTION 'guest message is too long' USING ERRCODE = '22023';
  END IF;

  SELECT i.id, i.status, i.guest_message, i.responded_at,
         (e.lifecycle_status = 'active' AND p.lifecycle_status = 'active' AND p.role = 'host')
    INTO invitation_id, current_status, current_message, current_responded_at, event_accessible
  FROM public.invitations AS i
  JOIN public.events AS e ON e.id = i.event_id
  JOIN public.profiles AS p ON p.id = e.user_id
  WHERE i.token = p_token
  FOR UPDATE OF i, e, p;

  IF NOT FOUND OR event_accessible IS NOT TRUE THEN
    RETURN jsonb_build_object('kind', 'not_found');
  END IF;

  IF current_status IN ('accepted', 'declined') THEN
    IF current_responded_at IS NULL THEN
      RAISE EXCEPTION 'inconsistent rsvp receipt' USING ERRCODE = '55000';
    END IF;
    RETURN jsonb_build_object(
      'kind', 'already_responded',
      'status', current_status,
      'guest_message', current_message,
      'responded_at', current_responded_at
    );
  END IF;

  IF current_status IS DISTINCT FROM 'pending' OR current_responded_at IS NOT NULL THEN
    RAISE EXCEPTION 'inconsistent rsvp state' USING ERRCODE = '55000';
  END IF;

  UPDATE public.invitations
  SET status = p_decision,
      guest_message = normalized_message,
      responded_at = now()
  WHERE id = invitation_id
    AND status = 'pending'
    AND responded_at IS NULL
  RETURNING status, guest_message, responded_at
  INTO saved_status, saved_message, saved_responded_at;

  IF NOT FOUND THEN
    SELECT status, guest_message, responded_at
      INTO current_status, current_message, current_responded_at
    FROM public.invitations
    WHERE id = invitation_id;
    IF current_status IN ('accepted', 'declined') AND current_responded_at IS NOT NULL THEN
      RETURN jsonb_build_object(
        'kind', 'already_responded',
        'status', current_status,
        'guest_message', current_message,
        'responded_at', current_responded_at
      );
    END IF;
    RAISE EXCEPTION 'rsvp was not recorded' USING ERRCODE = '55000';
  END IF;

  RETURN jsonb_build_object(
    'kind', 'saved',
    'status', saved_status,
    'guest_message', saved_message,
    'responded_at', saved_responded_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_rsvp_once(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rsvp_once(text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
