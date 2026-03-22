import { useRef, useCallback, useEffect, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useSessionChannel } from "../../hooks/useSessionChannel";
import { useRealtimeAnnotations } from "../../hooks/useRealtimeAnnotations";
import { useRealtimeCursors } from "../../hooks/useRealtimeCursors";
import { usePresence } from "../../hooks/usePresence";
import { RemoteCursorsOverlay } from "../../components/RemoteCursorsOverlay";
import { ScreenMirrorView } from "../../components/ScreenMirrorView";
import { TestExcalidrawCanvas } from "./TestExcalidrawCanvas";
import type { Session } from "../../hooks/useSessions";

interface TestUserSessionProps {
  session: Session;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  onLeave: () => void;
}

export function TestUserSession({ session, userId, userName, userAvatarUrl, onLeave }: TestUserSessionProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const isHost = session.host_id === userId;

  const { channel, isConnected } = useSessionChannel(session.id);
  const { broadcastChanges } = useRealtimeAnnotations(channel, apiRef, isConnected);
  const { cursors } = useRealtimeCursors(channel, isConnected, userId, userName, userAvatarUrl);
  const { participants } = usePresence(channel, isConnected, userId, userName, isHost);

  // Inline screen_frame listener (receive-only, no Tauri invoke needed)
  const [remoteFrame, setRemoteFrame] = useState<string | null>(null);
  useEffect(() => {
    const ch = channel.current;
    if (!ch || !isConnected) return;

    ch.on("broadcast", { event: "screen_frame" }, ({ payload }) => {
      setRemoteFrame((payload as { frame: string | null }).frame);
    });
  }, [channel, isConnected]);

  const handleSceneChange = useCallback(
    (elements: readonly unknown[]) => {
      if (isConnected) {
        broadcastChanges(elements as readonly { id: string; version: number }[]);
      }
    },
    [isConnected, broadcastChanges],
  );

  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 260,
          minWidth: 260,
          background: "#0a0a0f",
          borderRight: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          flexDirection: "column",
          padding: 16,
          gap: 16,
          overflow: "auto",
        }}
      >
        {/* Connection status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isConnected ? "#22c55e" : "#ef4444",
            }}
          />
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
            {isConnected ? "Connected" : "Connecting..."}
          </span>
        </div>

        {/* Session info */}
        <div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4 }}>
            JOIN CODE
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 20,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: 3,
            }}
          >
            {session.join_code}
          </div>
          {session.title && (
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>
              {session.title}
            </div>
          )}
        </div>

        {/* Participants */}
        <div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 8 }}>
            PARTICIPANTS ({participants.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {participants.map((p) => (
              <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: p.color,
                  }}
                />
                <span style={{ color: "#fff", fontSize: 13 }}>
                  {p.name}
                  {p.isHost && (
                    <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>(host)</span>
                  )}
                  {p.userId === userId && (
                    <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>(you)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Leave button */}
        <div style={{ marginTop: "auto" }}>
          <button
            onClick={onLeave}
            style={{
              width: "100%",
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid rgba(239,68,68,0.4)",
              background: "transparent",
              color: "#ef4444",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Leave Session
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, position: "relative" }}>
        {remoteFrame && <ScreenMirrorView frameUrl={remoteFrame} />}
        <TestExcalidrawCanvas apiRef={apiRef} onSceneChange={handleSceneChange} />
        <RemoteCursorsOverlay cursors={cursors} />
      </div>
    </div>
  );
}
