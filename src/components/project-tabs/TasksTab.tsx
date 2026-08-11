import { useEffect, useMemo, useState } from "react";
import { Check, Circle, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Field } from "@/components/auth-ui";
import { initials } from "@/components/project-ui";
import {
  createTask,
  deleteTask,
  fetchProjectTasks,
  TASK_PRIORITIES,
  TASK_STATUSES,
  taskPriorityLabel,
  taskPriorityTone,
  taskStatusLabel,
  taskStatusTone,
  updateTask,
  updateTaskStatus,
  type TaskPriority,
  type TaskStatus,
  type TaskWithAssignee,
} from "@/lib/tasks";
import type { ProjectMemberRow } from "@/lib/projects";

interface Props {
  projectId: string;
  currentUserId: string;
  members: ProjectMemberRow[];
  canManage: boolean;
  isViewer: boolean;
}

export function TasksTab({ projectId, currentUserId, members, canManage, isViewer }: Props) {
  const [tasks, setTasks] = useState<TaskWithAssignee[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine" | "open">("mine");

  const load = () =>
    fetchProjectTasks(projectId)
      .then(setTasks)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load tasks"));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const visible = useMemo(() => {
    const list = tasks ?? [];
    if (filter === "mine") return list.filter((t) => t.assigned_to === currentUserId);
    if (filter === "open") return list.filter((t) => t.status !== "completed");
    return list;
  }, [tasks, filter, currentUserId]);

  const activeMembers = members.filter((m) => m.status === "active");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {(["mine", "open", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                filter === f
                  ? "border-gold bg-gold text-gold-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "mine" ? "My tasks" : f === "open" ? "Open" : "All"}
            </button>
          ))}
        </div>
        {canManage && !isViewer && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-gold-foreground"
          >
            <Plus size={14} /> New task
          </button>
        )}
      </div>

      {tasks === null && (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          Loading tasks…
        </div>
      )}
      {tasks !== null && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground">
          {filter === "mine" ? "No tasks assigned to you." : "No tasks yet."}
        </div>
      )}

      <ul className="space-y-2">
        {visible.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            currentUserId={currentUserId}
            canManage={canManage}
            onChanged={load}
          />
        ))}
      </ul>

      {creating && (
        <NewTaskModal
          projectId={projectId}
          currentUserId={currentUserId}
          members={activeMembers}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
            toast.success("Task created");
          }}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  currentUserId,
  canManage,
  onChanged,
}: {
  task: TaskWithAssignee;
  currentUserId: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const canToggle = canManage || task.assigned_to === currentUserId;
  const done = task.status === "completed";

  const toggle = async () => {
    if (!canToggle) return;
    setBusy(true);
    try {
      await updateTaskStatus(task.id, done ? "todo" : "completed");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this task?")) return;
    try {
      await deleteTask(task.id);
      onChanged();
      toast.success("Task deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const cycleStatus = async (s: TaskStatus) => {
    setBusy(true);
    try {
      await updateTaskStatus(task.id, s);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-start gap-3">
        <button
          onClick={toggle}
          disabled={!canToggle || busy}
          aria-label={done ? "Mark as to do" : "Mark complete"}
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
            done
              ? "border-gold bg-gold text-gold-foreground"
              : "border-border bg-surface-elevated text-muted-foreground hover:border-gold/50 hover:text-gold"
          } disabled:opacity-50`}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : done ? (
            <Check size={18} />
          ) : (
            <Circle size={18} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div
            className={`text-sm font-semibold ${done ? "text-muted-foreground line-through" : "text-foreground"}`}
          >
            {task.title}
          </div>
          {task.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${taskStatusTone(task.status)}`}
            >
              {taskStatusLabel(task.status)}
            </span>
            <span
              className={`text-[10px] font-semibold uppercase ${taskPriorityTone(task.priority)}`}
            >
              {taskPriorityLabel(task.priority)}
            </span>
            {task.due_date && (
              <span className="text-[10px] text-muted-foreground">
                Due {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.assignee_name && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] text-muted-foreground">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[8px] font-semibold text-gold-foreground">
                  {initials(task.assignee_name)}
                </span>
                {task.assignee_name}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <button
            onClick={remove}
            aria-label="Delete task"
            className="rounded-full p-2 text-muted-foreground hover:bg-surface-elevated hover:text-destructive"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {canToggle && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
          {TASK_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => cycleStatus(s)}
              disabled={busy || s === task.status}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                s === task.status
                  ? "border-gold/60 bg-gold/10 text-gold"
                  : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground"
              } disabled:opacity-60`}
            >
              {taskStatusLabel(s)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function NewTaskModal({
  projectId,
  currentUserId,
  members,
  onClose,
  onCreated,
}: {
  projectId: string;
  currentUserId: string;
  members: ProjectMemberRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    priority: "normal" as TaskPriority,
    due_date: "",
    assigned_to: "" as string,
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.title.trim().length < 2) {
      toast.error("Enter a task title");
      return;
    }
    setSaving(true);
    try {
      await createTask({
        project_id: projectId,
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to || null,
        created_by: currentUserId,
      });
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-t-3xl border border-border bg-surface p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">New task</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <Field
            label="Title"
            name="title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/90">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/90">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
                className="w-full rounded-xl border border-border bg-input px-3 py-3 text-sm text-foreground outline-none focus:border-gold"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {taskStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/90">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))
                }
                className="w-full rounded-xl border border-border bg-input px-3 py-3 text-sm text-foreground outline-none focus:border-gold"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {taskPriorityLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Field
            label="Due date"
            name="due_date"
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/90">Assign to</label>
            <select
              value={form.assigned_to}
              onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
              className="w-full rounded-xl border border-border bg-input px-3 py-3 text-sm text-foreground outline-none focus:border-gold"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name?.trim() || m.email?.split("@")[0] || "Member"}
                </option>
              ))}
            </select>
            {members.length === 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Add project team members before assigning tasks.
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit" loading={saving}>
            Create task
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

// suppress unused import warning for updateTask (kept for future edit UI)
void updateTask;
