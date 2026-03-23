// src/components/DockIcon.tsx
import type { LucideIcon } from "lucide-react";

interface DockIconProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  variant?: "default" | "active" | "screenshot";
  badge?: number;
  onClick: () => void;
  title?: string;
}

export function DockIcon({
  icon: Icon,
  label,
  active = false,
  variant = "default",
  badge,
  onClick,
  title,
}: DockIconProps) {
  const stateClass =
    variant === "active" || active
      ? "glasboard-bottom-bar--active"
      : variant === "screenshot"
        ? "glasboard-bottom-bar--screenshot-on"
        : "glasboard-bottom-bar--idle";

  return (
    <button
      className={`glasboard-bottom-bar ${stateClass}`}
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      aria-pressed={active}
      style={{ position: "relative" }}
    >
      <Icon size={18} />
      {badge != null && badge > 0 && (
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: badge > 9 ? 16 : 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: "#ef4444",
            fontSize: 8,
            fontWeight: 700,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
