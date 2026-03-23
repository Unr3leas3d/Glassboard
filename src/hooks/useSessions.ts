import { useState, useCallback } from "react";
import { supabase } from "../supabase";

export interface Session {
  id: string;
  org_id: string;
  host_id: string;
  title: string | null;
  status: "active" | "ended";
  created_at: string;
  ended_at: string | null;
}

export function useSessions(userId: string | undefined) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(
    async (orgId: string, title?: string) => {
      if (!userId) return null;
      setLoading(true);
      setError(null);

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
    [userId],
  );

  const joinSession = useCallback(
    async (sessionId: string) => {
      if (!userId) return null;
      setLoading(true);
      setError(null);

      const { error: insertErr } = await supabase
        .from("session_participants")
        .insert({ session_id: sessionId, user_id: userId });

      if (insertErr) {
        setError(insertErr.message);
        setLoading(false);
        return null;
      }

      const { data, error: fetchErr } = await supabase
        .from("sessions")
        .select()
        .eq("id", sessionId)
        .single();

      if (fetchErr || !data) {
        setError("Failed to load session details.");
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

  const leaveSession = useCallback(
    async (sessionId?: string) => {
      if (sessionId && userId) {
        await supabase
          .from("session_participants")
          .delete()
          .eq("session_id", sessionId)
          .eq("user_id", userId);
      }
      setActiveSession(null);
    },
    [userId],
  );

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
