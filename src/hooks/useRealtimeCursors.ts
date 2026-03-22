import { useEffect, useRef, useState, useCallback } from "react";
import type { RefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface RemoteCursorState {
  userId: string;
  name: string;
  x: number;
  y: number;
  color: string;
  avatarUrl?: string;
  lastSeen: number;
}

const THROTTLE_MS = 50;
const STALE_MS = 5000;

/** Deterministic color from userId */
function userColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

export function useRealtimeCursors(
  channelRef: RefObject<RealtimeChannel | null>,
  isConnected: boolean,
  userId: string | undefined,
  userName: string,
  avatarUrl?: string,
) {
  const [cursors, setCursors] = useState<Map<string, RemoteCursorState>>(new Map());
  const lastSendTime = useRef(0);

  // Broadcast local cursor position
  const broadcastCursor = useCallback(
    (x: number, y: number) => {
      const channel = channelRef.current;
      if (!channel || !isConnected || !userId) return;

      const now = Date.now();
      if (now - lastSendTime.current < THROTTLE_MS) return;
      lastSendTime.current = now;

      channel.send({
        type: "broadcast",
        event: "cursor_move",
        payload: { userId, name: userName, x, y, avatarUrl },
      });
    },
    [channelRef, isConnected, userId, userName, avatarUrl],
  );

  // Listen for remote cursors
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !isConnected) return;

    const handler = channel.on(
      "broadcast",
      { event: "cursor_move" },
      ({ payload }) => {
        const { userId: remoteId, name, x, y, avatarUrl: remoteAvatar } = payload as {
          userId: string;
          name: string;
          x: number;
          y: number;
          avatarUrl?: string;
        };

        setCursors((prev) => {
          const next = new Map(prev);
          next.set(remoteId, {
            userId: remoteId,
            name,
            x,
            y,
            color: userColor(remoteId),
            avatarUrl: remoteAvatar,
            lastSeen: Date.now(),
          });
          return next;
        });
      },
    );

    return () => {
      void handler;
    };
  }, [channelRef, isConnected]);

  // Cleanup stale cursors
  useEffect(() => {
    const interval = setInterval(() => {
      setCursors((prev) => {
        const now = Date.now();
        let changed = false;
        const next = new Map(prev);
        for (const [id, cursor] of next) {
          if (now - cursor.lastSeen > STALE_MS) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Track local mouse for broadcasting
  useEffect(() => {
    if (!isConnected || !userId) return;

    const onMove = (e: MouseEvent) => {
      broadcastCursor(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [isConnected, userId, broadcastCursor]);

  return { cursors };
}
