// src/components/session/NewSessionForm.tsx
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Organization } from "../../hooks/useOrganizations";

interface NewSessionFormProps {
  orgs: Organization[];
  currentOrg: Organization | null;
  onCreate: (orgId: string, title?: string) => Promise<unknown>;
}

export function NewSessionForm({ orgs, currentOrg, onCreate }: NewSessionFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(currentOrg);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  function handleOpen() {
    setSelectedOrg(currentOrg);
    setTitle("");
    setIsOpen(true);
  }

  function handleCancel() {
    setIsOpen(false);
    setTitle("");
  }

  async function handleSubmit() {
    if (!selectedOrg) return;
    setLoading(true);
    await onCreate(selectedOrg.id, title.trim() || undefined);
    setLoading(false);
    setIsOpen(false);
    setTitle("");
  }

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        disabled={orgs.length === 0}
        className="w-full h-9 rounded-lg border-none text-[13px] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        style={{
          background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-warm) 100%)",
          color: "#1A1A1E",
        }}
      >
        + New Session
      </button>
    );
  }

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ border: "1px solid var(--gold-dim)", background: "var(--card)" }}
    >
      <div className="text-xs font-semibold" style={{ color: "var(--gold)" }}>
        New Session
      </div>

      {/* Org selector */}
      <div className="space-y-1">
        <div className="text-[11px] text-muted-foreground">Organization</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center justify-between h-9 px-3 rounded-md border border-border bg-secondary text-sm text-foreground hover:bg-card transition-colors">
              <span>{selectedOrg?.name ?? "Select org"}</span>
              <svg
                className="size-3 opacity-40"
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
          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
            {orgs.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => setSelectedOrg(org)}
                className={org.id === selectedOrg?.id ? "bg-accent text-accent-foreground" : ""}
              >
                {org.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title input */}
      <div className="space-y-1">
        <div className="text-[11px] text-muted-foreground">Title (optional)</div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Homepage Redesign"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedOrg || loading}
          className="px-4 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{
            background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-warm) 100%)",
            color: "#1A1A1E",
          }}
        >
          {loading ? "Starting..." : "Start Session"}
        </button>
      </div>
    </div>
  );
}
