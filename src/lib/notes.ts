import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProjectNote = Database["public"]["Tables"]["project_notes"]["Row"];

export interface NoteWithAuthor extends ProjectNote {
  author_name: string | null;
  author_avatar: string | null;
  edited: boolean;
}

export async function fetchProjectNotes(projectId: string): Promise<NoteWithAuthor[]> {
  const { data, error } = await supabase
    .from("project_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ProjectNote[];
  if (rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.created_by)));
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", userIds);
  const byId = new Map((profs ?? []).map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = byId.get(r.created_by);
    const edited =
      new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 1000;
    return {
      ...r,
      author_name: p?.full_name?.trim() || p?.email?.split("@")[0] || "Member",
      author_avatar: p?.avatar_url ?? null,
      edited,
    };
  });
}

export async function createNote(
  projectId: string,
  content: string,
  createdBy: string,
): Promise<void> {
  const { error } = await supabase.from("project_notes").insert({
    project_id: projectId,
    workspace_id: "00000000-0000-0000-0000-000000000000", // overwritten by trigger
    content: content.trim(),
    created_by: createdBy,
  });
  if (error) throw error;
}

export async function updateNote(id: string, content: string): Promise<void> {
  const { error } = await supabase
    .from("project_notes")
    .update({ content: content.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from("project_notes").delete().eq("id", id);
  if (error) throw error;
}
