import { useEffect, useMemo, useState } from "react";
import { Camera, ImagePlus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  PHOTO_CATEGORIES,
  categoryLabel,
  categoryTone,
  deleteProjectPhoto,
  fetchProjectPhotos,
  updatePhotoCaption,
  type PhotoCategory,
  type PhotoWithMeta,
} from "@/lib/photos";

export function PhotosTab({
  projectId,
  currentUserId,
  canManage,
  canUpload,
  onOpenCamera,
  reloadKey = 0,
}: {
  projectId: string;
  currentUserId: string;
  canManage: boolean;
  canUpload: boolean;
  onOpenCamera: () => void;
  reloadKey?: number;
}) {
  const [rows, setRows] = useState<PhotoWithMeta[] | null>(null);
  const [filter, setFilter] = useState<PhotoCategory | "all">("all");
  const [viewing, setViewing] = useState<PhotoWithMeta | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = () =>
    fetchProjectPhotos(projectId)
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load photos"));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, reloadKey]);

  const shown = useMemo(
    () => (rows ?? []).filter((r) => filter === "all" || r.category === filter),
    [rows, filter],
  );

  const canEditPhoto = (p: PhotoWithMeta) => canManage || p.uploaded_by === currentUserId;

  return (
    <div className="space-y-4">
      {canUpload && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onOpenCamera}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gold text-sm font-semibold text-gold-foreground active:scale-[0.99]"
          >
            <Camera size={16} /> Take Photo
          </button>
          <button
            onClick={onOpenCamera}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-surface text-sm font-semibold text-foreground active:scale-[0.99]"
          >
            <ImagePlus size={16} /> Upload Photos
          </button>
        </div>
      )}

      <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1">
        {(["all", ...PHOTO_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c as PhotoCategory | "all")}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === c
                ? "border-gold bg-gold text-gold-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {c === "all" ? "All" : categoryLabel(c as PhotoCategory)}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          Loading photos…
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-8 text-center">
          <Camera size={24} className="mx-auto text-muted-foreground" />
          <div className="mt-2 text-sm font-medium text-foreground">No photos yet</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {canUpload
              ? "Capture site photos to keep a visual record of this job."
              : "Photos added to this project will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <button
                onClick={() => setViewing(p)}
                className="block aspect-square w-full bg-background"
              >
                {p.signed_url ? (
                  <img
                    src={p.signed_url}
                    alt={p.caption ?? p.file_name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Unavailable
                  </span>
                )}
              </button>
              <div className="space-y-1.5 p-2.5">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryTone(p.category)}`}
                >
                  {categoryLabel(p.category)}
                </span>

                {editingId === p.id ? (
                  <div className="flex gap-1.5">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={200}
                      className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-gold/60"
                    />
                    <button
                      onClick={async () => {
                        try {
                          await updatePhotoCaption(p.id, draft);
                          setEditingId(null);
                          await load();
                          toast.success("Caption updated");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Update failed");
                        }
                      }}
                      className="rounded-lg bg-gold px-2 text-[11px] font-semibold text-gold-foreground"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  p.caption && <p className="text-xs text-foreground/90">{p.caption}</p>
                )}

                <div className="text-[10px] text-muted-foreground">
                  {p.uploader_name ?? "Member"} · {new Date(p.created_at).toLocaleString()}
                </div>

                {canEditPhoto(p) && editingId !== p.id && (
                  <div className="flex gap-3 pt-0.5">
                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setDraft(p.caption ?? "");
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Pencil size={11} /> Caption
                    </button>
                    {(canManage || p.uploaded_by === currentUserId) && (
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this photo?")) return;
                          try {
                            await deleteProjectPhoto(p);
                            await load();
                            toast.success("Photo deleted");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Delete failed");
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-destructive hover:underline"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={() => setViewing(null)}
        >
          <div className="flex justify-end p-4">
            <button
              aria-label="Close viewer"
              className="rounded-full bg-white/10 p-2 text-white"
              onClick={() => setViewing(null)}
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center px-4">
            {viewing.signed_url && (
              <img
                src={viewing.signed_url}
                alt={viewing.caption ?? viewing.file_name}
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            )}
          </div>
          <div className="p-5 text-center text-xs text-white/80">
            <div className="font-medium text-white">
              {categoryLabel(viewing.category)}
              {viewing.caption ? ` · ${viewing.caption}` : ""}
            </div>
            <div className="mt-1">
              {viewing.uploader_name ?? "Member"} ·{" "}
              {new Date(viewing.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
