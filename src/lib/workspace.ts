import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WorkspaceRole = Database["public"]["Enums"]["workspace_role"];
export type MembershipStatus = Database["public"]["Enums"]["membership_status"];
export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type Membership = Database["public"]["Tables"]["workspace_members"]["Row"];

export type MembershipState =
  | { kind: "active"; workspace: Workspace; membership: Membership }
  | { kind: "blocked"; membership: Membership }
  | { kind: "none" };

export async function loadMembershipState(userId: string): Promise<MembershipState> {
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error || !members || members.length === 0) return { kind: "none" };

  const active = members.find((m) => m.status === "active");
  if (!active) return { kind: "blocked", membership: members[0] };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", active.workspace_id)
    .maybeSingle();
  if (!workspace) return { kind: "none" };

  return { kind: "active", workspace, membership: active };
}

export async function createWorkspace(input: {
  name: string;
  ownerFullName: string;
  businessEmail: string;
  phone: string;
  businessType: string;
  country: string;
  timezone: string;
  logoUrl?: string;
}) {
  const { data, error } = await supabase.rpc("create_workspace_with_owner", {
    _name: input.name,
    _business_email: input.businessEmail,
    _phone: input.phone,
    _business_type: input.businessType,
    _country: input.country,
    _timezone: input.timezone,
    _logo_url: input.logoUrl ?? "",
    _owner_full_name: input.ownerFullName,
  });
  if (error) throw error;
  return data as string;
}

export function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "project_manager":
      return "Project Manager";
    case "contractor":
      return "Contractor";
    case "viewer":
      return "Viewer";
  }
}
