-- Baseline schema migration: version-controls existing Supabase schema
-- This captures the schema as it existed on 2026-03-20 before security hardening.
-- All statements are idempotent (IF NOT EXISTS / DO $$ guards).

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL REFERENCES organizations(id),
  user_id   uuid NOT NULL REFERENCES auth.users(id),
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id),
  host_id    uuid NOT NULL REFERENCES auth.users(id),
  join_code  text UNIQUE,
  title      text,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz
);

CREATE TABLE IF NOT EXISTS annotations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id),
  user_id    uuid NOT NULL REFERENCES auth.users(id),
  type       text NOT NULL DEFAULT 'excalidraw',
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Functions
-- ============================================================

CREATE OR REPLACE FUNCTION is_member_of(org_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_uuid AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_admin_of(org_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_uuid AND user_id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS text
LANGUAGE plpgsql
AS $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return code;
end;
$$;

-- ============================================================
-- View
-- ============================================================

CREATE OR REPLACE VIEW org_members_with_profile AS
SELECT
  om.id,
  om.org_id,
  om.user_id,
  om.role,
  om.joined_at,
  COALESCE(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(u.email::text, '@', 1)
  ) AS full_name
FROM org_members om
JOIN auth.users u ON u.id = om.user_id;

-- ============================================================
-- Enable RLS
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist       ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies: organizations
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_insert' AND tablename = 'organizations') THEN
    CREATE POLICY org_insert ON organizations
      FOR INSERT WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_creator_read' AND tablename = 'organizations') THEN
    CREATE POLICY org_creator_read ON organizations
      FOR SELECT USING (created_by = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_members_read' AND tablename = 'organizations') THEN
    CREATE POLICY org_members_read ON organizations
      FOR SELECT USING (is_member_of(id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_creator_update' AND tablename = 'organizations') THEN
    CREATE POLICY org_creator_update ON organizations
      FOR UPDATE USING (created_by = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_creator_delete' AND tablename = 'organizations') THEN
    CREATE POLICY org_creator_delete ON organizations
      FOR DELETE USING (created_by = auth.uid());
  END IF;
END $$;

-- ============================================================
-- RLS Policies: org_members
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_members_read_members' AND tablename = 'org_members') THEN
    CREATE POLICY org_members_read_members ON org_members
      FOR SELECT USING (is_member_of(org_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_members_self_insert_owner' AND tablename = 'org_members') THEN
    CREATE POLICY org_members_self_insert_owner ON org_members
      FOR INSERT WITH CHECK (user_id = auth.uid() AND role = 'owner');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_admin_insert_members' AND tablename = 'org_members') THEN
    CREATE POLICY org_admin_insert_members ON org_members
      FOR INSERT WITH CHECK (is_admin_of(org_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_admin_update_members' AND tablename = 'org_members') THEN
    CREATE POLICY org_admin_update_members ON org_members
      FOR UPDATE USING (is_admin_of(org_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_admin_delete_members' AND tablename = 'org_members') THEN
    CREATE POLICY org_admin_delete_members ON org_members
      FOR DELETE USING (is_admin_of(org_id));
  END IF;
END $$;

-- ============================================================
-- RLS Policies: sessions
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_host_manage' AND tablename = 'sessions') THEN
    CREATE POLICY sessions_host_manage ON sessions
      FOR ALL USING (host_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_org_read' AND tablename = 'sessions') THEN
    CREATE POLICY sessions_org_read ON sessions
      FOR SELECT USING (is_member_of(org_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_join_code_read' AND tablename = 'sessions') THEN
    CREATE POLICY sessions_join_code_read ON sessions
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ============================================================
-- RLS Policies: annotations
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'annotations_session_read' AND tablename = 'annotations') THEN
    CREATE POLICY annotations_session_read ON annotations
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.id = annotations.session_id AND is_member_of(s.org_id)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'annotations_user_write' AND tablename = 'annotations') THEN
    CREATE POLICY annotations_user_write ON annotations
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'annotations_user_update' AND tablename = 'annotations') THEN
    CREATE POLICY annotations_user_update ON annotations
      FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- RLS Policies: waitlist
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert' AND tablename = 'waitlist') THEN
    CREATE POLICY "Allow public insert" ON waitlist
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public select' AND tablename = 'waitlist') THEN
    CREATE POLICY "Allow public select" ON waitlist
      FOR SELECT USING (true);
  END IF;
END $$;
