import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WorkspaceRole = Database["public"]["Enums"]["workspace_role"];
export type MembershipStatus = Database["public"]["Enums"]["membership_status"];
export type InvitationStatus = "pending" | "accepted" | "cancelled" | "expired";

export interface TeamMember {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  joined_at: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  message: string | null;
  expires_at: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  target_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function fetchTeamMembers(workspaceId: string): Promise<TeamMember[]> {
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, status, joined_at")
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (members ?? []).map((m) => {
    const p = byId.get(m.user_id);
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      joined_at: m.joined_at,
      full_name: p?.full_name ?? null,
      email: p?.email ?? null,
      avatar_url: p?.avatar_url ?? null,
    };
  });
}

export async function fetchInvitations(workspaceId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("workspace_invitations")
    .select("id, email, role, status, message, expires_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invitation[];
}

export async function fetchAuditLog(workspaceId: string, limit = 20): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("workspace_audit_log")
    .select("id, action, actor_user_id, target_user_id, target_email, metadata, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}

export async function inviteMember(input: {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  message?: string;
}): Promise<{ invitation_id: string; token: string }> {
  const { data, error } = await supabase.rpc("invite_workspace_member", {
    _workspace_id: input.workspaceId,
    _email: input.email,
    _role: input.role,
    _message: input.message ?? "",
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { invitation_id: string; token: string };
}

export async function resendInvitation(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("resend_workspace_invitation", { _invitation_id: id });
  if (error) throw error;
  return data as unknown as string;
}

export async function cancelInvitation(id: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_workspace_invitation", { _invitation_id: id });
  if (error) throw error;
}

export async function changeMemberRole(memberId: string, role: WorkspaceRole): Promise<void> {
  const { error } = await supabase.rpc("update_workspace_member_role", {
    _member_id: memberId,
    _new_role: role,
  });
  if (error) throw error;
}

export async function setMemberStatus(memberId: string, status: MembershipStatus): Promise<void> {
  const { error } = await supabase.rpc("set_workspace_member_status", {
    _member_id: memberId,
    _status: status,
  });
  if (error) throw error;
}

export async function previewInvitation(token: string) {
  const { data, error } = await supabase.rpc("preview_workspace_invitation", { _token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as {
    invitation_id: string;
    workspace_id: string;
    workspace_name: string;
    email: string;
    role: WorkspaceRole;
    status: string;
    expires_at: string;
  } | null;
}

export async function acceptInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_workspace_invitation", { _token: token });
  if (error) throw error;
  return data as unknown as string;
}

export function inviteLink(token: string): string {
  if (typeof window === "undefined") return `/accept-invite?token=${token}`;
  return `${window.location.origin}/accept-invite?token=${token}`;
}

export function humanAction(action: string): string {
  const map: Record<string, string> = {
    "member.invited": "invited a member",
    "invitation.accepted": "accepted an invitation",
    "invitation.resent": "resent an invitation",
    "invitation.cancelled": "cancelled an invitation",
    "member.role_changed": "changed a member's role",
    "member.suspended": "suspended a member",
    "member.reactivated": "reactivated a member",
    "member.removed": "removed a member",
  };
  return map[action] ?? action;
}
