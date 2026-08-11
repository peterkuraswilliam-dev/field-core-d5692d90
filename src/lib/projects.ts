import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { WorkspaceRole } from "@/lib/workspace";

export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];

export const PROJECT_STATUSES: ProjectStatus[] = [
  "enquiry",
  "quote_required",
  "quote_sent",
  "approved",
  "scheduled",
  "in_progress",
  "waiting",
  "completed",
  "cancelled",
];

export function statusLabel(s: ProjectStatus): string {
  switch (s) {
    case "enquiry":
      return "Enquiry";
    case "quote_required":
      return "Quote Required";
    case "quote_sent":
      return "Quote Sent";
    case "approved":
      return "Approved";
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In Progress";
    case "waiting":
      return "Waiting";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

export function statusTone(s: ProjectStatus): string {
  switch (s) {
    case "enquiry":
    case "quote_required":
    case "quote_sent":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "approved":
    case "scheduled":
      return "bg-gold/15 text-gold border-gold/30";
    case "in_progress":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "waiting":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "completed":
      return "bg-muted text-muted-foreground border-border";
    case "cancelled":
      return "bg-destructive/15 text-destructive border-destructive/30";
  }
}

export const NEEDS_ATTENTION_STATUSES: ProjectStatus[] = ["enquiry", "quote_required", "waiting"];

export function canCreateProjects(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "project_manager";
}

export function hasWorkspaceWideAccess(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

export interface ProjectListItem extends Project {
  assigned_count: number;
  assigned_names: string[];
}

export async function fetchProjects(workspaceId: string): Promise<ProjectListItem[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Project[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: pm } = await supabase
    .from("project_members")
    .select("project_id, user_id")
    .in("project_id", ids);
  const userIds = Array.from(new Set((pm ?? []).map((m) => m.user_id)));
  const { data: profs } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const nameById = new Map(
    (profs ?? []).map((p) => [p.id, p.full_name?.trim() || p.email?.split("@")[0] || "Member"]),
  );
  const byProject = new Map<string, string[]>();
  for (const m of pm ?? []) {
    const list = byProject.get(m.project_id) ?? [];
    list.push(nameById.get(m.user_id) ?? "Member");
    byProject.set(m.project_id, list);
  }
  return rows.map((r) => {
    const names = byProject.get(r.id) ?? [];
    return { ...r, assigned_count: names.length, assigned_names: names };
  });
}

export async function fetchProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export interface ProjectMemberRow {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  workspace_role: WorkspaceRole;
  status: Database["public"]["Enums"]["membership_status"];
}

export async function fetchProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  const { data: pm, error } = await supabase
    .from("project_members")
    .select("id, user_id")
    .eq("project_id", projectId);
  if (error) throw error;
  if (!pm || pm.length === 0) return [];

  const userIds = pm.map((m) => m.user_id);
  const proj = await supabase
    .from("projects")
    .select("workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  const wsId = proj.data?.workspace_id;

  const [{ data: profiles }, { data: wm }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds),
    wsId
      ? supabase
          .from("workspace_members")
          .select("user_id, role, status")
          .eq("workspace_id", wsId)
          .in("user_id", userIds)
      : Promise.resolve({ data: [] }),
  ]);
  const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const wmById = new Map((wm ?? []).map((m) => [m.user_id, m]));

  return pm.map((row) => {
    const p = profById.get(row.user_id);
    const w = wmById.get(row.user_id);
    return {
      id: row.id,
      user_id: row.user_id,
      full_name: p?.full_name ?? null,
      email: p?.email ?? null,
      avatar_url: p?.avatar_url ?? null,
      workspace_role: (w?.role ?? "viewer") as WorkspaceRole,
      status: (w?.status ?? "removed") as Database["public"]["Enums"]["membership_status"],
    };
  });
}

export interface CreateProjectInput {
  workspace_id: string;
  name: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  job_address?: string;
  description?: string;
  status: ProjectStatus;
  start_date?: string | null;
  expected_completion_date?: string | null;
  created_by: string;
  assigned_user_ids?: string[];
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { assigned_user_ids, ...cols } = input;
  const projectId = crypto.randomUUID();
  const clean = {
    ...cols,
    id: projectId,
    customer_name: cols.customer_name || null,
    customer_email: cols.customer_email || null,
    customer_phone: cols.customer_phone || null,
    job_address: cols.job_address || null,
    description: cols.description || null,
    start_date: cols.start_date || null,
    expected_completion_date: cols.expected_completion_date || null,
  };
  const { error } = await supabase.from("projects").insert(clean);
  if (error) throw error;

  const memberIds = Array.from(new Set([input.created_by, ...(assigned_user_ids ?? [])]));
  await setProjectMembers(projectId, memberIds);

  const project = await fetchProject(projectId);
  if (!project) throw new Error("The project was created but could not be loaded");
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<Omit<Project, "id" | "workspace_id" | "created_by" | "created_at" | "updated_at">>,
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setProjectMembers(projectId: string, userIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("set_project_members", {
    _project_id: projectId,
    _user_ids: userIds,
  });
  if (error) throw error;
}
