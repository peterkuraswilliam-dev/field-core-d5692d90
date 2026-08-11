import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type ProjectTask = Database["public"]["Tables"]["project_tasks"]["Row"];

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "completed"];
export const TASK_PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

export function taskStatusLabel(s: TaskStatus): string {
  switch (s) {
    case "todo":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "blocked":
      return "Blocked";
    case "completed":
      return "Completed";
  }
}

export function taskStatusTone(s: TaskStatus): string {
  switch (s) {
    case "todo":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "in_progress":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "blocked":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "completed":
      return "bg-muted text-muted-foreground border-border";
  }
}

export function taskPriorityLabel(p: TaskPriority): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function taskPriorityTone(p: TaskPriority): string {
  switch (p) {
    case "low":
      return "text-muted-foreground";
    case "normal":
      return "text-foreground/80";
    case "high":
      return "text-amber-300";
    case "urgent":
      return "text-destructive";
  }
}

export interface TaskWithAssignee extends ProjectTask {
  assignee_name: string | null;
  assignee_avatar: string | null;
  creator_name: string | null;
}

export async function fetchProjectTasks(projectId: string): Promise<TaskWithAssignee[]> {
  const { data, error } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ProjectTask[];
  return enrichTasks(rows);
}

export async function fetchTasksAssignedTo(
  workspaceId: string,
  userId: string,
): Promise<TaskWithAssignee[]> {
  const { data, error } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("assigned_to", userId)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return enrichTasks((data ?? []) as ProjectTask[]);
}

export async function fetchWorkspaceTaskStats(
  workspaceId: string,
  userId: string,
): Promise<{
  dueToday: number;
  overdue: number;
  mine: number;
  recentCompleted: TaskWithAssignee[];
}> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [todayRes, overdueRes, mineRes, completedRes] = await Promise.all([
    supabase
      .from("project_tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .neq("status", "completed")
      .eq("due_date", todayStr),
    supabase
      .from("project_tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .neq("status", "completed")
      .lt("due_date", todayStr),
    supabase
      .from("project_tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("assigned_to", userId)
      .neq("status", "completed"),
    supabase
      .from("project_tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(3),
  ]);
  return {
    dueToday: todayRes.count ?? 0,
    overdue: overdueRes.count ?? 0,
    mine: mineRes.count ?? 0,
    recentCompleted: await enrichTasks((completedRes.data ?? []) as ProjectTask[]),
  };
}

async function enrichTasks(rows: ProjectTask[]): Promise<TaskWithAssignee[]> {
  if (rows.length === 0) return [];
  const userIds = Array.from(
    new Set(
      rows.flatMap((r) => [r.assigned_to, r.created_by]).filter((v): v is string => Boolean(v)),
    ),
  );
  const { data: profs } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds)
    : {
        data: [] as {
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
        }[],
      };
  const byId = new Map((profs ?? []).map((p) => [p.id, p]));
  const nameOf = (id: string | null) => {
    if (!id) return null;
    const p = byId.get(id);
    return p ? p.full_name?.trim() || p.email?.split("@")[0] || "Member" : null;
  };
  return rows.map((r) => ({
    ...r,
    assignee_name: nameOf(r.assigned_to),
    assignee_avatar: r.assigned_to ? (byId.get(r.assigned_to)?.avatar_url ?? null) : null,
    creator_name: nameOf(r.created_by),
  }));
}

export interface CreateTaskInput {
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  assigned_to?: string | null;
  created_by: string;
}

export async function createTask(input: CreateTaskInput): Promise<ProjectTask> {
  const payload = {
    project_id: input.project_id,
    workspace_id: "00000000-0000-0000-0000-000000000000", // overwritten by trigger
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: input.status,
    priority: input.priority,
    due_date: input.due_date || null,
    assigned_to: input.assigned_to || null,
    created_by: input.created_by,
  };
  const { data, error } = await supabase.from("project_tasks").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const { error } = await supabase.from("project_tasks").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function updateTask(
  id: string,
  patch: Partial<
    Pick<ProjectTask, "title" | "description" | "status" | "priority" | "due_date" | "assigned_to">
  >,
): Promise<void> {
  const { error } = await supabase.from("project_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("project_tasks").delete().eq("id", id);
  if (error) throw error;
}
