import type { PresenceUser } from "../../hooks/usePresence";

interface ParticipantListProps {
  participants: PresenceUser[];
  maxVisible?: number;
}

export function ParticipantList({ participants, maxVisible = 5 }: ParticipantListProps) {
  if (participants.length === 0) return null;

  const visible = participants.slice(0, maxVisible);
  const overflow = participants.length - maxVisible;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((p) => (
        <div
          key={p.userId}
          className="flex items-center justify-center size-7 rounded-full border-2 border-card text-[10px] font-semibold text-white relative"
          style={{ backgroundColor: p.color }}
          title={`${p.name}${p.isHost ? " (Host)" : ""}`}
        >
          {p.name.slice(0, 2).toUpperCase()}
          {p.isHost && (
            <svg
              className="absolute -top-1 -right-1 size-3 text-amber-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
            </svg>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex items-center justify-center size-7 rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">
          +{overflow}
        </div>
      )}
    </div>
  );
}
