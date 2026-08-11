import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchProjectPhotos, type PhotoWithMeta } from "@/lib/photos";
import { fetchProjectTasks, type TaskWithAssignee } from "@/lib/tasks";

type ProgressUpdateRow = Database["public"]["Tables"]["project_progress_updates"]["Row"];

export interface ProgressCorrection {
  id: string;
  note: string;
  created_by: string;
  created_at: string;
  author_name?: string | null;
}

export interface ProgressUpdate {
  id: string;
  workspace_id: string;
  project_id: string;
  summary: string;
  issues: string | null;
  work_date: string;
  created_by: string;
  locked_at: string;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  project_name?: string | null;
  photos: PhotoWithMeta[];
  tasks: TaskWithAssignee[];
  corrections: ProgressCorrection[];
}

async function decorateUpdates(rows: ProgressUpdateRow[]): Promise<ProgressUpdate[]> {
  if (!rows.length) return [];
  const updateIds = rows.map((row) => row.id);
  const userIds = Array.from(new Set(rows.map((row) => row.created_by)));
  const projectIds = Array.from(new Set(rows.map((row) => row.project_id)));
  const [
    { data: profiles },
    { data: projects },
    { data: photoLinks },
    { data: taskLinks },
    { data: corrections },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", userIds),
    supabase.from("projects").select("id, name").in("id", projectIds),
    supabase
      .from("project_progress_update_photos")
      .select("update_id, photo_id")
      .in("update_id", updateIds),
    supabase
      .from("project_progress_update_tasks")
      .select("update_id, task_id")
      .in("update_id", updateIds),
    supabase
      .from("project_progress_corrections")
      .select("*")
      .in("update_id", updateIds)
      .order("created_at"),
  ]);

  const profileIds = Array.from(new Set((corrections ?? []).map((c) => c.created_by)));
  const { data: correctionProfiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
    : { data: [] };
  const names = new Map(
    [...(profiles ?? []), ...(correctionProfiles ?? [])].map((p) => [
      p.id,
      p.full_name?.trim() || p.email?.split("@")[0] || "Member",
    ]),
  );
  const projectNames = new Map((projects ?? []).map((p) => [p.id, p.name]));

  const photosByProject = new Map<string, PhotoWithMeta[]>();
  const tasksByProject = new Map<string, TaskWithAssignee[]>();
  await Promise.all(
    projectIds.map(async (projectId) => {
      const [photos, tasks] = await Promise.all([
        fetchProjectPhotos(projectId as string),
        fetchProjectTasks(projectId as string),
      ]);
      photosByProject.set(projectId as string, photos);
      tasksByProject.set(projectId as string, tasks);
    }),
  );

  return rows.map((row) => {
    const photoIds = new Set(
      (photoLinks ?? []).filter((l) => l.update_id === row.id).map((l) => l.photo_id),
    );
    const taskIds = new Set(
      (taskLinks ?? []).filter((l) => l.update_id === row.id).map((l) => l.task_id),
    );
    return {
      ...row,
      author_name: names.get(row.created_by) ?? null,
      project_name: projectNames.get(row.project_id) ?? null,
      photos: (photosByProject.get(row.project_id) ?? []).filter((p) => photoIds.has(p.id)),
      tasks: (tasksByProject.get(row.project_id) ?? []).filter((t) => taskIds.has(t.id)),
      corrections: (corrections ?? [])
        .filter((c) => c.update_id === row.id)
        .map((c) => ({ ...c, author_name: names.get(c.created_by) ?? null })),
    } as ProgressUpdate;
  });
}

export async function fetchProjectProgressUpdates(projectId: string): Promise<ProgressUpdate[]> {
  await supabase.rpc("sync_progress_update_locks", { _project_id: projectId });
  const { data, error } = await supabase
    .from("project_progress_updates")
    .select("*")
    .eq("project_id", projectId)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return decorateUpdates(data ?? []);
}

export async function fetchRecentProgressUpdates(
  workspaceId: string,
  limit = 5,
): Promise<ProgressUpdate[]> {
  await supabase.rpc("sync_progress_update_locks", { _project_id: null });
  const { data, error } = await supabase
    .from("project_progress_updates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return decorateUpdates(data ?? []);
}

export async function fetchProgressStats(workspaceId: string, visibleProjectIds: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const recentCutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ count: todayCount }, { data: recentRows }, recent] = await Promise.all([
    supabase
      .from("project_progress_updates")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("work_date", today),
    supabase
      .from("project_progress_updates")
      .select("project_id")
      .eq("workspace_id", workspaceId)
      .gte("created_at", recentCutoff),
    fetchRecentProgressUpdates(workspaceId, 4),
  ]);
  const recentProjectIds = new Set((recentRows ?? []).map((row) => row.project_id));
  return {
    today: todayCount ?? 0,
    withoutRecent: visibleProjectIds.filter((id) => !recentProjectIds.has(id)).length,
    recent,
  };
}

export async function submitProgressUpdate(input: {
  projectId: string;
  summary: string;
  issues?: string;
  workDate: string;
  photoIds: string[];
  taskIds: string[];
}) {
  const { data, error } = await supabase.rpc("submit_progress_update", {
    _project_id: input.projectId,
    _summary: input.summary,
    _issues: input.issues || null,
    _work_date: input.workDate,
    _photo_ids: input.photoIds,
    _task_ids: input.taskIds,
  });
  if (error) throw error;
  return data as string;
}

export async function editProgressUpdate(
  id: string,
  patch: { summary: string; issues?: string; workDate: string },
) {
  const { error } = await supabase.rpc("edit_progress_update", {
    _update_id: id,
    _summary: patch.summary,
    _issues: patch.issues || null,
    _work_date: patch.workDate,
  });
  if (error) throw error;
}

export async function addProgressCorrection(id: string, note: string) {
  const { error } = await supabase.rpc("add_progress_correction", {
    _update_id: id,
    _note: note,
  });
  if (error) throw error;
}
