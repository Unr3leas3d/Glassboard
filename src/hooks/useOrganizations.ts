import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

export interface Organization {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  full_name: string;
}

const CURRENT_ORG_KEY = "glasboard_current_org";

export function useOrganizations(userId: string | undefined) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Load orgs for user
  const loadOrgs = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Glassboard] Failed to load orgs:", error);
      return;
    }

    setOrgs(data ?? []);

    // Restore current org from localStorage
    const savedOrgId = localStorage.getItem(CURRENT_ORG_KEY);
    const saved = data?.find((o) => o.id === savedOrgId);
    if (saved) {
      setCurrentOrgState(saved);
    } else if (data && data.length > 0) {
      setCurrentOrgState(data[0]);
      localStorage.setItem(CURRENT_ORG_KEY, data[0].id);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  // Load members when currentOrg changes
  useEffect(() => {
    if (!currentOrg) {
      setMembers([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("org_members_with_profile")
        .select("*")
        .eq("org_id", currentOrg.id)
        .order("joined_at", { ascending: true });

      if (error) {
        console.error("[Glassboard] Failed to load members:", error);
        return;
      }
      setMembers(data ?? []);
    })();
  }, [currentOrg]);

  const setCurrentOrg = useCallback((org: Organization) => {
    setCurrentOrgState(org);
    localStorage.setItem(CURRENT_ORG_KEY, org.id);
  }, []);

  const createOrg = useCallback(
    async (name: string) => {
      if (!userId) return null;

      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({ name, created_by: userId })
        .select()
        .single();

      if (orgErr || !org) {
        console.error("[Glassboard] Failed to create org:", orgErr);
        return null;
      }

      // Add self as owner
      const { error: memberErr } = await supabase
        .from("org_members")
        .insert({ org_id: org.id, user_id: userId, role: "owner" });

      if (memberErr) {
        console.error("[Glassboard] Failed to add self as owner:", memberErr);
      }

      localStorage.setItem(CURRENT_ORG_KEY, org.id);
      await loadOrgs();
      return org;
    },
    [userId, loadOrgs, setCurrentOrg],
  );

  const inviteMember = useCallback(
    async (_email: string) => {
      if (!currentOrg) return "No organization selected";
      return "Use session join codes to collaborate. Direct email invites coming soon.";
    },
    [currentOrg],
  );

  const renameOrg = useCallback(
    async (orgId: string, newName: string) => {
      const { error } = await supabase
        .from("organizations")
        .update({ name: newName })
        .eq("id", orgId);

      if (error) {
        console.error("[Glassboard] Failed to rename org:", error);
        return { error: error.message };
      }
      await loadOrgs();
      return {};
    },
    [loadOrgs],
  );

  const leaveOrg = useCallback(
    async (orgId: string) => {
      if (!userId) return { error: "Not authenticated" };

      // Check if user is sole owner
      const { data: owners } = await supabase
        .from("org_members")
        .select("id")
        .eq("org_id", orgId)
        .eq("role", "owner");

      const { data: myMembership } = await supabase
        .from("org_members")
        .select("id, role")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .single();

      if (myMembership?.role === "owner" && owners && owners.length <= 1) {
        return { error: "Cannot leave — you are the sole owner. Transfer ownership or delete the org." };
      }

      const { error } = await supabase
        .from("org_members")
        .delete()
        .eq("org_id", orgId)
        .eq("user_id", userId);

      if (error) {
        console.error("[Glassboard] Failed to leave org:", error);
        return { error: error.message };
      }
      await loadOrgs();
      return {};
    },
    [userId, loadOrgs],
  );

  const deleteOrg = useCallback(
    async (orgId: string) => {
      const { error } = await supabase
        .from("organizations")
        .delete()
        .eq("id", orgId);

      if (error) {
        console.error("[Glassboard] Failed to delete org:", error);
        return { error: error.message };
      }
      await loadOrgs();
      return {};
    },
    [loadOrgs],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      const { error } = await supabase
        .from("org_members")
        .delete()
        .eq("id", memberId);

      if (error) {
        console.error("[Glassboard] Failed to remove member:", error);
        return { error: error.message };
      }
      // Re-fetch members
      if (currentOrg) {
        const { data } = await supabase
          .from("org_members_with_profile")
          .select("*")
          .eq("org_id", currentOrg.id)
          .order("joined_at", { ascending: true });
        setMembers(data ?? []);
      }
      return {};
    },
    [currentOrg],
  );

  const updateMemberRole = useCallback(
    async (memberId: string, role: "owner" | "admin" | "member") => {
      const { error } = await supabase
        .from("org_members")
        .update({ role })
        .eq("id", memberId);

      if (error) {
        console.error("[Glassboard] Failed to update member role:", error);
        return { error: error.message };
      }
      // Re-fetch members
      if (currentOrg) {
        const { data } = await supabase
          .from("org_members_with_profile")
          .select("*")
          .eq("org_id", currentOrg.id)
          .order("joined_at", { ascending: true });
        setMembers(data ?? []);
      }
      return {};
    },
    [currentOrg],
  );

  return {
    orgs,
    currentOrg,
    members,
    loading,
    setCurrentOrg,
    createOrg,
    inviteMember,
    renameOrg,
    leaveOrg,
    deleteOrg,
    removeMember,
    updateMemberRole,
    refreshOrgs: loadOrgs,
  };
}
