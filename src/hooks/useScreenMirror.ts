import { useState, useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { invoke } from "@tauri-apps/api/core";

const CAPTURE_INTERVAL_MS = 750;

export function useScreenMirror(
  channelRef: RefObject<RealtimeChannel | null>,
  isConnected: boolean,
) {
  const [isSharing, setIsSharing] = useState(false);
  const [remoteFrame, setRemoteFrame] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeMonitorRef = useRef<number | undefined>(undefined);
  const registeredRef = useRef(false);

  const clearCaptureLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const broadcastFrame = useCallback(
    async (monitorIndex?: number) => {
      const channel = channelRef.current;
      if (!channel || !isConnected) {
        throw new Error("Screen sharing requires an active realtime connection");
      }

      const dataUrl = await invoke<string>("capture_screen", {
        quality: 70,
        maxWidth: 1920,
        monitorIndex,
      });

      await channel.send({
        type: "broadcast",
        event: "screen_frame",
        payload: { frame: dataUrl },
      });
    },
    [channelRef, isConnected],
  );

  const shareScreen = useCallback(
    async (monitorIndex?: number) => {
      clearCaptureLoop();
      activeMonitorRef.current = monitorIndex;
      setShareError(null);

      try {
        await broadcastFrame(monitorIndex);
        setIsSharing(true);

        intervalRef.current = setInterval(() => {
          void broadcastFrame(activeMonitorRef.current).catch((error) => {
            clearCaptureLoop();
            setIsSharing(false);
            setRemoteFrame(null);
            setShareError(
              error instanceof Error ? error.message : "Screen sharing stopped unexpectedly",
            );

            const channel = channelRef.current;
            if (channel && isConnected) {
              void channel.send({
                type: "broadcast",
                event: "screen_frame",
                payload: { frame: null },
              });
            }
          });
        }, CAPTURE_INTERVAL_MS);

        return true;
      } catch (error) {
        clearCaptureLoop();
        setIsSharing(false);
        setShareError(
          error instanceof Error ? error.message : "Failed to start screen sharing",
        );
        return false;
      }
    },
    [broadcastFrame, channelRef, clearCaptureLoop, isConnected],
  );

  const stopSharing = useCallback(() => {
    clearCaptureLoop();
    const channel = channelRef.current;
    if (channel && isConnected) {
      void channel.send({
        type: "broadcast",
        event: "screen_frame",
        payload: { frame: null },
      });
    }
    setIsSharing(false);
    setRemoteFrame(null);
    setShareError(null);
  }, [channelRef, clearCaptureLoop, isConnected]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !isConnected || registeredRef.current) return;

    channel.on("broadcast", { event: "screen_frame" }, ({ payload }) => {
      setRemoteFrame((payload as { frame: string | null }).frame);
    });
    registeredRef.current = true;

    return () => {
      registeredRef.current = false;
    };
  }, [channelRef, isConnected]);

  useEffect(() => {
    if (!isConnected && isSharing) {
      stopSharing();
    }
  }, [isConnected, isSharing, stopSharing]);

  useEffect(() => {
    return () => {
      clearCaptureLoop();
    };
  }, [clearCaptureLoop]);

  return {
    isSharing,
    remoteFrame,
    shareError,
    shareScreen,
    stopSharing,
  };
}
