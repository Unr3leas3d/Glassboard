import type { User } from "@supabase/supabase-js";

/**
 * Extract the best display name from a Supabase User.
 * Prefers user_metadata.full_name (Google OAuth) or name,
 * falls back to the email prefix.
 */
export function getDisplayName(user: User, fallback = "User"): string {
  const meta = user.user_metadata;
  return meta?.full_name ?? meta?.name ?? user.email?.split("@")[0] ?? fallback;
}

/**
 * Extract avatar URL from a Supabase User.
 * Google OAuth populates user_metadata.avatar_url / picture.
 * Returns undefined if no avatar is set.
 */
export function getAvatarUrl(user: User): string | undefined {
  const meta = user.user_metadata;
  return meta?.avatar_url ?? meta?.picture ?? undefined;
}

/**
 * Get up to 2 uppercase initials from a display name.
 */
export function getInitials(displayName: string): string {
  return displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
