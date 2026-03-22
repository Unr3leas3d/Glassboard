import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { getDisplayName, getAvatarUrl, getInitials } from "../../utils/displayName";

interface AccountTabProps {
  user: User;
  onUpdateDisplayName: (name: string) => Promise<{ error?: string }>;
  onChangePassword: (password: string) => Promise<{ error?: string }>;
  onDeleteAccount: () => Promise<{ error?: string }>;
}

export function AccountTab({
  user,
  onUpdateDisplayName,
  onChangePassword,
  onDeleteAccount,
}: AccountTabProps) {
  const isOAuth = user.app_metadata?.provider === "google";
  const avatarUrl = getAvatarUrl(user);
  const [imgFailed, setImgFailed] = useState(false);

  // Display name
  const [displayName, setDisplayName] = useState(getDisplayName(user));
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteMessage, setDeleteMessage] = useState<{ text: string; error: boolean } | null>(null);

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    setNameSaving(true);
    setNameMessage(null);
    const result = await onUpdateDisplayName(displayName.trim());
    setNameSaving(false);
    if (result.error) {
      setNameMessage({ text: result.error, error: true });
    } else {
      setNameMessage({ text: "Display name updated", error: false });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordMessage({ text: "Password must be at least 6 characters", error: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: "Passwords do not match", error: true });
      return;
    }
    setPasswordSaving(true);
    setPasswordMessage(null);
    const result = await onChangePassword(newPassword);
    setPasswordSaving(false);
    if (result.error) {
      setPasswordMessage({ text: result.error, error: true });
    } else {
      setPasswordMessage({ text: "Password updated", error: false });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteMessage(null);
    const result = await onDeleteAccount();
    if (result.error) {
      setDeleteMessage({ text: result.error, error: true });
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div className="relative bg-card rounded-xl p-5 space-y-4 overflow-hidden"
        style={{ border: '1px solid rgba(193,185,126,0.18)', backgroundImage: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(193,185,126,0.04) 0%, transparent 70%)' }}
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--gold-dim)]">Profile</h2>

        {/* Avatar (display only) */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-[-4px] rounded-full opacity-60"
              style={{ background: 'conic-gradient(from 45deg, transparent 0%, rgba(193,185,126,0.25) 25%, transparent 50%, rgba(193,185,126,0.25) 75%, transparent 100%)' }}
            />
            {avatarUrl && !imgFailed ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="relative size-16 rounded-full border-2 border-border"
                onError={() => setImgFailed(true)}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="relative size-16 rounded-full border-2 border-border bg-secondary flex items-center justify-center text-lg font-medium text-muted-foreground">
                {getInitials(getDisplayName(user))}
              </div>
            )}
          </div>
        </div>

        {/* Display name */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Display name</Label>
          <div className="flex gap-2">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
            <button
              onClick={handleSaveName}
              disabled={nameSaving || !displayName.trim()}
              className="shrink-0 h-8 px-3.5 rounded-lg text-[12px] font-semibold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-warm) 100%)', color: '#1A1A1E' }}
            >
              {nameSaving ? "Saving..." : "Save"}
            </button>
          </div>
          {nameMessage && (
            <p className={`text-xs ${nameMessage.error ? "text-red-400" : "text-green-400"}`}>
              {nameMessage.text}
            </p>
          )}
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Email</Label>
          <Input value={user.email ?? ""} disabled className="opacity-50" />
        </div>
      </div>

      {/* Security card */}
      <div className="relative bg-card rounded-xl p-5 space-y-4 overflow-hidden"
        style={{ border: '1px solid rgba(193,185,126,0.18)', backgroundImage: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(193,185,126,0.04) 0%, transparent 70%)' }}
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--gold-dim)]">Security</h2>

        {isOAuth ? (
          <p className="text-sm text-muted-foreground">
            Your password is managed by Google. Sign in with Google to access your account.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-muted-foreground">New password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Confirm password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={passwordSaving || !newPassword}
              className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-warm) 100%)', color: '#1A1A1E' }}
            >
              {passwordSaving ? "Updating..." : "Change Password"}
            </button>
            {passwordMessage && (
              <p className={`text-xs ${passwordMessage.error ? "text-red-400" : "text-green-400"}`}>
                {passwordMessage.text}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-card border border-red-500/25 rounded-xl p-5 space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-red-400 dark:text-red-400">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
        >
          Delete Account
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder='Type "DELETE" to confirm'
          />
          {deleteMessage && (
            <p className={`text-xs ${deleteMessage.error ? "text-red-400" : "text-green-400"}`}>
              {deleteMessage.text}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "DELETE"}
              onClick={handleDeleteAccount}
            >
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
