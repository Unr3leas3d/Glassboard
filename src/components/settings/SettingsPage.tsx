import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft } from "lucide-react";
import { WindowTitleBar } from "../WindowTitleBar";
import { AccountTab } from "./AccountTab";
import { AppTab } from "./AppTab";
import { OrgTab } from "./OrgTab";
import type { ThemeMode } from "../../hooks/useTheme";
import type { Organization, OrgMember } from "../../hooks/useOrganizations";

export type SettingsTab = "account" | "organization" | "app";

interface SettingsPageProps {
  user: User;
  onBack: () => void;
  onUpdateDisplayName: (name: string) => Promise<{ error?: string }>;
  onChangePassword: (password: string) => Promise<{ error?: string }>;
  onDeleteAccount: () => Promise<{ error?: string }>;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  initialTab?: SettingsTab;
  // Org props
  userId: string;
  orgs: Organization[];
  currentOrg: Organization | null;
  members: OrgMember[];
  onSelectOrg: (org: Organization) => void;
  onCreateOrg: (name: string) => Promise<unknown>;
  onInviteMember: (email: string) => Promise<string | null>;
  onRenameOrg: (orgId: string, newName: string) => Promise<{ error?: string }>;
  onLeaveOrg: (orgId: string) => Promise<{ error?: string }>;
  onDeleteOrg: (orgId: string) => Promise<{ error?: string }>;
  onRemoveMember: (memberId: string) => Promise<{ error?: string }>;
  onUpdateMemberRole: (memberId: string, role: "owner" | "admin" | "member") => Promise<{ error?: string }>;
}

export function SettingsPage({
  user,
  onBack,
  onUpdateDisplayName,
  onChangePassword,
  onDeleteAccount,
  theme,
  setTheme,
  initialTab = "account",
  userId,
  orgs,
  currentOrg,
  members,
  onSelectOrg,
  onCreateOrg,
  onInviteMember,
  onRenameOrg,
  onLeaveOrg,
  onDeleteOrg,
  onRemoveMember,
  onUpdateMemberRole,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="h-screen bg-background overflow-y-auto p-4"
      style={{
        background: 'var(--background)',
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(193,185,126,0.04) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(140,120,80,0.03) 0%, transparent 50%)',
      }}
    >
      <WindowTitleBar />
      <div className="w-full max-w-md mx-auto space-y-6 pt-10 pb-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-card rounded-lg p-1">
          <TabButton
            active={activeTab === "account"}
            onClick={() => setActiveTab("account")}
          >
            Account
          </TabButton>
          <TabButton
            active={activeTab === "organization"}
            onClick={() => setActiveTab("organization")}
          >
            Organization
          </TabButton>
          <TabButton
            active={activeTab === "app"}
            onClick={() => setActiveTab("app")}
          >
            App
          </TabButton>
        </div>

        {/* Tab content */}
        {activeTab === "account" ? (
          <AccountTab
            user={user}
            onUpdateDisplayName={onUpdateDisplayName}
            onChangePassword={onChangePassword}
            onDeleteAccount={onDeleteAccount}
          />
        ) : activeTab === "organization" ? (
          <OrgTab
            userId={userId}
            orgs={orgs}
            currentOrg={currentOrg}
            members={members}
            onSelectOrg={onSelectOrg}
            onCreateOrg={onCreateOrg}
            onInviteMember={onInviteMember}
            onRenameOrg={onRenameOrg}
            onLeaveOrg={onLeaveOrg}
            onDeleteOrg={onDeleteOrg}
            onRemoveMember={onRemoveMember}
            onUpdateMemberRole={onUpdateMemberRole}
          />
        ) : (
          <AppTab theme={theme} setTheme={setTheme} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {active && (
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full opacity-60"
          style={{ background: 'var(--gold)' }}
        />
      )}
    </button>
  );
}
