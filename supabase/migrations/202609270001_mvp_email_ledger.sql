-- Step 7: email send ledger, internal daily cap, and privileged RPCs.
-- Apply only to the pinned test project in supabase/test-project.json.
-- Does not modify earlier migrations or existing invitation rows.
-- Brevo idempotency is intentionally not used. See docs/BREVO_SEND_CONTRACT.md.
BEGIN;

CREATE TABLE public.email_daily_counters (
  budget_date date PRIMARY KEY,
  reserved_attempts integer NOT NULL DEFAULT 0 CHECK (reserved_attempts BETWEEN 0 AND 300),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.email_send_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES public.invitations (id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  request_id uuid NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('reserved', 'sending', 'accepted', 'rejected', 'unknown')),
  budget_date date NOT NULL,
  started_at timestamptz,
  accepted_at timestamptz,
  finished_at timestamptz,
  resolved_at timestamptz,
  provider_message_id text,
  error_code text,
  payload_snapshot jsonb,
  resolution text,
  resolved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_send_attempts_actor_request_unique UNIQUE (actor_id, request_id),
  CONSTRAINT email_send_attempts_error_code_safe CHECK (
    error_code IS NULL OR error_code ~ '^[A-Za-z0-9_.:-]{1,80}$'
  ),
  CONSTRAINT email_send_attempts_message_id_safe CHECK (
    provider_message_id IS NULL OR (
      char_length(provider_message_id) BETWEEN 1 AND 255
      AND provider_message_id !~ '[\r\n]'
    )
  ),
  CONSTRAINT email_send_attempts_terminal_resolved CHECK (
    status NOT IN ('accepted', 'rejected') OR resolved_at IS NOT NULL
  ),
  CONSTRAINT email_send_attempts_accepted_has_message CHECK (
    status <> 'accepted' OR provider_message_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX email_send_attempts_one_unresolved
  ON public.email_send_attempts (invitation_id)
  WHERE status IN ('reserved', 'sending', 'unknown') AND resolved_at IS NULL;

CREATE INDEX email_send_attempts_invitation_id ON public.email_send_attempts (invitation_id);
CREATE INDEX email_send_attempts_accepted_at ON public.email_send_attempts (accepted_at);
CREATE INDEX email_send_attempts_budget_date ON public.email_send_attempts (budget_date);
CREATE INDEX email_send_attempts_actor_open
  ON public.email_send_attempts (actor_id, started_at)
  WHERE status IN ('reserved', 'sending') AND resolved_at IS NULL;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_current_send_attempt_id_fkey
  FOREIGN KEY (current_send_attempt_id)
  REFERENCES public.email_send_attempts (id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.email_ledger_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'email ledger is not writable by the client' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_send_attempts_before_write ON public.email_send_attempts;
CREATE TRIGGER email_send_attempts_before_write
  BEFORE INSERT OR UPDATE ON public.email_send_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.email_ledger_before_write();

DROP TRIGGER IF EXISTS email_daily_counters_before_write ON public.email_daily_counters;
CREATE TRIGGER email_daily_counters_before_write
  BEFORE INSERT OR UPDATE ON public.email_daily_counters
  FOR EACH ROW
  EXECUTE FUNCTION public.email_ledger_before_write();

CREATE OR REPLACE FUNCTION public.email_budget_date(p_at timestamptz)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT (p_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_email_sends(p_actor_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer := 0;
  v_stale integer := 0;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'actor is required' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.invitations AS i
  JOIN public.events AS e ON e.id = i.event_id
  WHERE e.user_id = p_actor_id
    AND i.current_send_attempt_id IS NOT NULL
  ORDER BY i.id
  FOR UPDATE OF i;

  UPDATE public.email_send_attempts AS a
  SET status = 'accepted',
      accepted_at = COALESCE(a.accepted_at, clock_timestamp()),
      finished_at = COALESCE(a.finished_at, clock_timestamp()),
      resolved_at = COALESCE(a.resolved_at, clock_timestamp())
  WHERE a.actor_id = p_actor_id
    AND a.status IN ('reserved', 'sending')
    AND a.resolved_at IS NULL
    AND a.started_at < clock_timestamp() - interval '2 minutes'
    AND a.provider_message_id IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.email_send_attempts AS a
  SET status = 'unknown',
      finished_at = COALESCE(a.finished_at, clock_timestamp()),
      error_code = COALESCE(a.error_code, 'stale_unresolved')
  WHERE a.actor_id = p_actor_id
    AND a.status IN ('reserved', 'sending')
    AND a.resolved_at IS NULL
    AND a.started_at < clock_timestamp() - interval '2 minutes'
    AND a.provider_message_id IS NULL;
  GET DIAGNOSTICS v_stale = ROW_COUNT;
  v_count := v_count + v_stale;

  UPDATE public.invitations AS i
  SET email_status = CASE WHEN a.status = 'accepted' THEN 'sent' ELSE 'unknown' END,
      sent_at = CASE
        WHEN a.status = 'accepted' THEN COALESCE(i.sent_at, a.accepted_at)
        ELSE i.sent_at
      END
  FROM public.email_send_attempts AS a
  JOIN public.events AS e ON e.user_id = p_actor_id
  WHERE i.current_send_attempt_id = a.id
    AND i.event_id = e.id
    AND a.actor_id = p_actor_id
    AND a.status IN ('accepted', 'unknown')
    AND i.email_status IN ('pending', 'sending');

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_email_send(
  p_actor_id uuid,
  p_invitation_id uuid,
  p_request_id uuid,
  p_payload jsonb,
  p_budget_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_budget_date date;
  v_event_id uuid;
  v_owner uuid;
  v_event_active boolean;
  v_host_active boolean;
  v_guest_name text;
  v_guest_email text;
  v_note text;
  v_token text;
  v_title text;
  v_event_date timestamptz;
  v_timezone text;
  v_venue_name text;
  v_venue_address text;
  v_last_send_attempt_at timestamptz;
  v_attempt public.email_send_attempts%ROWTYPE;
  v_open_id uuid;
  v_open_status text;
  v_attempt_id uuid;
  v_constraint text;
  v_payload_date timestamptz;
  v_subject_title text;
BEGIN
  IF p_actor_id IS NULL OR p_invitation_id IS NULL OR p_request_id IS NULL OR p_payload IS NULL THEN
    RAISE EXCEPTION 'reserve input is incomplete' USING ERRCODE = '22023';
  END IF;

  v_budget_date := COALESCE(p_budget_date, public.email_budget_date(clock_timestamp()));

  INSERT INTO public.email_daily_counters (budget_date, reserved_attempts)
  VALUES (v_budget_date, 0)
  ON CONFLICT (budget_date) DO NOTHING;

  PERFORM 1
  FROM public.email_daily_counters
  WHERE budget_date = v_budget_date
  FOR UPDATE;

  SELECT i.event_id, e.user_id,
         (e.lifecycle_status = 'active'),
         (p.role = 'host' AND p.lifecycle_status = 'active'),
         i.guest_name, i.guest_email, i.invitation_note, i.token,
         e.title, e.event_date, e.timezone, e.venue_name, e.venue_address,
         i.last_send_attempt_at
    INTO v_event_id, v_owner, v_event_active, v_host_active,
         v_guest_name, v_guest_email, v_note, v_token,
         v_title, v_event_date, v_timezone, v_venue_name, v_venue_address,
         v_last_send_attempt_at
  FROM public.invitations AS i
  JOIN public.events AS e ON e.id = i.event_id
  JOIN public.profiles AS p ON p.id = e.user_id
  WHERE i.id = p_invitation_id
  FOR UPDATE OF i;

  IF NOT FOUND OR v_owner IS DISTINCT FROM p_actor_id OR v_event_active IS NOT TRUE OR v_host_active IS NOT TRUE THEN
    RETURN jsonb_build_object('kind', 'not_found');
  END IF;

  SELECT * INTO v_attempt
  FROM public.email_send_attempts
  WHERE actor_id = p_actor_id AND request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_attempt.invitation_id IS DISTINCT FROM p_invitation_id THEN
      RETURN jsonb_build_object('kind', 'request_conflict');
    END IF;
    RETURN jsonb_build_object(
      'kind', 'replay',
      'attempt_id', v_attempt.id,
      'attempt_status', v_attempt.status,
      'provider_message_id', v_attempt.provider_message_id,
      'invite_path', '/invite/' || v_token,
      'snapshot', CASE WHEN v_attempt.status = 'reserved' THEN v_attempt.payload_snapshot ELSE NULL END
    );
  END IF;

  SELECT id, status INTO v_open_id, v_open_status
  FROM public.email_send_attempts
  WHERE invitation_id = p_invitation_id
    AND status IN ('reserved', 'sending', 'unknown')
    AND resolved_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'kind', 'unresolved',
      'attempt_id', v_open_id,
      'attempt_status', v_open_status,
      'invite_path', '/invite/' || v_token
    );
  END IF;

  IF v_last_send_attempt_at IS NOT NULL
     AND v_last_send_attempt_at + interval '60 seconds' > clock_timestamp() THEN
    RETURN jsonb_build_object(
      'kind', 'cooldown',
      'retry_after_seconds', LEAST(
        60,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM ((v_last_send_attempt_at + interval '60 seconds') - clock_timestamp())))::integer)
      ),
      'invite_path', '/invite/' || v_token
    );
  END IF;

  BEGIN
    v_payload_date := (p_payload->>'eventDate')::timestamptz;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('kind', 'payload_mismatch');
  END;

  v_subject_title := regexp_replace(btrim(v_title), '[' || chr(13) || chr(10) || ']+', ' ', 'g');
  IF btrim(p_payload->>'guestName') IS DISTINCT FROM v_guest_name
     OR lower(btrim(p_payload->>'guestEmail')) IS DISTINCT FROM v_guest_email
     OR NULLIF(btrim(p_payload->>'invitationNote'), '') IS DISTINCT FROM v_note
     OR NULLIF(btrim(p_payload->>'venueName'), '') IS DISTINCT FROM v_venue_name
     OR NULLIF(btrim(p_payload->>'venueAddress'), '') IS DISTINCT FROM v_venue_address
     OR p_payload->>'token' IS DISTINCT FROM v_token
     OR p_payload->>'timezone' IS DISTINCT FROM v_timezone
     OR v_payload_date IS DISTINCT FROM v_event_date
     OR p_payload->>'subject' IS DISTINCT FROM ('Thư mời: ' || v_subject_title)
     OR COALESCE(p_payload->>'inviteUrl', '') !~ ('^https://[^/]+/invite/' || v_token || '$')
     OR position(p_payload->>'inviteUrl' IN COALESCE(p_payload->>'htmlContent', '')) = 0
     OR position(p_payload->>'inviteUrl' IN COALESCE(p_payload->>'textContent', '')) = 0
     OR char_length(COALESCE(p_payload->>'htmlContent', '')) NOT BETWEEN 1 AND 50000
     OR char_length(COALESCE(p_payload->>'textContent', '')) NOT BETWEEN 1 AND 20000
     OR char_length(COALESCE(p_payload->>'senderEmail', '')) NOT BETWEEN 3 AND 255
     OR char_length(COALESCE(p_payload->>'senderName', '')) NOT BETWEEN 1 AND 70
     OR char_length(COALESCE(p_payload->>'toName', '')) NOT BETWEEN 1 AND 70
  THEN
    RETURN jsonb_build_object('kind', 'payload_mismatch');
  END IF;

  BEGIN
    UPDATE public.email_daily_counters
    SET reserved_attempts = reserved_attempts + 1
    WHERE budget_date = v_budget_date
      AND reserved_attempts < 300;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('kind', 'internal_cap');
    END IF;

    INSERT INTO public.email_send_attempts (
      invitation_id, actor_id, request_id, status, budget_date, started_at, payload_snapshot
    ) VALUES (
      p_invitation_id, p_actor_id, p_request_id, 'reserved', v_budget_date, clock_timestamp(), p_payload
    )
    RETURNING id INTO v_attempt_id;

    UPDATE public.invitations
    SET current_send_attempt_id = v_attempt_id,
        last_send_attempt_at = clock_timestamp(),
        has_send_history = true,
        email_status = 'sending'
    WHERE id = p_invitation_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'email_send_attempts_actor_request_unique' THEN
      SELECT * INTO v_attempt
      FROM public.email_send_attempts
      WHERE actor_id = p_actor_id AND request_id = p_request_id;
      IF v_attempt.id IS NULL THEN
        RAISE;
      END IF;
      IF v_attempt.invitation_id IS DISTINCT FROM p_invitation_id THEN
        RETURN jsonb_build_object('kind', 'request_conflict');
      END IF;
      RETURN jsonb_build_object(
        'kind', 'replay',
        'attempt_id', v_attempt.id,
        'attempt_status', v_attempt.status,
        'provider_message_id', v_attempt.provider_message_id,
        'invite_path', '/invite/' || v_token,
        'snapshot', CASE WHEN v_attempt.status = 'reserved' THEN v_attempt.payload_snapshot ELSE NULL END
      );
    ELSIF v_constraint = 'email_send_attempts_one_unresolved' THEN
      SELECT id, status INTO v_open_id, v_open_status
      FROM public.email_send_attempts
      WHERE invitation_id = p_invitation_id
        AND status IN ('reserved', 'sending', 'unknown')
        AND resolved_at IS NULL;
      RETURN jsonb_build_object(
        'kind', 'unresolved',
        'attempt_id', v_open_id,
        'attempt_status', v_open_status,
        'invite_path', '/invite/' || v_token
      );
    ELSE
      RAISE;
    END IF;
  END;

  RETURN jsonb_build_object(
    'kind', 'reserved',
    'attempt_id', v_attempt_id,
    'attempt_status', 'reserved',
    'invite_path', '/invite/' || v_token,
    'snapshot', p_payload
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_email_send(
  p_actor_id uuid,
  p_attempt_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_status text;
BEGIN
  IF p_actor_id IS NULL OR p_attempt_id IS NULL THEN
    RAISE EXCEPTION 'claim input is incomplete' USING ERRCODE = '22023';
  END IF;

  UPDATE public.email_send_attempts
  SET status = 'sending'
  WHERE id = p_attempt_id
    AND actor_id = p_actor_id
    AND status = 'reserved'
    AND resolved_at IS NULL
    AND payload_snapshot IS NOT NULL
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('kind', 'claimed', 'attempt_id', v_id);
  END IF;

  SELECT status INTO v_status
  FROM public.email_send_attempts
  WHERE id = p_attempt_id AND actor_id = p_actor_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('kind', 'not_found');
  END IF;
  RETURN jsonb_build_object('kind', 'not_claimed', 'attempt_status', v_status, 'attempt_id', p_attempt_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_email_send(
  p_actor_id uuid,
  p_attempt_id uuid,
  p_outcome text,
  p_message_id text,
  p_error_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attempt public.email_send_attempts%ROWTYPE;
  v_lock_invitation_id uuid;
  v_updated boolean := false;
  v_email_status text;
BEGIN
  IF p_actor_id IS NULL OR p_attempt_id IS NULL OR p_outcome NOT IN ('accepted', 'rejected', 'unknown') THEN
    RAISE EXCEPTION 'finalize input is incomplete' USING ERRCODE = '22023';
  END IF;
  IF p_error_code IS NOT NULL AND p_error_code !~ '^[A-Za-z0-9_.:-]{1,80}$' THEN
    RAISE EXCEPTION 'error code is not safe' USING ERRCODE = '22023';
  END IF;
  IF p_outcome = 'accepted' AND (
    p_message_id IS NULL OR char_length(btrim(p_message_id)) NOT BETWEEN 1 AND 255 OR btrim(p_message_id) ~ '[\r\n]'
  ) THEN
    RAISE EXCEPTION 'acceptance requires a message id' USING ERRCODE = '22023';
  END IF;

  SELECT invitation_id INTO v_lock_invitation_id
  FROM public.email_send_attempts
  WHERE id = p_attempt_id AND actor_id = p_actor_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('kind', 'not_found');
  END IF;

  IF v_lock_invitation_id IS NOT NULL THEN
    PERFORM 1
    FROM public.invitations
    WHERE id = v_lock_invitation_id
    FOR UPDATE;
  END IF;

  SELECT * INTO v_attempt
  FROM public.email_send_attempts
  WHERE id = p_attempt_id AND actor_id = p_actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('kind', 'not_found');
  END IF;

  IF v_attempt.status = 'accepted' AND v_attempt.provider_message_id IS NOT NULL THEN
    IF v_attempt.provider_message_id = btrim(p_message_id) THEN
      RETURN jsonb_build_object('kind', 'updated', 'attempt_status', 'accepted', 'invitation_updated', false);
    END IF;
    RETURN jsonb_build_object('kind', 'ignored', 'attempt_status', v_attempt.status);
  END IF;

  IF v_attempt.status = 'rejected' AND v_attempt.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('kind', 'ignored', 'attempt_status', 'rejected');
  END IF;

  IF p_outcome = 'accepted' THEN
    UPDATE public.email_send_attempts
    SET status = 'accepted',
        provider_message_id = btrim(p_message_id),
        accepted_at = COALESCE(accepted_at, clock_timestamp()),
        finished_at = clock_timestamp(),
        resolved_at = clock_timestamp(),
        error_code = NULL
    WHERE id = p_attempt_id;
    v_email_status := 'sent';
  ELSIF p_outcome = 'rejected' THEN
    UPDATE public.email_send_attempts
    SET status = 'rejected',
        error_code = COALESCE(p_error_code, 'rejected'),
        finished_at = clock_timestamp(),
        resolved_at = clock_timestamp()
    WHERE id = p_attempt_id;
    v_email_status := 'failed';
  ELSE
    UPDATE public.email_send_attempts
    SET status = 'unknown',
        error_code = COALESCE(p_error_code, 'unknown'),
        finished_at = clock_timestamp()
    WHERE id = p_attempt_id;
    v_email_status := 'unknown';
  END IF;

  UPDATE public.invitations AS i
  SET email_status = v_email_status,
      sent_at = CASE
        WHEN v_email_status = 'sent' THEN COALESCE(i.sent_at, clock_timestamp())
        ELSE i.sent_at
      END
  FROM public.events AS e
  WHERE i.id = v_attempt.invitation_id
    AND i.event_id = e.id
    AND e.user_id = p_actor_id
    AND i.current_send_attempt_id = p_attempt_id;
  v_updated := FOUND;

  RETURN jsonb_build_object(
    'kind', 'updated',
    'attempt_status', p_outcome,
    'email_status', v_email_status,
    'invitation_updated', v_updated,
    'attempt_id', p_attempt_id
  );
END;
$$;

REVOKE ALL ON TABLE public.email_send_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.email_daily_counters FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.email_send_attempts TO postgres, service_role;
GRANT ALL ON TABLE public.email_daily_counters TO postgres, service_role;

ALTER TABLE public.email_send_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_daily_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION public.email_ledger_before_write() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_ledger_before_write() TO postgres, service_role;

REVOKE ALL ON FUNCTION public.email_budget_date(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_budget_date(timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.expire_stale_email_sends(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_email_sends(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_email_send(uuid, uuid, uuid, jsonb, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_email_send(uuid, uuid, uuid, jsonb, date) TO service_role;

REVOKE ALL ON FUNCTION public.claim_email_send(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_send(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.finalize_email_send(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_email_send(uuid, uuid, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
