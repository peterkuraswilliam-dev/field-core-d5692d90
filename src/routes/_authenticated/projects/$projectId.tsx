import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar as CalIcon,
  FileText,
  Image as ImageIcon,
  Info,
  ListChecks,
  MapPin,
  Mail,
  Phone,
  Pencil,
  Save,
  Users,
  Activity,
  StickyNote,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button, Field } from "@/components/auth-ui";
import { StatusPill, initials } from "@/components/project-ui";
import {
  fetchProject,
  fetchProjectMembers,
  hasWorkspaceWideAccess,
  PROJECT_STATUSES,
  setProjectMembers,
  statusLabel,
  updateProject,
  type Project,
  type ProjectMemberRow,
  type ProjectStatus,
} from "@/lib/projects";
import { fetchTeamMembers, type TeamMember } from "@/lib/team";
import { roleLabel, type Membership, type Workspace, type WorkspaceRole } from "@/lib/workspace";
import { TasksTab } from "@/components/project-tabs/TasksTab";
import { NotesTab } from "@/components/project-tabs/NotesTab";
import { ActivityTab } from "@/components/project-tabs/ActivityTab";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Project — Contractor OS" },
      { name: "description", content: "Project overview and team." },
    ],
  }),
  component: ProjectDetail,
});

type Tab = "overview" | "tasks" | "photos" | "files" | "calendar" | "notes" | "team" | "activity";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "files", label: "Files", icon: FileText },
  { id: "calendar", label: "Calendar", icon: CalIcon },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "team", label: "Team", icon: Users },
  { id: "activity", label: "Activity", icon: Activity },
];

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const ctx = Route.useRouteContext() as {
    user: { id: string };
    workspace: Workspace;
    membership: Membership;
  };
  const { user, workspace, membership } = ctx;
  const role = membership.role as WorkspaceRole;
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [managingTeam, setManagingTeam] = useState(false);

  const load = async () => {
    try {
      const p = await fetchProject(projectId);
      setProject(p);
      if (p) setMembers(await fetchProjectMembers(projectId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load project");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const isAssigned = members.some((m) => m.user_id === user.id);
  const canManage =
    hasWorkspaceWideAccess(role) || (role === "project_manager" && isAssigned);

  if (project === undefined) {
    return <Centered>Loading project…</Centered>;
  }
  if (project === null) {
    return (
      <Centered>
        <div className="text-center">
          <div className="text-lg font-semibold text-foreground">Project not found</div>
          <p className="mt-1 text-sm text-muted-foreground">
            You may not have access, or the project no longer exists.
          </p>
          <Link
            to="/projects"
            className="mt-4 inline-flex items-center gap-1 text-sm text-gold hover:underline"
          >
            <ArrowLeft size={14} /> Back to projects
          </Link>
        </div>
      </Centered>
    );
  }

  return (
    <div className="relative min-h-screen bg-background pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_82/0.12),transparent_60%)]"
      />
      <div className="relative mx-auto w-full max-w-3xl px-5 pt-6">
        <header className="flex items-center justify-between">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> Projects
          </Link>
          {canManage && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated"
            >
              <Pencil size={14} /> Edit
            </button>
          )}
        </header>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={project.status} />
            {project.customer_name && (
              <span className="text-xs text-muted-foreground">for {project.customer_name}</span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {project.name}
          </h1>
          <div className="mt-1 text-xs text-muted-foreground">
            Updated {new Date(project.updated_at).toLocaleString()}
          </div>
        </div>

        {/* Contextual project nav */}
        <nav
          aria-label="Project sections"
          className="mt-6 -mx-1 flex gap-1.5 overflow-x-auto pb-2"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-gold bg-gold text-gold-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-5">
          {tab === "overview" &&
            (editing ? (
              <EditForm
                project={project}
                onCancel={() => setEditing(false)}
                onSaved={(p) => {
                  setProject(p);
                  setEditing(false);
                  toast.success("Project updated");
                }}
              />
            ) : (
              <Overview project={project} members={members} />
            ))}

          {tab === "team" && (
            <TeamTab
              members={members}
              canManage={canManage}
              onManage={() => setManagingTeam(true)}
            />
          )}

          {tab === "tasks" && (
            <TasksTab
              projectId={project.id}
              currentUserId={user.id}
              members={members}
              canManage={canManage}
              isViewer={role === "viewer"}
            />
          )}

          {tab === "notes" && (
            <NotesTab
              projectId={project.id}
              currentUserId={user.id}
              role={role}
              canManage={canManage}
            />
          )}

          {tab === "activity" && <ActivityTab projectId={project.id} />}

          {(tab === "photos" || tab === "files" || tab === "calendar") && <Placeholder tab={tab} />}
        </div>
      </div>

      {managingTeam && (
        <AssignTeamModal
          projectId={project.id}
          workspaceId={workspace.id}
          currentIds={new Set(members.map((m) => m.user_id))}
          onClose={() => setManagingTeam(false)}
          onSaved={async () => {
            setManagingTeam(false);
            await load();
            toast.success("Team updated");
          }}
        />
      )}

      {/* Delete for owner/admin */}
      {canManage && hasWorkspaceWideAccess(role) && tab === "overview" && !editing && (
        <div className="mx-auto mt-8 w-full max-w-3xl px-5">
          <button
            onClick={async () => {
              if (!confirm("Delete this project? This cannot be undone.")) return;
              const { supabase } = await import("@/integrations/supabase/client");
              const { error } = await supabase.from("projects").delete().eq("id", project.id);
              if (error) toast.error(error.message);
              else {
                toast.success("Project deleted");
                navigate({ to: "/projects" });
              }
            }}
            className="text-xs text-destructive hover:underline"
          >
            Delete project
          </button>
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Overview({ project, members }: { project: Project; members: ProjectMemberRow[] }) {
  return (
    <div className="space-y-4">
      <Card title="Customer">
        {project.customer_name || project.customer_email || project.customer_phone ? (
          <dl className="space-y-2 text-sm">
            {project.customer_name && (
              <div className="flex items-start gap-2">
                <Users size={14} className="mt-0.5 text-muted-foreground" />
                <span className="text-foreground">{project.customer_name}</span>
              </div>
            )}
            {project.customer_email && (
              <div className="flex items-start gap-2">
                <Mail size={14} className="mt-0.5 text-muted-foreground" />
                <a href={`mailto:${project.customer_email}`} className="text-foreground hover:text-gold">
                  {project.customer_email}
                </a>
              </div>
            )}
            {project.customer_phone && (
              <div className="flex items-start gap-2">
                <Phone size={14} className="mt-0.5 text-muted-foreground" />
                <a href={`tel:${project.customer_phone}`} className="text-foreground hover:text-gold">
                  {project.customer_phone}
                </a>
              </div>
            )}
          </dl>
        ) : (
          <EmptyLine text="No customer details recorded." />
        )}
      </Card>

      <Card title="Job address">
        {project.job_address ? (
          <div className="flex items-start gap-2 text-sm text-foreground">
            <MapPin size={14} className="mt-0.5 text-muted-foreground" />
            <span className="whitespace-pre-line">{project.job_address}</span>
          </div>
        ) : (
          <EmptyLine text="No address recorded." />
        )}
      </Card>

      <Card title="Description">
        {project.description ? (
          <p className="whitespace-pre-line text-sm text-foreground/90">{project.description}</p>
        ) : (
          <EmptyLine text="No description." />
        )}
      </Card>

      <Card title="Dates">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <DateItem label="Start" value={project.start_date} />
          <DateItem label="Expected completion" value={project.expected_completion_date} />
        </div>
      </Card>

      <Card title="Assigned team">
        {members.length === 0 ? (
          <EmptyLine text="No team members assigned yet." />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {members.map((m) => {
              const name = m.full_name?.trim() || m.email?.split("@")[0] || "Member";
              return (
                <li
                  key={m.id}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated py-1 pl-1 pr-3 text-xs"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[10px] font-semibold text-gold-foreground">
                    {initials(name)}
                  </span>
                  <span className="text-foreground">{name}</span>
                  <span className="text-muted-foreground">· {roleLabel(m.workspace_role)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Activity summary">
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Created {new Date(project.created_at).toLocaleString()}</li>
          <li>Last updated {new Date(project.updated_at).toLocaleString()}</li>
          <li>Status: {statusLabel(project.status)}</li>
        </ul>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground">{text}</div>;
}

function DateItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-foreground">
        {value ? new Date(value).toLocaleDateString() : "—"}
      </div>
    </div>
  );
}

function TeamTab({
  members,
  canManage,
  onManage,
}: {
  members: ProjectMemberRow[];
  canManage: boolean;
  onManage: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Project team ({members.length})
        </h2>
        {canManage && (
          <button
            onClick={onManage}
            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-gold-foreground"
          >
            <Plus size={14} /> Manage
          </button>
        )}
      </div>
      {members.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground">
          No members assigned yet.
        </div>
      )}
      <ul className="space-y-2">
        {members.map((m) => {
          const name = m.full_name?.trim() || m.email?.split("@")[0] || "Member";
          return (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
            >
              {m.avatar_url ? (
                <img
                  src={m.avatar_url}
                  alt={name}
                  className="h-10 w-10 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-sm font-semibold text-gold-foreground">
                  {initials(name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{name}</div>
                <div className="truncate text-xs text-muted-foreground">{m.email}</div>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  m.status === "active"
                    ? "border-gold/30 bg-gold/10 text-gold"
                    : "border-border bg-surface-elevated text-muted-foreground"
                }`}
              >
                {roleLabel(m.workspace_role)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Placeholder({ tab }: { tab: Tab }) {
  const t = TABS.find((x) => x.id === tab);
  const Icon = t?.icon ?? Info;
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 text-gold">
        <Icon size={22} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{t?.label} coming soon</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        This section will be added in an upcoming stage.
      </p>
    </div>
  );
}

const editSchema = z.object({
  name: z.string().trim().min(2).max(120),
  customer_name: z.string().trim().max(120).optional(),
  customer_email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Invalid email")
    .optional(),
  customer_phone: z.string().trim().max(40).optional(),
  job_address: z.string().trim().max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(PROJECT_STATUSES as [ProjectStatus, ...ProjectStatus[]]),
  start_date: z.string().optional(),
  expected_completion_date: z.string().optional(),
});

function EditForm({
  project,
  onCancel,
  onSaved,
}: {
  project: Project;
  onCancel: () => void;
  onSaved: (p: Project) => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    customer_name: project.customer_name ?? "",
    customer_email: project.customer_email ?? "",
    customer_phone: project.customer_phone ?? "",
    job_address: project.job_address ?? "",
    description: project.description ?? "",
    status: project.status,
    start_date: project.start_date ?? "",
    expected_completion_date: project.expected_completion_date ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = editSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path[0] as string] = i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const p = await updateProject(project.id, {
        ...parsed.data,
        customer_name: parsed.data.customer_name || null,
        customer_email: parsed.data.customer_email || null,
        customer_phone: parsed.data.customer_phone || null,
        job_address: parsed.data.job_address || null,
        description: parsed.data.description || null,
        start_date: parsed.data.start_date || null,
        expected_completion_date: parsed.data.expected_completion_date || null,
      });
      onSaved(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
        <Field
          label="Project name"
          name="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          error={errors.name}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/90">Status</label>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as ProjectStatus)}
            className="w-full rounded-xl border border-border bg-input px-4 py-3.5 text-base text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Customer name"
          name="customer_name"
          value={form.customer_name}
          onChange={(e) => set("customer_name", e.target.value)}
        />
        <Field
          label="Customer email"
          name="customer_email"
          type="email"
          value={form.customer_email}
          onChange={(e) => set("customer_email", e.target.value)}
          error={errors.customer_email}
        />
        <Field
          label="Customer phone"
          name="customer_phone"
          value={form.customer_phone}
          onChange={(e) => set("customer_phone", e.target.value)}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/90">Job address</label>
          <textarea
            value={form.job_address}
            onChange={(e) => set("job_address", e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/90">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Start date"
            name="start_date"
            type="date"
            value={form.start_date}
            onChange={(e) => set("start_date", e.target.value)}
          />
          <Field
            label="Expected completion"
            name="expected_completion_date"
            type="date"
            value={form.expected_completion_date}
            onChange={(e) => set("expected_completion_date", e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" loading={saving}>
          <Save size={16} /> Save changes
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AssignTeamModal({
  projectId,
  workspaceId,
  currentIds,
  onClose,
  onSaved,
}: {
  projectId: string;
  workspaceId: string;
  currentIds: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(currentIds));
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchTeamMembers(workspaceId)
      .then((rows) => setTeam(rows.filter((r) => r.status === "active")))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load team"));
  }, [workspaceId]);

  const filtered = useMemo(() => {
    if (!team) return [];
    const q = query.trim().toLowerCase();
    if (!q) return team;
    return team.filter(
      (m) =>
        (m.full_name ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q),
    );
  }, [team, query]);

  const toggle = (uid: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });

  const save = async () => {
    setSaving(true);
    try {
      await setProjectMembers(projectId, Array.from(selected));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-surface p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Manage project team</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team"
          className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
        />
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {team === null && <li className="text-sm text-muted-foreground">Loading…</li>}
          {team && filtered.length === 0 && (
            <li className="text-sm text-muted-foreground">No active workspace members.</li>
          )}
          {filtered.map((m) => (
            <li key={m.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-elevated p-3">
                <input
                  type="checkbox"
                  checked={selected.has(m.user_id)}
                  onChange={() => toggle(m.user_id)}
                  className="h-4 w-4 accent-[oklch(0.78_0.14_82)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {m.full_name?.trim() || m.email?.split("@")[0] || "Member"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {m.email} · {roleLabel(m.role)}
                  </div>
                </div>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <Button onClick={save} loading={saving}>
            Save team
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
