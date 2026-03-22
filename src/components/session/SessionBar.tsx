import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Session } from "../../hooks/useSessions";

interface SessionBarProps {
  session: Session;
  isHost: boolean;
  onEnd: (sessionId: string) => void;
  onLeave: () => void;
  children?: React.ReactNode; // participant list slot
}

export function SessionBar({ session, isHost, onEnd, onLeave, children }: SessionBarProps) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(session.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="glasboard-session-bar">
      <div className="flex items-center gap-3">
        {session.title && (
          <span className="text-sm font-medium text-white truncate max-w-[200px]">
            {session.title}
          </span>
        )}

        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
          title="Click to copy join code"
        >
          <span className="tracking-widest">{session.join_code}</span>
          <span className="text-zinc-500">{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>

      {children}

      {isHost ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEnd(session.id)}
          className="border-red-800 text-red-400 hover:bg-red-900/30 hover:text-red-300"
        >
          End Session
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={onLeave}
          className="border-zinc-700 text-zinc-400"
        >
          Leave
        </Button>
      )}
    </div>
  );
}
