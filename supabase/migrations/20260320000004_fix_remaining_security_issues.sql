-- Fix remaining security issues identified in the 2026-03-20 audit.

-- ============================================================
-- 1. Session join flow: remove broad authenticated SELECT and
--    replace it with a server-side join RPC plus participant grants.
-- ============================================================

CREATE TABLE IF NOT EXISTS session_participants (
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_session_participant(session_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM session_participants
    WHERE session_id = session_uuid
      AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS sessions_join_code_read ON sessions;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_participant_select' AND tablename = 'sessions') THEN
    CREATE POLICY sessions_participant_select ON sessions
      FOR SELECT USING (is_session_participant(id));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION join_session_by_code(input_join_code text)
RETURNS SETOF sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_session sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO matched_session
  FROM sessions
  WHERE join_code = UPPER(TRIM(input_join_code))
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO session_participants (session_id, user_id)
  VALUES (matched_session.id, auth.uid())
  ON CONFLICT (session_id, user_id) DO NOTHING;

  RETURN QUERY
  SELECT s.*
  FROM sessions s
  WHERE s.id = matched_session.id;
END;
$$;

REVOKE ALL ON FUNCTION join_session_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_session_by_code(text) TO authenticated;

-- ============================================================
-- 2. Questionnaire/admin access: add real admin checks and move
--    anonymous questionnaire persistence behind RPCs.
-- ============================================================

ALTER TABLE questionnaire_responses
  ADD COLUMN IF NOT EXISTS edit_token uuid NOT NULL DEFAULT gen_random_uuid();

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questionnaire_responses_waitlist_id_key'
  ) THEN
    ALTER TABLE questionnaire_responses
      ADD CONSTRAINT questionnaire_responses_waitlist_id_key UNIQUE (waitlist_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION is_questionnaire_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    OR COALESCE((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true', false);
$$;

DROP POLICY IF EXISTS questionnaire_authenticated_select ON questionnaire_responses;
DROP POLICY IF EXISTS questionnaire_public_update ON questionnaire_responses;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'questionnaire_admin_select'
      AND tablename = 'questionnaire_responses'
  ) THEN
    CREATE POLICY questionnaire_admin_select ON questionnaire_responses
      FOR SELECT USING (is_questionnaire_admin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION join_waitlist(input_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text := LOWER(TRIM(input_email));
  existing_id uuid;
BEGIN
  IF normalized_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  SELECT id
  INTO existing_id
  FROM waitlist
  WHERE LOWER(email) = normalized_email
  LIMIT 1;

  IF FOUND THEN
    RETURN existing_id;
  END IF;

  INSERT INTO waitlist (email)
  VALUES (normalized_email)
  RETURNING id INTO existing_id;

  RETURN existing_id;
END;
$$;

REVOKE ALL ON FUNCTION join_waitlist(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_waitlist(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION get_or_create_questionnaire_response(
  input_waitlist_id uuid,
  input_email text,
  input_edit_token uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  email text,
  answers jsonb,
  current_step int,
  completed boolean,
  edit_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text := LOWER(TRIM(input_email));
BEGIN
  IF normalized_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM waitlist
    WHERE id = input_waitlist_id
      AND LOWER(waitlist.email) = normalized_email
  ) THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM questionnaire_responses qr
    WHERE qr.waitlist_id = input_waitlist_id
  ) THEN
    -- If caller has the correct token, return the response
    IF input_edit_token IS NOT NULL THEN
      RETURN QUERY
      SELECT
        qr.id,
        qr.email,
        qr.answers,
        qr.current_step,
        qr.completed,
        qr.edit_token
      FROM questionnaire_responses qr
      WHERE qr.waitlist_id = input_waitlist_id
        AND qr.edit_token = input_edit_token;

      IF FOUND THEN
        RETURN;
      END IF;

      RAISE EXCEPTION 'Questionnaire access denied';
    END IF;

    -- No token provided: first-time access on this device, return the response
    -- so the client can store the edit_token
    RETURN QUERY
    SELECT
      qr.id,
      qr.email,
      qr.answers,
      qr.current_step,
      qr.completed,
      qr.edit_token
    FROM questionnaire_responses qr
    WHERE qr.waitlist_id = input_waitlist_id;

    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO questionnaire_responses (waitlist_id, email, answers, current_step)
  VALUES (input_waitlist_id, normalized_email, '{}'::jsonb, 0)
  RETURNING
    questionnaire_responses.id,
    questionnaire_responses.email,
    questionnaire_responses.answers,
    questionnaire_responses.current_step,
    questionnaire_responses.completed,
    questionnaire_responses.edit_token;
END;
$$;

REVOKE ALL ON FUNCTION get_or_create_questionnaire_response(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_or_create_questionnaire_response(uuid, text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION save_questionnaire_response(
  input_response_id uuid,
  input_edit_token uuid,
  input_answers jsonb,
  input_current_step int,
  input_completed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE questionnaire_responses
  SET
    answers = COALESCE(input_answers, '{}'::jsonb),
    current_step = GREATEST(COALESCE(input_current_step, 0), 0),
    completed = COALESCE(input_completed, false),
    updated_at = now()
  WHERE id = input_response_id
    AND edit_token = input_edit_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid questionnaire edit token';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION save_questionnaire_response(uuid, uuid, jsonb, int, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_questionnaire_response(uuid, uuid, jsonb, int, boolean) TO anon, authenticated;
