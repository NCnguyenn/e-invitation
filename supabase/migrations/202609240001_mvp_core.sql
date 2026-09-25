-- MVP core schema, RLS, RSVP lock, and private audio storage.
-- Apply only to the designated Supabase test project.

CREATE OR REPLACE FUNCTION public.is_allowed_google_map_url(url text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  trimmed text;
  rest text;
  hostport text;
  host text;
  port text;
  pathquery text;
  path text;
  slash_pos int;
  colon_pos int;
BEGIN
  IF url IS NULL THEN
    RETURN true;
  END IF;
  trimmed := btrim(url);
  IF trimmed = '' THEN
    RETURN true;
  END IF;
  IF char_length(trimmed) > 2048 THEN
    RETURN false;
  END IF;
  IF trimmed !~* '^https://' THEN
    RETURN false;
  END IF;
  rest := substr(trimmed, 9);
  IF rest = '' THEN
    RETURN false;
  END IF;
  slash_pos := position('/' in rest);
  IF slash_pos = 0 THEN
    hostport := rest;
    pathquery := '';
  ELSE
    hostport := substr(rest, 1, slash_pos - 1);
    pathquery := substr(rest, slash_pos);
  END IF;
  IF position('@' in hostport) > 0 THEN
    RETURN false;
  END IF;
  colon_pos := position(':' in hostport);
  IF colon_pos > 0 THEN
    host := lower(substr(hostport, 1, colon_pos - 1));
    port := substr(hostport, colon_pos + 1);
    IF port <> '443' THEN
      RETURN false;
    END IF;
  ELSE
    host := lower(hostport);
  END IF;
  path := split_part(split_part(pathquery, '?', 1), '#', 1);
  IF host IN ('maps.google.com', 'maps.app.goo.gl') THEN
    RETURN true;
  END IF;
  IF host IN ('google.com', 'www.google.com') THEN
    RETURN path = '/maps' OR path LIKE '/maps/%';
  END IF;
  RETURN false;
END;
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'host' CHECK (role IN ('host', 'developer')),
  lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'deleting')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  template_key varchar(50) NOT NULL DEFAULT 'wedding-floral-01',
  event_date timestamptz NOT NULL,
  timezone varchar(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh' CHECK (timezone = 'Asia/Ho_Chi_Minh'),
  music_path text,
  venue_name varchar(255),
  venue_address text,
  google_map_url text,
  lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'deleting')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_title_len CHECK (char_length(btrim(title)) BETWEEN 1 AND 255),
  CONSTRAINT events_venue_address_len CHECK (venue_address IS NULL OR char_length(venue_address) <= 2000),
  CONSTRAINT events_google_map_url_len CHECK (google_map_url IS NULL OR char_length(google_map_url) <= 2048),
  CONSTRAINT events_google_map_url_ok CHECK (public.is_allowed_google_map_url(google_map_url)),
  CONSTRAINT events_music_path_format CHECK (
    music_path IS NULL OR music_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/music\.mp3$'
  )
);

