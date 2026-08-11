import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Search, X, Check, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/auth-ui";
import {
  PHOTO_CATEGORIES,
  categoryLabel,
  recentProjectIds,
  uploadProjectPhoto,
  type PhotoCategory,
} from "@/lib/photos";
import { fetchProjects, type ProjectListItem } from "@/lib/projects";

type Item = {
  id: string;
  file: File;
  url: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

export function PhotoCaptureSheet({
  open,
  onClose,
  workspaceId,
  userId,
  initialProjectId,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  userId: string;
  initialProjectId?: string | null;
  onUploaded?: () => void;
}) {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PhotoCategory>("during");
  const [caption, setCaption] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setProjectId(initialProjectId ?? null);
    fetchProjects(workspaceId)
      .then(setProjects)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load projects"));
  }, [open, workspaceId, initialProjectId]);

  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.url)), [items]);

  const ordered = useMemo(() => {
    if (!projects) return [];
    const recents = recentProjectIds();
    const rank = (p: ProjectListItem) => {
      const i = recents.indexOf(p.id);
      return i === -1 ? 999 : i;
    };
    const q = query.trim().toLowerCase();
    return projects
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.customer_name ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => rank(a) - rank(b));
  }, [projects, query]);

  const selected = projects?.find((p) => p.id === projectId) ?? null;

  if (!open) return null;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: Item[] = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({
        id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        url: URL.createObjectURL(f),
        status: "pending" as const,
      }));
    setItems((prev) => [...prev, ...next]);
  };

  const uploadAll = async () => {
    if (!projectId || busy) return;
    const queue = items.filter((i) => i.status === "pending" || i.status === "error");
    if (queue.length === 0) return;
    setBusy(true);
    let ok = 0;
    for (const item of queue) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "uploading", error: undefined } : i)),
      );
      try {
        await uploadProjectPhoto({
          file: item.file,
          projectId,
          workspaceId,
          category,
          caption,
          userId,
        });
        ok += 1;
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "done" } : i)));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error", error: msg } : i)),
        );
      }
    }
    setBusy(false);
    if (ok > 0) {
      toast.success(ok === 1 ? "Photo uploaded" : `${ok} photos uploaded`);
      setCaption("");
      setItems((prev) => prev.filter((i) => i.status !== "done"));
      onUploaded?.();
    }
  };

  const pendingCount = items.filter((i) => i.status !== "done").length;
  const progress =
    items.length === 0
      ? 0
      : Math.round((items.filter((i) => i.status === "done").length / items.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Add photos</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Project selection */}
        {!projectId ? (
          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground">Choose a project</label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border bg-background px-3">
              <Search size={16} className="text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects"
                className="h-11 w-full bg-transparent text-sm text-foreground outline-none"
              />
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {projects === null && (
                <div className="text-sm text-muted-foreground">Loading projects…</div>
              )}
              {projects !== null && ordered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No projects available.
                </div>
              )}
              {ordered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProjectId(p.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-left hover:border-gold/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {p.name}
                    </span>
                    {p.customer_name && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.customer_name}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-gold">Project</div>
              <div className="truncate text-sm font-medium text-foreground">
                {selected?.name ?? "Selected project"}
              </div>
            </div>
            <button
              onClick={() => setProjectId(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Change
            </button>
          </div>
        )}

        {projectId && (
          <>
            {/* Capture actions */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-gold text-gold-foreground active:scale-[0.98]"
              >
                <Camera size={24} />
                <span className="text-sm font-semibold">Take Photo</span>
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background text-foreground active:scale-[0.98]"
              >
                <ImagePlus size={24} />
                <span className="text-sm font-semibold">Choose From Phone</span>
              </button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Category */}
            <div className="mt-5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PHOTO_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      category === c
                        ? "border-gold bg-gold text-gold-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {categoryLabel(c)}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption */}
            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground">
                Caption (optional)
              </label>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={200}
                placeholder="e.g. Kitchen wall before strip out"
                className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-gold/60"
              />
            </div>

            {/* Previews */}
            {items.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {items.map((i) => (
                  <div
                    key={i.id}
                    className="relative aspect-square overflow-hidden rounded-xl border border-border"
                  >
                    <img src={i.url} alt="" className="h-full w-full object-cover" />
                    {i.status !== "pending" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-medium text-white">
                        {i.status === "uploading" && "Uploading…"}
                        {i.status === "done" && <Check size={18} className="text-gold" />}
                        {i.status === "error" && (
                          <span className="px-1 text-center text-destructive">Failed</span>
                        )}
                      </div>
                    )}
                    {i.status !== "uploading" && (
                      <button
                        aria-label="Remove image"
                        onClick={() =>
                          setItems((prev) => prev.filter((prevItem) => prevItem.id !== i.id))
                        }
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {busy && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background">
                <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={onClose}
                className="h-12 flex-1 rounded-2xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <div className="flex-1">
                <Button onClick={uploadAll} disabled={busy || pendingCount === 0}>
                  {busy ? (
                    "Uploading…"
                  ) : items.some((i) => i.status === "error") ? (
                    <span className="inline-flex items-center gap-1.5">
                      <RotateCcw size={14} /> Retry upload
                    </span>
                  ) : (
                    `Upload${pendingCount ? ` ${pendingCount}` : ""}`
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
