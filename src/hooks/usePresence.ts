import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  userId: string;
  name: string;
  color: string;
  isHost: boolean;
}

function userColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

export function usePresence(
  channelRef: RefObject<RealtimeChannel | null>,
  isConnected: boolean,
  userId: string | undefined,
  userName: string,
  isHost: boolean,
) {
  const [participants, setParticipants] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !isConnected || !userId) return;

    // Track our presence
    channel.track({
      userId,
      name: userName,
      color: userColor(userId),
      isHost,
    });

    // Listen for presence changes
    const syncHandler = () => {
      const state = channel.presenceState<{
        userId: string;
        name: string;
        color: string;
        isHost: boolean;
      }>();

      const users: PresenceUser[] = [];
      const seen = new Set<string>();

      for (const presences of Object.values(state)) {
        for (const p of presences) {
          if (!seen.has(p.userId)) {
            seen.add(p.userId);
            users.push({
              userId: p.userId,
              name: p.name,
              color: p.color,
              isHost: p.isHost,
            });
          }
        }
      }

      setParticipants(users);
    };

    channel.on("presence", { event: "sync" }, syncHandler);

    return () => {
      channel.untrack();
    };
  }, [channelRef, isConnected, userId, userName, isHost]);

  return { participants };
}