CREATE UNIQUE INDEX events_one_per_host ON public.events (user_id);
CREATE INDEX events_user_id ON public.events (user_id);

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  guest_name varchar(255) NOT NULL,
  guest_email varchar(255) NOT NULL,
  invitation_note text,
  token varchar(64) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  guest_message text,
  responded_at timestamptz,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sending', 'sent', 'failed', 'unknown')),
  sent_at timestamptz,
  last_send_attempt_at timestamptz,
  current_send_attempt_id uuid,
  has_send_history boolean NOT NULL DEFAULT false,
  rsvp_window_started_at timestamptz,
  audio_window_started_at timestamptz,
  rsvp_updates_in_window integer NOT NULL DEFAULT 0 CHECK (rsvp_updates_in_window >= 0),
  audio_requests_in_window integer NOT NULL DEFAULT 0 CHECK (audio_requests_in_window >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_guest_name_len CHECK (char_length(btrim(guest_name)) BETWEEN 1 AND 255),
  CONSTRAINT invitations_guest_email_format CHECK (guest_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  CONSTRAINT invitations_note_len CHECK (invitation_note IS NULL OR char_length(invitation_note) <= 500),
  CONSTRAINT invitations_message_len CHECK (guest_message IS NULL OR char_length(guest_message) <= 1000),
  CONSTRAINT invitations_token_hex CHECK (token ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX invitations_token_unique ON public.invitations (token);
CREATE UNIQUE INDEX invitations_event_email_unique ON public.invitations (event_id, guest_email);
CREATE INDEX invitations_event_id ON public.invitations (event_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, lifecycle_status)
  VALUES (NEW.id, 'host', 'active')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, role, lifecycle_status)
SELECT id, 'host', 'active'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.profiles_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    IF auth.role() = 'authenticated' THEN
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.role IS DISTINCT FROM OLD.role
         OR NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'profiles columns are not writable by the client'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_before_write
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_before_write();

CREATE OR REPLACE FUNCTION public.events_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.title := btrim(NEW.title);
  NEW.template_key := btrim(NEW.template_key);
  NEW.timezone := 'Asia/Ho_Chi_Minh';
  NEW.venue_name := NULLIF(btrim(NEW.venue_name), '');
  NEW.venue_address := NULLIF(btrim(NEW.venue_address), '');
  NEW.google_map_url := NULLIF(btrim(NEW.google_map_url), '');
  NEW.music_path := NULLIF(btrim(NEW.music_path), '');

  IF NEW.title IS NULL OR char_length(NEW.title) = 0 THEN
    RAISE EXCEPTION 'event title is required' USING ERRCODE = '23514';
  END IF;
  IF NEW.google_map_url IS NOT NULL AND NOT public.is_allowed_google_map_url(NEW.google_map_url) THEN
    RAISE EXCEPTION 'google map url is not allowed' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    IF auth.role() = 'authenticated' THEN
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.user_id IS DISTINCT FROM OLD.user_id
         OR NEW.template_key IS DISTINCT FROM OLD.template_key
         OR NEW.music_path IS DISTINCT FROM OLD.music_path
         OR NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'event columns are not writable by the client'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSIF auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'events insert is not allowed for the client' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_before_write
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_before_write();

CREATE OR REPLACE FUNCTION public.invitations_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.guest_name := btrim(NEW.guest_name);
  NEW.guest_email := lower(btrim(NEW.guest_email));
  NEW.invitation_note := NULLIF(btrim(NEW.invitation_note), '');
  NEW.guest_message := NULLIF(btrim(NEW.guest_message), '');
  NEW.token := lower(NEW.token);

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();

    IF NEW.token IS DISTINCT FROM OLD.token THEN
      RAISE EXCEPTION 'invitation token cannot change' USING ERRCODE = '42501';
    END IF;
    IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
      RAISE EXCEPTION 'invitation event cannot change' USING ERRCODE = '42501';
    END IF;
    IF OLD.has_send_history AND NOT NEW.has_send_history THEN
      RAISE EXCEPTION 'has_send_history cannot be reset' USING ERRCODE = '42501';
    END IF;
    IF OLD.has_send_history AND NEW.guest_email IS DISTINCT FROM OLD.guest_email THEN
      RAISE EXCEPTION 'guest email cannot change after send history' USING ERRCODE = '42501';
    END IF;
    IF OLD.email_status IN ('sending', 'unknown')
       AND (
         NEW.guest_name IS DISTINCT FROM OLD.guest_name
         OR NEW.guest_email IS DISTINCT FROM OLD.guest_email
         OR NEW.invitation_note IS DISTINCT FROM OLD.invitation_note
       ) THEN
      RAISE EXCEPTION 'invitation identity cannot change while send is unresolved'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.status IN ('accepted', 'declined') THEN
      IF NEW.status IS DISTINCT FROM OLD.status
         OR NEW.guest_message IS DISTINCT FROM OLD.guest_message
         OR NEW.responded_at IS DISTINCT FROM OLD.responded_at THEN
        RAISE EXCEPTION 'rsvp is locked' USING ERRCODE = '42501';
      END IF;
    ELSIF OLD.status = 'pending' THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status NOT IN ('accepted', 'declined') THEN
          RAISE EXCEPTION 'invalid rsvp transition' USING ERRCODE = '23514';
        END IF;
      ELSIF NEW.guest_message IS DISTINCT FROM OLD.guest_message
            OR NEW.responded_at IS DISTINCT FROM OLD.responded_at THEN
        RAISE EXCEPTION 'rsvp fields require a decision' USING ERRCODE = '23514';
      END IF;
    END IF;

    IF auth.role() = 'authenticated' THEN
      IF NEW.status IS DISTINCT FROM OLD.status
         OR NEW.guest_message IS DISTINCT FROM OLD.guest_message
         OR NEW.responded_at IS DISTINCT FROM OLD.responded_at
         OR NEW.email_status IS DISTINCT FROM OLD.email_status
         OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
         OR NEW.last_send_attempt_at IS DISTINCT FROM OLD.last_send_attempt_at
         OR NEW.current_send_attempt_id IS DISTINCT FROM OLD.current_send_attempt_id
         OR NEW.has_send_history IS DISTINCT FROM OLD.has_send_history
         OR NEW.rsvp_window_started_at IS DISTINCT FROM OLD.rsvp_window_started_at
         OR NEW.audio_window_started_at IS DISTINCT FROM OLD.audio_window_started_at
         OR NEW.rsvp_updates_in_window IS DISTINCT FROM OLD.rsvp_updates_in_window
         OR NEW.audio_requests_in_window IS DISTINCT FROM OLD.audio_requests_in_window
         OR NEW.id IS DISTINCT FROM OLD.id
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'invitation columns are not writable by the client'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSIF auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'invitations insert is not allowed for the client' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invitations_before_write
  BEFORE INSERT OR UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.invitations_before_write();

CREATE OR REPLACE FUNCTION public.audio_object_owned_by_host(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    object_name ~ (
      '^' || auth.uid()::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/music\.mp3$'
    )
    AND EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.user_id = auth.uid()
        AND e.id::text = split_part(object_name, '/', 2)
        AND e.lifecycle_status = 'active'
        AND p.lifecycle_status = 'active'
    );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.invitations FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.events TO authenticated;
GRANT SELECT ON TABLE public.invitations TO authenticated;
GRANT UPDATE (title, event_date, timezone, venue_name, venue_address, google_map_url)
  ON TABLE public.events TO authenticated;
GRANT UPDATE (guest_name, guest_email, invitation_note)
  ON TABLE public.invitations TO authenticated;

GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT ALL ON TABLE public.events TO postgres, service_role;
GRANT ALL ON TABLE public.invitations TO postgres, service_role;

REVOKE ALL ON FUNCTION public.is_allowed_google_map_url(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.audio_object_owned_by_host(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.events_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invitations_before_write() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_allowed_google_map_url(text) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.audio_object_owned_by_host(text) TO authenticated, service_role, postgres;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.profiles_before_write() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.events_before_write() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.invitations_before_write() TO postgres, service_role;

DO $grant_auth_admin$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
  END IF;
END
$grant_auth_admin$;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY events_select_own
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND lifecycle_status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.lifecycle_status = 'active'
    )
  );

CREATE POLICY events_update_own
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND lifecycle_status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.lifecycle_status = 'active'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND lifecycle_status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.lifecycle_status = 'active'
    )
  );

