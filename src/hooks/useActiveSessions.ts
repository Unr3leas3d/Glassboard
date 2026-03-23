// src/hooks/useActiveSessions.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import type { Organization } from "./useOrganizations";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface SessionParticipant {
  id: string;
  name: string;
}

export interface ActiveSessionItem {
  id: string;
  title: string | null;
  host: SessionParticipant;
  participants: SessionParticipant[];
  createdAt: string;
  orgId: string;
}

export interface ActiveSessionGroup {
  org: Organization;
  sessions: ActiveSessionItem[];
}

export function useActiveSessions(
  userId: string | undefined,
  orgs: Organization[],
) {
  const [groups, setGroups] = useState<ActiveSessionGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!userId || orgs.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const orgIds = orgs.map((o) => o.id);

    const { data: sessions, error: sessionsErr } = await supabase
      .from("sessions")
      .select("*")
      .in("org_id", orgIds)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (sessionsErr || !sessions) {
      console.error("[useActiveSessions] Failed to fetch sessions:", sessionsErr);
      setLoading(false);
      return;
    }

    if (sessions.length === 0) {
      setGroups(orgs.map((org) => ({ org, sessions: [] })));
      setLoading(false);
      return;
    }

    const sessionIds = sessions.map((s) => s.id);

    const { data: participants } = await supabase
      .from("session_participants")
      .select("session_id, user_id")
      .in("session_id", sessionIds);

    const { data: memberProfiles } = await supabase
      .from("org_members_with_profile")
      .select("user_id, full_name")
      .in("org_id", orgIds);

    const profileMap = new Map(
      (memberProfiles ?? []).map((p) => [p.user_id, p.full_name]),
    );

    function toParticipant(uid: string): SessionParticipant {
      return {
        id: uid,
        name: profileMap.get(uid) ?? "Unknown",
      };
    }

    const sessionsByOrg = new Map<string, ActiveSessionItem[]>();
    for (const s of sessions) {
      const sessionParticipants = (participants ?? [])
        .filter((p) => p.session_id === s.id)
        .map((p) => toParticipant(p.user_id));

      const item: ActiveSessionItem = {
        id: s.id,
        title: s.title,
        host: toParticipant(s.host_id),
        participants: sessionParticipants,
        createdAt: s.created_at,
        orgId: s.org_id,
      };

      const existing = sessionsByOrg.get(s.org_id) ?? [];
      existing.push(item);
      sessionsByOrg.set(s.org_id, existing);
    }

    const result: ActiveSessionGroup[] = orgs
      .map((org) => ({
        org,
        sessions: sessionsByOrg.get(org.id) ?? [],
      }))
      .filter((g) => g.sessions.length > 0);

    setGroups(result);
    setLoading(false);
  }, [userId, orgs]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!userId || orgs.length === 0) return;

    const channel = supabase
      .channel("session-discovery")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          fetchSessions();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_participants" },
        (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          fetchSessions();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, orgs, fetchSessions]);

  return { groups, loading, refetch: fetchSessions };
}
