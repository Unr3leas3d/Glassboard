-- Migration: Session Discovery Refactor
-- Drop join codes, add session_participants RLS, enable Realtime

-- 1. Drop join_session_by_code RPC function first
DROP FUNCTION IF EXISTS join_session_by_code(text);

-- 2. Remove join_code column (also removes the default that depends on generate_join_code)
ALTER TABLE sessions DROP COLUMN IF EXISTS join_code;

-- 3. Now safe to drop generate_join_code function
DROP FUNCTION IF EXISTS generate_join_code();

-- 4. RLS policies on session_participants
-- Allow org members to see participants of sessions in their org
CREATE POLICY "org_members_can_view_participants" ON session_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN org_members om ON om.org_id = s.org_id
      WHERE s.id = session_id
        AND om.user_id = auth.uid()
    )
  );

-- Allow org members to join active sessions in their org
CREATE POLICY "org_members_can_join_sessions" ON session_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN org_members om ON om.org_id = s.org_id
      WHERE s.id = session_id
        AND om.user_id = auth.uid()
        AND s.status = 'active'
    )
  );

-- Allow users to leave sessions (delete their own participant record)
CREATE POLICY "users_can_leave_sessions" ON session_participants
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 5. Enable Realtime on sessions and session_participants tables
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_participants;
