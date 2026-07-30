import { useEffect, useState } from "react";
import { Camera, CheckCircle2, ChevronRight, Clock3, Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/auth-ui";
import { fetchProjectPhotos, type PhotoWithMeta } from "@/lib/photos";
import { fetchProjectTasks, type TaskWithAssignee } from "@/lib/tasks";
import {
  addProgressCorrection,
  editProgressUpdate,
  fetchProjectProgressUpdates,
  submitProgressUpdate,
  type ProgressUpdate,
} from "@/lib/progress";

export function ProgressTab({
  projectId,
  currentUserId,
  canManage,
  canCreate,
  reloadKey,
  onOpenCamera,
  startOpen = false,
}: {
  projectId: string;
  currentUserId: string;
  canManage: boolean;
  canCreate: boolean;
  reloadKey: number;
  onOpenCamera: () => void;
  startOpen?: boolean;
}) {
  const [updates, setUpdates] = useState<ProgressUpdate[] | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ProgressUpdate | null>(null);

  useEffect(() => {
    if (startOpen && canCreate) setOpen(true);
  }, [startOpen, canCreate]);

  const load = async () => {
    try {
      setUpdates(await fetchProjectProgressUpdates(projectId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load progress updates");
      setUpdates([]);
    }
  };

  useEffect(() => {
    void load();
  }, [projectId, reloadKey]);

  return (
    <div className="space-y-3">
      {canCreate && (
        <button
          onClick={() => setOpen(true)}
          className="flex h-14 w-full items-center justify-between rounded-2xl bg-gold px-4 text-sm font-semibold text-gold-foreground active:scale-[0.99]"
        >
          <span className="inline-flex items-center gap-2"><Plus size={18} /> Add Progress Update</span>
          <span>→</span>
        </button>
      )}

      {updates === null && <Empty text="Loading progress updates…" />}
      {updates?.length === 0 && <Empty text="No progress updates yet." />}
      <div className="space-y-3">
        {updates?.map((update) => {
          const locked = Date.now() >= new Date(update.locked_at).getTime();
          return (
            <button
              key={update.id}
              onClick={() => setDetail(update)}
              className="w-full rounded-2xl border border-border bg-surface p-4 text-left hover:border-gold/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {new Date(`${update.work_date}T12:00:00`).toLocaleDateString()}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(update.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" · "}{update.author_name ?? "Team member"}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  {locked ? <Lock size={11} /> : <Clock3 size={11} />}
                  {locked ? "Locked" : "Editable"}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-foreground/90">{update.summary}</p>
              {update.photos.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-hidden">
                  {update.photos.slice(0, 4).map((photo) => (
                    <div key={photo.id} className="h-14 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                      {photo.signed_url && <img src={photo.signed_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{update.tasks.length} completed task{update.tasks.length === 1 ? "" : "s"}</span>
                <ChevronRight size={15} />
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <ProgressComposer
          projectId={projectId}
          reloadKey={reloadKey}
          onOpenCamera={onOpenCamera}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await load();
          }}
        />
      )}
      {detail && (
        <ProgressDetail
          update={detail}
          currentUserId={currentUserId}
          canManage={canManage}
          onClose={() => setDetail(null)}
          onChanged={async () => {
            setDetail(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ProgressComposer({
  projectId,
  reloadKey,
  onOpenCamera,
  onClose,
  onSaved,
}: {
  projectId: string;
  reloadKey: number;
  onOpenCamera: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [issues, setIssues] = useState("");
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [photos, setPhotos] = useState<PhotoWithMeta[]>([]);
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([fetchProjectPhotos(projectId), fetchProjectTasks(projectId)])
      .then(([photoRows, taskRows]) => {
        setPhotos(photoRows);
        setTasks(taskRows.filter((task) => task.status !== "completed"));
      })
      .catch(() => toast.error("Could not load project photos and tasks"));
  }, [projectId, reloadKey]);

  const submit = async () => {
    if (!summary.trim()) return toast.error("Add a progress summary");
    setBusy(true);
    try {
      await submitProgressUpdate({ projectId, summary, issues, workDate, photoIds, taskIds });
      toast.success("Progress update submitted");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit progress update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Add Progress Update" onClose={onClose}>
      <div className="rounded-2xl border border-border bg-background p-4">
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Work date</label>
        <input
          type="date"
          value={workDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(event) => setWorkDate(event.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
        />
      </div>

      <section>
        <div className="flex items-center justify-between">
          <Label>Photos (optional)</Label>
          <button onClick={onOpenCamera} className="inline-flex items-center gap-1 text-xs font-medium text-gold">
            <Camera size={14} /> Add photos
          </button>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.slice(0, 12).map((photo) => {
            const selected = photoIds.includes(photo.id);
            return (
              <button
                key={photo.id}
                onClick={() => setPhotoIds(toggle(photoIds, photo.id))}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${selected ? "border-gold" : "border-border"}`}
              >
                {photo.signed_url && <img src={photo.signed_url} alt="" className="h-full w-full object-cover" />}
                {selected && <span className="absolute right-1 top-1 rounded-full bg-gold p-1 text-gold-foreground"><CheckCircle2 size={12} /></span>}
              </button>
            );
          })}
          {photos.length === 0 && <span className="text-xs text-muted-foreground">No project photos yet.</span>}
        </div>
      </section>

      <section>
        <Label>Progress summary *</Label>
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="What was completed on site today?"
          className="mt-2 w-full rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-foreground outline-none focus:border-gold"
        />
      </section>

      <section>
        <Label>Completed tasks (optional)</Label>
        <div className="mt-2 space-y-2">
          {tasks.map((task) => {
            const selected = taskIds.includes(task.id);
            return (
              <button
                key={task.id}
                onClick={() => setTaskIds(toggle(taskIds, task.id))}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm ${selected ? "border-gold bg-gold/10" : "border-border bg-background"}`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? "border-gold bg-gold text-gold-foreground" : "border-border"}`}>
                  {selected && "✓"}
                </span>
                <span className="text-foreground">{task.title}</span>
              </button>
            );
          })}
          {tasks.length === 0 && <span className="text-xs text-muted-foreground">No open tasks.</span>}
        </div>
      </section>

      <section>
        <Label>Issues or delays (optional)</Label>
        <textarea
          value={issues}
          onChange={(event) => setIssues(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Access, materials, weather or other blockers"
          className="mt-2 w-full rounded-2xl border border-border bg-background p-4 text-sm text-foreground outline-none focus:border-gold"
        />
      </section>

      <Button onClick={submit} loading={busy}>Review & Submit Update</Button>
    </Sheet>
  );
}

function ProgressDetail({
  update,
  canManage,
  onClose,
  onChanged,
}: {
  update: ProgressUpdate;
  currentUserId: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [correction, setCorrection] = useState("");
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(update.summary);
  const [issues, setIssues] = useState(update.issues ?? "");
  const [workDate, setWorkDate] = useState(update.work_date);
  const locked = Date.now() >= new Date(update.locked_at).getTime();
  const mayEdit = !locked && (canManage || update.created_by === currentUserId);
  return (
    <Sheet title="Progress Update" onClose={onClose}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{new Date(`${update.work_date}T12:00:00`).toLocaleDateString()}</span>
        <span className="inline-flex items-center gap-1">{locked && <Lock size={12} />}{locked ? "Locked" : "Editable for 24 hours"}</span>
      </div>
      <div>
        <Label>Submitted by</Label>
        <p className="mt-1 text-sm text-foreground">{update.author_name ?? "Team member"} · {new Date(update.created_at).toLocaleString()}</p>
      </div>
      {editing ? (
        <>
          <div><Label>Work date</Label><input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></div>
          <div><Label>Summary</Label><textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground" /></div>
          <div><Label>Issues or delays</Label><textarea value={issues} onChange={(event) => setIssues(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground" /></div>
          <Button onClick={async () => {
            try {
              await editProgressUpdate(update.id, { summary, issues, workDate });
              toast.success("Progress update edited");
              onChanged();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not edit update");
            }
          }}>Save Changes</Button>
        </>
      ) : (
        <>
          <div><Label>Summary</Label><p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">{update.summary}</p></div>
          {update.issues && <div><Label>Issues or delays</Label><p className="mt-2 whitespace-pre-line text-sm text-amber-200">{update.issues}</p></div>}
        </>
      )}
      {update.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {update.photos.map((photo) => photo.signed_url && <img key={photo.id} src={photo.signed_url} alt="" className="aspect-square rounded-xl object-cover" />)}
        </div>
      )}
      {update.tasks.length > 0 && (
        <div><Label>Completed tasks</Label><ul className="mt-2 space-y-2">{update.tasks.map((task) => <li key={task.id} className="flex gap-2 text-sm text-foreground"><CheckCircle2 size={16} className="text-emerald-400" />{task.title}</li>)}</ul></div>
      )}
      {update.corrections.map((item) => (
        <div key={item.id} className="rounded-xl border border-gold/30 bg-gold/10 p-3">
          <div className="text-[10px] uppercase tracking-widest text-gold">Correction</div>
          <p className="mt-1 text-sm text-foreground">{item.note}</p>
          <div className="mt-1 text-[10px] text-muted-foreground">{item.author_name} · {new Date(item.created_at).toLocaleString()}</div>
        </div>
      ))}
      {mayEdit && !editing && (
        <button onClick={() => setEditing(true)} className="h-11 w-full rounded-xl border border-gold/40 bg-gold/10 text-sm font-semibold text-gold">
          Edit recent update
        </button>
      )}
      {locked && canManage && (
        <div>
          <Label>Add correction note</Label>
          <textarea value={correction} onChange={(event) => setCorrection(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground" />
          <button
            onClick={async () => {
              if (!correction.trim()) return;
              try {
                await addProgressCorrection(update.id, correction);
                toast.success("Correction added");
                onChanged();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not add correction");
              }
            }}
            className="mt-2 h-11 w-full rounded-xl border border-gold/40 bg-gold/10 text-sm font-semibold text-gold"
          >
            Add correction
          </button>
        </div>
      )}
    </Sheet>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm">
      <div className="max-h-[94vh] w-full max-w-md space-y-5 overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 pb-8">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface py-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function toggle(values: string[], id: string) {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
}
