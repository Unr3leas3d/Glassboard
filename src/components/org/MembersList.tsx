import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrgMember } from "../../hooks/useOrganizations";

interface MembersListProps {
  members: OrgMember[];
  currentUserId: string;
  currentUserRole?: "owner" | "admin" | "member";
  onUpdateRole?: (memberId: string, role: "owner" | "admin" | "member") => Promise<{ error?: string }>;
  onRemoveMember?: (memberId: string) => Promise<{ error?: string }>;
}

const roleBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
};

const roleOptions: ("owner" | "admin" | "member")[] = ["owner", "admin", "member"];

export function MembersList({
  members,
  currentUserId,
  currentUserRole,
  onUpdateRole,
  onRemoveMember,
}: MembersListProps) {
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No members yet.</p>;
  }

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Members</h3>
      <ul className="space-y-1.5">
        {members.map((m) => {
          const isSelf = m.user_id === currentUserId;
          const showControls = canManage && !isSelf && onUpdateRole && onRemoveMember;

          return (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
            >
              <span className="text-foreground truncate">
                {isSelf ? "You" : m.full_name.split(" ")[0]}
              </span>
              <div className="flex items-center gap-2">
                {showControls ? (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-xs px-2 py-0.5 rounded border border-border hover:bg-accent transition-colors">
                          {m.role}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {roleOptions.map((role) => (
                          <DropdownMenuItem
                            key={role}
                            onClick={() => onUpdateRole(m.id, role)}
                            className={role === m.role ? "bg-accent" : ""}
                          >
                            {role}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      onClick={() => onRemoveMember(m.id)}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <Badge variant={roleBadgeVariant[m.role] ?? "outline"} className="text-xs">
                    {m.role}
                  </Badge>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
