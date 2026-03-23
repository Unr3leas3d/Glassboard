import { useEffect, useRef, useCallback, useState } from "react";
import type { RefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Stroke } from "../annotations/types";
import { computeStrokeOpacity } from "../annotations/tools/LaserTool";

const THROTTLE_MS = 50;

export function useRealtimeAnnotations(
  channelRef: RefObject<RealtimeChannel | null>,
  isConnected: boolean,
  userId: string,
  userColor: string,
) {
  const [remoteStrokes, setRemoteStrokes] = useState<Stroke[]>([]);
  const lastSendTime = useRef(0);
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registeredRef = useRef(false);

  // Broadcast a stroke update to remote peers
  const broadcastStroke = useCallback(
    (stroke: Stroke) => {
      const channel = channelRef.current;
      if (!channel || !isConnected) return;

      const now = Date.now();
      const elapsed = now - lastSendTime.current;

      const payload = {
        id: stroke.id,
        points: stroke.points,
        timestamps: stroke.timestamps,
        userId,
        color: userColor,
        birthTime: stroke.birthTime,
      };

      if (elapsed >= THROTTLE_MS) {
        channel.send({
          type: "broadcast",
          event: "laser_stroke",
          payload,
        });
        lastSendTime.current = now;
      } else {
        if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
        pendingTimeout.current = setTimeout(() => {
          channel.send({
            type: "broadcast",
            event: "laser_stroke",
            payload,
          });
          lastSendTime.current = Date.now();
          pendingTimeout.current = null;
        }, THROTTLE_MS - elapsed);
      }
    },
    [channelRef, isConnected, userId, userColor],
  );

  // Receive remote strokes
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !isConnected) return;
    if (registeredRef.current) return; // already registered

    channel.on(
      "broadcast",
      { event: "laser_stroke" },
      ({ payload }) => {
        const remote = payload as Stroke;
        setRemoteStrokes((prev) => {
          // Update existing stroke with same id, or add new
          const idx = prev.findIndex((s) => s.id === remote.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = remote;
            return next;
          }
          return [...prev, remote];
        });
      },
    );
    registeredRef.current = true;

    return () => { registeredRef.current = false; };
  }, [channelRef, isConnected]);

  // Cleanup expired remote strokes periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteStrokes((prev) =>
        prev.filter((s) => computeStrokeOpacity(s, now) > 0),
      );
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Cleanup pending timeout
  useEffect(() => {
    return () => {
      if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
    };
  }, []);

  return { remoteStrokes, broadcastStroke };
}
