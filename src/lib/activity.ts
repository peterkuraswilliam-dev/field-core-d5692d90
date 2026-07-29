import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProjectActivity = Database["public"]["Tables"]["project_activity"]["Row"];

export interface ActivityEntry extends ProjectActivity {
  actor_name: string | null;
  target_name: string | null;
}

export function humanActivity(action: string): string {
  switch (action) {
    case "project.created":
      return "created the project";
    case "project.updated":
      return "updated project details";
    case "project.status_changed":
      return "changed status";
    case "member.assigned":
      return "assigned a team member";
    case "member.removed":
      return "removed a team member";
    case "task.created":
      return "created a task";
    case "task.assigned":
      return "assigned a task";
    case "task.status_changed":
      return "updated a task status";
    case "task.completed":
      return "completed a task";
    case "note.added":
      return "added a note";
    case "note.edited":
      return "edited a note";
    case "note.deleted":
      return "deleted a note";
    default:
      return action.replace(/[._]/g, " ");
  }
}

export async function fetchProjectActivity(
  projectId: string,
  limit = 100,
): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from("project_activity")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return enrich((data ?? []) as ProjectActivity[]);
}

export async function fetchWorkspaceActivity(
  workspaceId: string,
  limit = 5,
): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from("project_activity")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return enrich((data ?? []) as ProjectActivity[]);
}

async function enrich(rows: ProjectActivity[]): Promise<ActivityEntry[]> {
  if (rows.length === 0) return [];
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.actor_user_id) ids.add(r.actor_user_id);
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    for (const key of ["user_id", "assigned_to", "previous"]) {
      const v = meta[key];
      if (typeof v === "string") ids.add(v);
    }
  }
  const { data: profs } = ids.size
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", Array.from(ids))
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const byId = new Map((profs ?? []).map((p) => [p.id, p]));
  const nameOf = (id: string | null | undefined) => {
    if (!id) return null;
    const p = byId.get(id);
    return p ? p.full_name?.trim() || p.email?.split("@")[0] || "Member" : null;
  };
  return rows.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const target =
      (typeof meta.user_id === "string" && meta.user_id) ||
      (typeof meta.assigned_to === "string" && meta.assigned_to) ||
      null;
    return {
      ...r,
      actor_name: nameOf(r.actor_user_id),
      target_name: nameOf(target),
    };
  });
}
