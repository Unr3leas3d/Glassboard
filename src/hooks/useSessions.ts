import { useState, useCallback } from "react";
import { supabase } from "../supabase";

export interface Session {
  id: string;
  org_id: string;
  host_id: string;
  join_code: string;
  title: string | null;
  status: "active" | "ended";
  created_at: string;
  ended_at: string | null;
}

export function useSessions(userId: string | undefined, orgId: string | undefined) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(
    async (title?: string) => {
      if (!userId || !orgId) return null;
      setLoading(true);
      setError(null);

      // join_code is generated server-side by generate_join_code() default
      const { data, error: err } = await supabase
        .from("sessions")
        .insert({
          org_id: orgId,
          host_id: userId,
          title: title || null,
          status: "active",
        })
        .select()
        .single();

      if (err) {
        setError(err.message);
        setLoading(false);
        return null;
      }

      setActiveSession(data as Session);
      setLoading(false);
      return data as Session;
    },
    [userId, orgId],
  );

  const joinSession = useCallback(
    async (code: string) => {
      if (!userId) return null;
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .rpc("join_session_by_code", { input_join_code: code.toUpperCase() })
        .single();

      if (err || !data) {
        setError("Session not found or has ended.");
        setLoading(false);
        return null;
      }

      setActiveSession(data as Session);
      setLoading(false);
      return data as Session;
    },
    [userId],
  );

  const endSession = useCallback(
    async (sessionId: string) => {
      const { error: err } = await supabase
        .from("sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", sessionId);

      if (err) {
        setError(err.message);
        return;
      }
      setActiveSession(null);
    },
    [],
  );

  const leaveSession = useCallback(() => {
    setActiveSession(null);
  }, []);

  return {
    activeSession,
    loading,
    error,
    createSession,
    joinSession,
    endSession,
    leaveSession,
  };
}
