-- Security hardening migration (2026-03-20)
-- Addresses findings from the security audit.

-- ============================================================
-- 1. Self-leave policy for org_members
--    Non-admin members can now leave an org by deleting their own row.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_members_self_delete' AND tablename = 'org_members') THEN
    CREATE POLICY org_members_self_delete ON org_members
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- 2. Sole-owner guard trigger
--    Prevents the last owner of an org from leaving.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_sole_owner_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    IF (
      SELECT count(*) FROM org_members
      WHERE org_id = OLD.org_id AND role = 'owner' AND id <> OLD.id
    ) = 0 THEN
      RAISE EXCEPTION 'Cannot remove the sole owner of an organization. Transfer ownership first.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_sole_owner_leave ON org_members;
CREATE TRIGGER trg_prevent_sole_owner_leave
  BEFORE DELETE ON org_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sole_owner_leave();

-- ============================================================
-- 3. Tighten session INSERT — require org membership
--    The existing sessions_host_manage ALL policy allows INSERT
--    with only host_id = auth.uid(). Replace it with per-operation
--    policies so INSERT also checks org membership.
-- ============================================================

-- Drop the overly broad ALL policy
DROP POLICY IF EXISTS sessions_host_manage ON sessions;

-- Host can read their own sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_host_select' AND tablename = 'sessions') THEN
    CREATE POLICY sessions_host_select ON sessions
      FOR SELECT USING (host_id = auth.uid());
  END IF;
END $$;

-- Only org members can create sessions (and must be listed as host)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_insert_member' AND tablename = 'sessions') THEN
    CREATE POLICY sessions_insert_member ON sessions
      FOR INSERT WITH CHECK (host_id = auth.uid() AND is_member_of(org_id));
  END IF;
END $$;

-- Host can update their sessions (end session, etc.)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_host_update' AND tablename = 'sessions') THEN
    CREATE POLICY sessions_host_update ON sessions
      FOR UPDATE USING (host_id = auth.uid());
  END IF;
END $$;

-- Host can delete their sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_host_delete' AND tablename = 'sessions') THEN
    CREATE POLICY sessions_host_delete ON sessions
      FOR DELETE USING (host_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- 4. Replace generate_join_code() with crypto-safe version
--    Uses gen_random_bytes() instead of random().
-- ============================================================

CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  chars_len int := length(chars);
  code text := '';
  raw_bytes bytea;
  i int;
BEGIN
  raw_bytes := gen_random_bytes(6);
  FOR i IN 0..5 LOOP
    code := code || substr(chars, (get_byte(raw_bytes, i) % chars_len) + 1, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- Set join_code default so the DB generates it on INSERT
ALTER TABLE sessions ALTER COLUMN join_code SET DEFAULT generate_join_code();

-- ============================================================
-- 5. Realtime channel authorization note
--    Supabase Realtime Broadcast/Presence does not currently support
--    RLS-based channel authorization for custom channels (only for
--    Postgres Changes). Practical mitigations in place:
--    - Channel names use UUIDs (session:{uuid}), unguessable without
--      access to the session record
--    - sessions table SELECT policies restrict who can see session IDs
--    Revisit when Supabase adds Broadcast authorization support.
-- ============================================================
