import { useState, useCallback, useEffect } from "react";
import type { RefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { invoke } from "@tauri-apps/api/core";

export function useScreenMirror(
  channelRef: RefObject<RealtimeChannel | null>,
  isConnected: boolean,
) {
  const [isSharing, setIsSharing] = useState(false);
  const [remoteFrame, setRemoteFrame] = useState<string | null>(null);

  // Presenter: capture and broadcast screenshot
  const shareScreen = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !isConnected) return;

    try {
      const dataUrl = await invoke<string>("capture_screen", {
        quality: 70,
        maxWidth: 1920,
      });

      channel.send({
        type: "broadcast",
        event: "screen_frame",
        payload: { frame: dataUrl },
      });

      setIsSharing(true);
    } catch (err) {
      console.error("[Glassboard] Screen capture failed:", err);
    }
  }, [channelRef, isConnected]);

  const stopSharing = useCallback(() => {
    const channel = channelRef.current;
    if (channel && isConnected) {
      channel.send({
        type: "broadcast",
        event: "screen_frame",
        payload: { frame: null },
      });
    }
    setIsSharing(false);
    setRemoteFrame(null);
  }, [channelRef, isConnected]);

  // Auto-listen for screen frames when connected
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !isConnected) return;

    channel.on(
      "broadcast",
      { event: "screen_frame" },
      ({ payload }) => {
        setRemoteFrame((payload as { frame: string | null }).frame);
      },
    );
  }, [channelRef, isConnected]);

  return {
    isSharing,
    remoteFrame,
    shareScreen,
    stopSharing,
  };
}
