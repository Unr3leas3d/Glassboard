import { useState, useEffect, useCallback } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { SessionBar } from "../../components/session/SessionBar";
import { ParticipantList } from "../../components/session/ParticipantList";
import { EVENTS } from "../../types/events";
import type { SessionBarPayload, OverlayStatePayload } from "../../types/events";
import type { Session } from "../../hooks/useSessions";
import type { PresenceUser } from "../../hooks/usePresence";

function readPayload(): SessionBarPayload {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("payload");
  if (!raw) throw new Error("No payload in sessionbar URL");
  return JSON.parse(atob(raw));
}

export function SessionBarApp() {
  const [payload] = useState<SessionBarPayload>(readPayload);
  const [session] = useState<Session>(payload.session);
  const [isHost] = useState(payload.isHost);
  const [participants, setParticipants] = useState<PresenceUser[]>(payload.participants);

  // Listen for state updates from overlay
  useEffect(() => {
    const unlisten = listen<OverlayStatePayload>(EVENTS.OVERLAY_STATE, (e) => {
      setParticipants(e.payload.participants);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleEnd = useCallback(
    (sessionId: string) => emit(EVENTS.UI_END_SESSION, { sessionId }),
    [],
  );
  const handleLeave = useCallback(() => emit(EVENTS.UI_LEAVE_SESSION), []);

  return (
    <SessionBar session={session} isHost={isHost} onEnd={handleEnd} onLeave={handleLeave}>
      <ParticipantList participants={participants} />
    </SessionBar>
  );
}
