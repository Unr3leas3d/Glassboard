import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { OrgSwitcher } from "../org/OrgSwitcher";
import { CreateOrgDialog } from "../org/CreateOrgDialog";
import { MembersList } from "../org/MembersList";
import { InviteMemberDialog } from "../org/InviteMemberDialog";
import type { Organization, OrgMember } from "../../hooks/useOrganizations";

interface OrgTabProps {
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

export function OrgTab({
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
}: OrgTabProps) {
  // Rename state
  const [orgName, setOrgName] = useState(currentOrg?.name ?? "");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameMessage, setRenameMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Danger zone dialogs
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [dangerMessage, setDangerMessage] = useState<{ text: string; error: boolean } | null>(null);

  const currentUserMember = members.find((m) => m.user_id === userId);
  const currentUserRole = currentUserMember?.role;
  const isOwner = currentUserRole === "owner";

  const handleRename = async () => {
    if (!currentOrg || !orgName.trim()) return;
    setRenameSaving(true);
    setRenameMessage(null);
    const result = await onRenameOrg(currentOrg.id, orgName.trim());
    setRenameSaving(false);
    if (result.error) {
      setRenameMessage({ text: result.error, error: true });
    } else {
      setRenameMessage({ text: "Organization renamed", error: false });
    }
  };

  const handleLeave = async () => {
    if (!currentOrg) return;
    setDangerMessage(null);
    const result = await onLeaveOrg(currentOrg.id);
    if (result.error) {
      setDangerMessage({ text: result.error, error: true });
    } else {
      setShowLeaveDialog(false);
    }
  };

  const handleDelete = async () => {
    if (!currentOrg) return;
    setDangerMessage(null);
    const result = await onDeleteOrg(currentOrg.id);
    if (result.error) {
      setDangerMessage({ text: result.error, error: true });
    } else {
      setShowDeleteDialog(false);
      setDeleteConfirmText("");
    }
  };

  // Sync orgName when currentOrg changes
  const handleSelectOrg = (org: Organization) => {
    onSelectOrg(org);
    setOrgName(org.name);
    setRenameMessage(null);
    setDangerMessage(null);
  };

  return (
    <div className="space-y-4">
      <div className="relative bg-card rounded-xl p-5 space-y-5 overflow-hidden"
        style={{ border: '1px solid rgba(193,185,126,0.18)', backgroundImage: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(193,185,126,0.04) 0%, transparent 70%)' }}
      >
        {/* Org selector + create */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--gold-dim)] mb-3">Organization</h2>
          <div className="flex items-center justify-between">
            <OrgSwitcher orgs={orgs} currentOrg={currentOrg} onSelect={handleSelectOrg} />
            <CreateOrgDialog onCreate={onCreateOrg} />
          </div>
          {orgs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Create an organization to start collaborating.
            </p>
          )}
        </div>

        {/* Rename (owner-only) */}
        {currentOrg && isOwner && (
          <>
            <div className="border-t border-border" />
            <div className="space-y-2">
              <Label className="text-muted-foreground">Name</Label>
              <div className="flex gap-2">
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organization name"
                />
                <button
                  onClick={handleRename}
                  disabled={renameSaving || !orgName.trim() || orgName === currentOrg.name}
                  className="shrink-0 h-8 px-3.5 rounded-lg text-[12px] font-semibold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-warm) 100%)', color: '#1A1A1E' }}
                >
                  {renameSaving ? "Saving..." : "Save"}
                </button>
              </div>
              {renameMessage && (
                <p className={`text-xs ${renameMessage.error ? "text-red-400" : "text-green-400"}`}>
                  {renameMessage.text}
                </p>
              )}
            </div>
          </>
        )}

        {/* Members */}
        {currentOrg && (
          <>
            <div className="border-t border-border" />
            <MembersList
              members={members}
              currentUserId={userId}
              currentUserRole={currentUserRole}
              onUpdateRole={onUpdateMemberRole}
              onRemoveMember={onRemoveMember}
            />
            <InviteMemberDialog onInvite={onInviteMember} />
          </>
        )}

        {/* Danger zone */}
        {currentOrg && (
          <>
            <div className="border-t border-red-500/25" />
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-red-400">Danger Zone</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDangerMessage(null);
                    setShowLeaveDialog(true);
                  }}
                >
                  Leave Organization
                </Button>
                {isOwner && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDangerMessage(null);
                      setDeleteConfirmText("");
                      setShowDeleteDialog(true);
                    }}
                  >
                    Delete Organization
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Leave confirmation dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave <strong>{currentOrg?.name}</strong>? You will lose access to all sessions in this organization.
            </DialogDescription>
          </DialogHeader>
          {dangerMessage && (
            <p className={`text-xs ${dangerMessage.error ? "text-red-400" : "text-green-400"}`}>
              {dangerMessage.text}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLeave}>
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All sessions and members will be removed. Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder='Type "DELETE" to confirm'
          />
          {dangerMessage && (
            <p className={`text-xs ${dangerMessage.error ? "text-red-400" : "text-green-400"}`}>
              {dangerMessage.text}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "DELETE"}
              onClick={handleDelete}
            >
              Delete Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
