import { Button } from "@/components/ui/button";
import type { Session } from "../../hooks/useSessions";

interface SessionBarProps {
  session: Session;
  isHost: boolean;
  onEnd: (sessionId: string) => void;
  onLeave: () => void;
  children?: React.ReactNode;
}

export function SessionBar({ session, isHost, onEnd, onLeave, children }: SessionBarProps) {
  return (
    <div className="glasboard-session-bar">
      <div className="flex items-center gap-3">
        {session.title && (
          <span className="text-sm font-medium text-white truncate max-w-[200px]">
            {session.title}
          </span>
        )}
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
