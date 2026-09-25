-- Step 2 follow-up: preserve the recipient details after the first send.
-- Apply only to the designated test project in supabase/test-project.json.
-- This adds a guard; it does not change rows or replace the core migration.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_sent_invitation_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.has_send_history AND (
    NEW.guest_name IS DISTINCT FROM OLD.guest_name
    OR NEW.guest_email IS DISTINCT FROM OLD.guest_email
    OR NEW.invitation_note IS DISTINCT FROM OLD.invitation_note
  ) THEN
    RAISE EXCEPTION 'invitation identity cannot change after send history'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_sent_invitation_identity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_sent_invitation_identity() TO postgres, service_role;

-- PostgreSQL orders same-event triggers by name. Run after normalization in
-- invitations_before_write, so an unchanged normalized value stays allowed.
DROP TRIGGER IF EXISTS invitations_guard_sent_identity ON public.invitations;
CREATE TRIGGER invitations_guard_sent_identity
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_sent_invitation_identity();

COMMIT;