CREATE POLICY invitations_select_own
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.id = invitations.event_id
        AND e.user_id = auth.uid()
        AND e.lifecycle_status = 'active'
        AND p.lifecycle_status = 'active'
    )
  );

CREATE POLICY invitations_update_own
  ON public.invitations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.id = invitations.event_id
        AND e.user_id = auth.uid()
        AND e.lifecycle_status = 'active'
        AND p.lifecycle_status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.id = invitations.event_id
        AND e.user_id = auth.uid()
        AND e.lifecycle_status = 'active'
        AND p.lifecycle_status = 'active'
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'audio', 'audio', false, 10485760, ARRAY['audio/mpeg']::text[]
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audio');

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['audio/mpeg']::text[]
WHERE id = 'audio';

DROP POLICY IF EXISTS audio_select_own ON storage.objects;
DROP POLICY IF EXISTS audio_insert_own ON storage.objects;
DROP POLICY IF EXISTS audio_update_own ON storage.objects;

CREATE POLICY audio_select_own
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'audio' AND public.audio_object_owned_by_host(name));

CREATE POLICY audio_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio' AND public.audio_object_owned_by_host(name));

CREATE POLICY audio_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'audio' AND public.audio_object_owned_by_host(name))
  WITH CHECK (bucket_id = 'audio' AND public.audio_object_owned_by_host(name));
