import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Organization } from "../../hooks/useOrganizations";

interface OrgSwitcherProps {
  orgs: Organization[];
  currentOrg: Organization | null;
  onSelect: (org: Organization) => void;
}

export function OrgSwitcher({ orgs, currentOrg, onSelect }: OrgSwitcherProps) {
  if (orgs.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 py-1 px-3.5 pl-2.5 rounded-full border border-border bg-secondary text-muted-foreground text-[13px] font-medium hover:border-[var(--border)] hover:text-foreground hover:bg-card transition-all cursor-pointer">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] opacity-70 shrink-0" />
          {currentOrg?.name ?? "Select org"}
          <svg
            className="ml-0.5 size-3 opacity-40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => onSelect(org)}
            className={org.id === currentOrg?.id ? "bg-accent text-accent-foreground" : ""}
          >
            {org.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
