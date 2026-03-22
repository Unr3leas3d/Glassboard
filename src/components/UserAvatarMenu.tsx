import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Settings, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { getDisplayName, getAvatarUrl, getInitials } from "../utils/displayName";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

interface UserAvatarMenuProps {
  user: User;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export function UserAvatarMenu({ user, onOpenSettings, onSignOut }: UserAvatarMenuProps) {
  const displayName = getDisplayName(user);
  const avatarUrl = getAvatarUrl(user);
  const initials = getInitials(displayName);
  const [imgFailed, setImgFailed] = useState(false);
  const isOnline = useOnlineStatus();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring size-10 relative group">
          {avatarUrl && !imgFailed ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="size-10 rounded-full border-[1.5px] border-border group-hover:border-[rgba(193,185,126,0.3)] transition-all group-hover:shadow-[0_0_20px_rgba(193,185,126,0.12)]"
              onError={() => setImgFailed(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="size-10 rounded-full bg-secondary border-[1.5px] border-border group-hover:border-[rgba(193,185,126,0.3)] transition-all flex items-center justify-center text-sm font-semibold text-muted-foreground group-hover:text-[var(--gold)] group-hover:shadow-[0_0_20px_rgba(193,185,126,0.12)]">
              {initials}
            </div>
          )}
          {/* Connection status dot */}
          <span
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[2px] w-[7px] h-[7px] rounded-full border-[1.5px] border-background ${
              isOnline ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium text-foreground">{displayName}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenSettings}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
