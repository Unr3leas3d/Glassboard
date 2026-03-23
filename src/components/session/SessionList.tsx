// src/components/session/SessionList.tsx
import type { ActiveSessionGroup, SessionParticipant } from "../../hooks/useActiveSessions";

interface SessionListProps {
  groups: ActiveSessionGroup[];
  loading: boolean;
  userId: string;
  onJoin: (sessionId: string) => Promise<unknown>;
}

export function SessionList({ groups, loading, userId, onJoin }: SessionListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        No active sessions across your organizations
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.org.id} className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {group.org.name}
          </div>
          {group.sessions.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">No active sessions</div>
          ) : (
            <div className="space-y-1.5">
              {group.sessions.map((session) => {
                const isParticipant = session.participants.some((p) => p.id === userId);
                return (
                  <SessionCard
                    key={session.id}
                    title={session.title}
                    hostName={session.host.name}
                    participants={session.participants}
                    isParticipant={isParticipant}
                    onJoin={() => onJoin(session.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SessionCard({
  title,
  hostName,
  participants,
  isParticipant,
  onJoin,
}: {
  title: string | null;
  hostName: string;
  participants: SessionParticipant[];
  isParticipant: boolean;
  onJoin: () => void;
}) {
  const displayParticipants = participants.slice(0, 3);
  const overflow = participants.length - 3;

  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-secondary/50"
      style={{ borderLeft: isParticipant ? "3px solid var(--gold)" : "3px solid var(--border)" }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate">
          {title || "Untitled Session"}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Hosted by {hostName}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-3 shrink-0">
        {participants.length > 0 && (
          <div className="flex items-center">
            {displayParticipants.map((p, i) => (
              <div
                key={p.id}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white bg-zinc-600"
                style={{ marginLeft: i > 0 ? -4 : 0 }}
                title={p.name}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </div>
            ))}
            {overflow > 0 && (
              <span className="text-[10px] text-muted-foreground ml-1">+{overflow}</span>
            )}
          </div>
        )}

        <button
          onClick={onJoin}
          className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all"
          style={
            isParticipant
              ? {
                  background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-warm) 100%)",
                  color: "#1A1A1E",
                }
              : {
                  background: "var(--secondary)",
                  color: "var(--gold)",
                  border: "1px solid var(--border)",
                }
          }
        >
          {isParticipant ? "Rejoin" : "Join"}
        </button>
      </div>
    </div>
  );
}
