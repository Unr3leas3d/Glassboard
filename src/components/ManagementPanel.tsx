import type { User } from "@supabase/supabase-js";
import { WindowTitleBar } from "./WindowTitleBar";
import { UserAvatarMenu } from "./UserAvatarMenu";
import { OrgSwitcher } from "./org/OrgSwitcher";
import { Skeleton } from "./ui/skeleton";
import type { Organization } from "../hooks/useOrganizations";

interface ManagementPanelProps {
  user: User;
  orgs: Organization[];
  currentOrg: Organization | null;
  loading?: boolean;
  onSelectOrg: (org: Organization) => void;
  onSignOut: () => void;
  onOpenSettings: () => void;
  onOpenOrgSettings: () => void;
  children?: React.ReactNode; // session controls slot
}

export function ManagementPanel({
  user,
  orgs,
  currentOrg,
  loading,
  onSelectOrg,
  onSignOut,
  onOpenSettings,
  onOpenOrgSettings,
  children,
}: ManagementPanelProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4"
      style={{
        background: 'var(--background)',
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(193,185,126,0.04) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(140,120,80,0.03) 0%, transparent 50%)',
      }}
    >
      <WindowTitleBar />
      <div className="w-full max-w-[408px] space-y-5 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-foreground tracking-tight">
              Glass<span className="text-[var(--gold)]">board</span>
            </h1>
            <p className="text-[11px] font-medium uppercase text-muted-foreground mt-0.5">
              Collaborative Overlay
            </p>
          </div>
          <UserAvatarMenu user={user} onOpenSettings={onOpenSettings} onSignOut={onSignOut} />
        </div>

        {/* Compact org context row */}
        {loading ? (
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
        ) : orgs.length > 0 ? (
          <div className="flex items-center gap-2">
            <OrgSwitcher orgs={orgs} currentOrg={currentOrg} onSelect={onSelectOrg} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No organization yet.{" "}
            <button
              onClick={onOpenOrgSettings}
              className="text-foreground underline underline-offset-2 hover:no-underline"
            >
              Set up in Settings
            </button>
          </div>
        )}

        {/* Session card */}
        {loading ? (
          <div className="relative bg-card rounded-xl p-5 space-y-4 overflow-hidden"
            style={{ border: '1px solid rgba(193,185,126,0.18)' }}
          >
            <Skeleton className="h-4 w-28" />
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1 rounded-md" />
              <Skeleton className="h-9 w-16 rounded-md" />
            </div>
          </div>
        ) : currentOrg ? (
          <div className="relative bg-card rounded-xl p-6 space-y-4 overflow-hidden"
            style={{
              border: '1px solid rgba(193,185,126,0.18)',
              backgroundImage: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(193,185,126,0.06) 0%, transparent 70%)',
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--gold-dim)]">
              Session
            </p>
            {children}
          </div>
        ) : (
          <div className="bg-card rounded-xl p-5"
            style={{ border: '1px solid rgba(193,185,126,0.18)' }}
          >
            <p className="text-sm text-muted-foreground text-center py-4">
              Create an organization to start collaborating.
            </p>
          </div>
        )}

        {/* Bottom accent */}
        <div className="flex justify-center pt-4">
          <div className="w-[60px] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(193,185,126,0.2), transparent)' }} />
        </div>
      </div>
    </div>
  );
}
