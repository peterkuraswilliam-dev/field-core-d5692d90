import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { WorkspaceRole } from "@/lib/workspace";

export type PhotoCategory = Database["public"]["Enums"]["photo_category"];
export type ProjectPhoto = Database["public"]["Tables"]["project_photos"]["Row"];

export const PHOTO_BUCKET = "project-photos";

export const PHOTO_CATEGORIES: PhotoCategory[] = [
  "before",
  "during",
  "after",
  "issue",
  "materials",
  "receipt",
  "other",
];

export function categoryLabel(c: PhotoCategory): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export function categoryTone(c: PhotoCategory): string {
  switch (c) {
    case "before":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "during":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "after":
      return "bg-gold/15 text-gold border-gold/30";
    case "issue":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "materials":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "receipt":
      return "bg-violet-500/15 text-violet-300 border-violet-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
];
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB pre-compression

export function canUploadPhotos(role: WorkspaceRole): boolean {
  return role !== "viewer";
}

/* ---------------- recent projects (local convenience only) --------------- */

const RECENT_KEY = "recent_project_ids";

export function markProjectOpened(projectId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [projectId, ...list.filter((id) => id !== projectId)].slice(0, 8);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function recentProjectIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/* ------------------------------ compression ------------------------------ */

export async function compressImage(file: File, maxEdge = 2000, quality = 0.82): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size < 600 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/* -------------------------------- queries -------------------------------- */

export interface PhotoWithMeta extends ProjectPhoto {
  uploader_name: string | null;
  signed_url: string | null;
}

async function decorate(rows: ProjectPhoto[]): Promise<PhotoWithMeta[]> {
  if (rows.length === 0) return [];
  const ids = Array.from(new Set(rows.map((r) => r.uploaded_by)));
  const [{ data: profs }, signed] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", ids),
    supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(rows.map((r) => r.storage_path), 60 * 60),
  ]);
  const nameById = new Map(
    (profs ?? []).map((p) => [p.id, p.full_name?.trim() || p.email?.split("@")[0] || "Member"]),
  );
  const urlByPath = new Map(
    (signed.data ?? []).map((s) => [s.path ?? "", s.signedUrl as string | null]),
  );
  return rows.map((r) => ({
    ...r,
    uploader_name: nameById.get(r.uploaded_by) ?? null,
    signed_url: urlByPath.get(r.storage_path) ?? null,
  }));
}

export async function fetchProjectPhotos(projectId: string): Promise<PhotoWithMeta[]> {
  const { data, error } = await supabase
    .from("project_photos")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return decorate((data ?? []) as ProjectPhoto[]);
}

export interface PhotoStats {
  today: number;
  total: number;
  recent: PhotoWithMeta[];
  projectsMissingBefore: { id: string; name: string }[];
}

export async function fetchPhotoStats(workspaceId: string): Promise<PhotoStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [{ data: recentRows }, { count: todayCount }, { data: projects }, { data: beforeRows }] =
    await Promise.all([
      supabase
        .from("project_photos")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("project_photos")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", startOfDay.toISOString()),
      supabase
        .from("projects")
        .select("id, name, status")
        .eq("workspace_id", workspaceId)
        .in("status", ["scheduled", "in_progress", "approved"]),
      supabase
        .from("project_photos")
        .select("project_id")
        .eq("workspace_id", workspaceId)
        .eq("category", "before"),
    ]);

  const withBefore = new Set((beforeRows ?? []).map((r) => r.project_id));
  return {
    today: todayCount ?? 0,
    total: (recentRows ?? []).length,
    recent: await decorate((recentRows ?? []) as ProjectPhoto[]),
    projectsMissingBefore: (projects ?? [])
      .filter((p) => !withBefore.has(p.id))
      .slice(0, 5)
      .map((p) => ({ id: p.id, name: p.name })),
  };
}

/* -------------------------------- mutations ------------------------------- */

export interface UploadPhotoInput {
  file: File;
  projectId: string;
  workspaceId: string;
  category: PhotoCategory;
  caption?: string;
  userId: string;
}

function safeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-60);
}

export async function uploadProjectPhoto(input: UploadPhotoInput): Promise<ProjectPhoto> {
  const { projectId, workspaceId, category, userId } = input;
  const original = input.file;

  if (!original.type.startsWith("image/")) throw new Error("Only image files are allowed");
  if (!ACCEPTED_IMAGE_TYPES.includes(original.type))
    throw new Error(`Unsupported image format: ${original.type}`);
  if (original.size > MAX_FILE_BYTES) throw new Error("Image is larger than 25MB");

  const file = await compressImage(original);
  const photoId = crypto.randomUUID();
  const path = `${workspaceId}/${projectId}/${category}/${photoId}-${safeName(file.name)}`;

  const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("project_photos")
    .insert({
      id: photoId,
      workspace_id: workspaceId,
      project_id: projectId,
      storage_path: path,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      category,
      caption: input.caption?.trim() || null,
      uploaded_by: userId,
      taken_at: new Date(original.lastModified || Date.now()).toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    // roll back the orphaned object so retries stay clean
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw error;
  }
  return data;
}

export async function updatePhotoCaption(id: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from("project_photos")
    .update({ caption: caption.trim() || null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProjectPhoto(photo: ProjectPhoto): Promise<void> {
  const { error } = await supabase.from("project_photos").delete().eq("id", photo.id);
  if (error) throw error;
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
}
