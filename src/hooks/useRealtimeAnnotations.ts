import { useEffect, useRef, useCallback } from "react";
import type { RefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

// Use a loose type for elements since Excalidraw's types are deeply nested
// We only need id and version for diffing
interface ElementLike {
  id: string;
  version: number;
  [key: string]: unknown;
}

const THROTTLE_MS = 50;

export function useRealtimeAnnotations(
  channelRef: RefObject<RealtimeChannel | null>,
  apiRef: RefObject<ExcalidrawImperativeAPI | null>,
  isConnected: boolean,
) {
  const lastSentVersions = useRef<Map<string, number>>(new Map());
  const lastSendTime = useRef(0);
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Send local changes to remote
  const broadcastChanges = useCallback(
    (elements: readonly ElementLike[]) => {
      const channel = channelRef.current;
      if (!channel || !isConnected) return;

      const changed: ElementLike[] = [];
      for (const el of elements) {
        const lastVersion = lastSentVersions.current.get(el.id) ?? 0;
        if (el.version > lastVersion) {
          changed.push(el);
          lastSentVersions.current.set(el.id, el.version);
        }
      }

      if (changed.length === 0) return;

      const now = Date.now();
      const elapsed = now - lastSendTime.current;

      if (elapsed >= THROTTLE_MS) {
        channel.send({
          type: "broadcast",
          event: "scene_update",
          payload: { elements: changed },
        });
        lastSendTime.current = now;
      } else {
        if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
        pendingTimeout.current = setTimeout(() => {
          channel.send({
            type: "broadcast",
            event: "scene_update",
            payload: { elements: changed },
          });
          lastSendTime.current = Date.now();
          pendingTimeout.current = null;
        }, THROTTLE_MS - elapsed);
      }
    },
    [channelRef, isConnected],
  );

  // Receive remote changes
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !isConnected) return;

    const handler = channel.on(
      "broadcast",
      { event: "scene_update" },
      ({ payload }) => {
        const api = apiRef.current;
        if (!api) return;

        const remoteElements = payload.elements as ElementLike[];
        const currentElements = api.getSceneElements() as unknown as ElementLike[];
        const appState = api.getAppState() as Record<string, unknown>;

        // Buffer during active drawing to prevent flicker
        if (appState.draggingElement) return;

        const elementMap = new Map(currentElements.map((el) => [el.id, el]));
        let changed = false;

        for (const remote of remoteElements) {
          const local = elementMap.get(remote.id);
          if (!local || remote.version > local.version) {
            elementMap.set(remote.id, remote);
            lastSentVersions.current.set(remote.id, remote.version);
            changed = true;
          }
        }

        if (changed) {
          api.updateScene({
            elements: Array.from(elementMap.values()) as unknown as Parameters<
              typeof api.updateScene
            >[0]["elements"],
          });
        }
      },
    );

    return () => {
      void handler;
    };
  }, [channelRef, apiRef, isConnected]);

  useEffect(() => {
    return () => {
      if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
    };
  }, []);

  return { broadcastChanges };
}
