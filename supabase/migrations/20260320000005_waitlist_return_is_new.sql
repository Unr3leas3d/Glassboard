-- Drop existing function first since return type is changing from uuid to jsonb.
DROP FUNCTION IF EXISTS join_waitlist(text);

-- Recreate join_waitlist to return jsonb with {id, is_new} so the client
-- can distinguish new signups from returning users.
CREATE OR REPLACE FUNCTION join_waitlist(input_email text)
RETURNS jsonb
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
    RETURN jsonb_build_object('id', existing_id, 'is_new', false);
  END IF;

  INSERT INTO waitlist (email)
  VALUES (normalized_email)
  RETURNING id INTO existing_id;

  RETURN jsonb_build_object('id', existing_id, 'is_new', true);
END;
$$;

REVOKE ALL ON FUNCTION join_waitlist(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_waitlist(text) TO anon, authenticated;
