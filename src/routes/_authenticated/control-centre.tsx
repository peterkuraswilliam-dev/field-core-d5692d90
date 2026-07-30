import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ClipboardPlus,
  FolderKanban,
  ListChecks,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  UserPlus,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/auth-ui";
import { toast } from "sonner";
import { isCurrentUserAdmin } from "@/lib/roles";
import { roleLabel, type Workspace, type Membership, type WorkspaceRole } from "@/lib/workspace";
import { fetchAuditLog, humanAction, type AuditEntry } from "@/lib/team";
import {
  canCreateProjects,
  fetchProjects,
  hasWorkspaceWideAccess,
  NEEDS_ATTENTION_STATUSES,
  statusLabel,
  type ProjectListItem,
} from "@/lib/projects";
import {
  fetchWorkspaceTaskStats,
  taskStatusLabel,
  type TaskWithAssignee,
} from "@/lib/tasks";
import { fetchWorkspaceActivity, humanActivity, type ActivityEntry } from "@/lib/activity";
import {
  canUploadPhotos,
  categoryLabel,
  categoryTone,
  fetchPhotoStats,
  type PhotoStats,
} from "@/lib/photos";
import { useCamera } from "@/components/camera-provider";
import { fetchProgressStats, type ProgressUpdate } from "@/lib/progress";


export const Route = createFileRoute("/_authenticated/control-centre")({
  head: () => ({
    meta: [
      { title: "Control Centre — Contractor OS" },
      { name: "description", content: "Your contractor workspace at a glance." },
      { property: "og:title", content: "Control Centre — Contractor OS" },
      { property: "og:description", content: "Your contractor workspace at a glance." },
    ],
  }),
  component: ControlCentre,
});

function initials(source: string) {
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

interface Counts {
  active: number;
  pending: number;
  suspended: number;
}

function ControlCentre() {
  const ctx = Route.useRouteContext() as {
    user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
    workspace: Workspace;
    membership: Membership;
  };
  const { user, workspace, membership } = ctx;
  const role = membership.role as WorkspaceRole;
  const canManageTeam = role === "owner" || role === "admin";
  const canCreate = canCreateProjects(role);
  const wideAccess = hasWorkspaceWideAccess(role);

  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [counts, setCounts] = useState<Counts>({ active: 0, pending: 0, suspended: 0 });
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [myProjectIds, setMyProjectIds] = useState<Set<string>>(new Set());
  const [taskStats, setTaskStats] = useState<{
    dueToday: number;
    overdue: number;
    mine: number;
    recentCompleted: TaskWithAssignee[];
  } | null>(null);
  const [projectFeed, setProjectFeed] = useState<ActivityEntry[]>([]);
  const [photoStats, setPhotoStats] = useState<PhotoStats | null>(null);
  const [progressStats, setProgressStats] = useState<{
    today: number;
    withoutRecent: number;
    recent: ProgressUpdate[];
  } | null>(null);
  const camera = useCamera();
  const navigate = useNavigate();
  const queryClient = useQueryClient();


  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));

    (async () => {
      const [{ count: active }, { count: suspended }] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace.id)
          .eq("status", "active"),
        supabase
          .from("workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace.id)
          .eq("status", "suspended"),
      ]);
      let pending = 0;
      if (canManageTeam) {
        const { count } = await supabase
          .from("workspace_invitations")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace.id)
          .eq("status", "pending");
        pending = count ?? 0;
        try {
          setAudit(await fetchAuditLog(workspace.id, 5));
        } catch {
          /* ignore */
        }
      }
      setCounts({ active: active ?? 0, pending, suspended: suspended ?? 0 });
    })();

    fetchProjects(workspace.id)
      .then(setProjects)
      .catch(() => setProjects([]));

    supabase
      .from("project_members")
      .select("project_id")
      .eq("workspace_id", workspace.id)
      .eq("user_id", user.id)
      .then(({ data }) => setMyProjectIds(new Set((data ?? []).map((r) => r.project_id))));

    fetchWorkspaceTaskStats(workspace.id, user.id)
      .then(setTaskStats)
      .catch(() => setTaskStats({ dueToday: 0, overdue: 0, mine: 0, recentCompleted: [] }));

    fetchWorkspaceActivity(workspace.id, 5)
      .then(setProjectFeed)
      .catch(() => setProjectFeed([]));

    fetchPhotoStats(workspace.id)
      .then(setPhotoStats)
      .catch(() => setPhotoStats(null));

    isCurrentUserAdmin(user.id).then(setIsPlatformAdmin);
  }, [user.id, workspace.id, canManageTeam, camera.uploadTick]);

  useEffect(() => {
    if (!projects) return;
    const visible = wideAccess ? projects : projects.filter((project) => myProjectIds.has(project.id));
    fetchProgressStats(workspace.id, visible.map((project) => project.id))
      .then(setProgressStats)
      .catch(() => setProgressStats({ today: 0, withoutRecent: 0, recent: [] }));
  }, [projects, myProjectIds, wideAccess, workspace.id]);


  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const name = profile?.full_name || meta.full_name || meta.name || user.email?.split("@")[0] || "there";
  const firstName = name.split(" ")[0];

  const signOut = async () => {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_82/0.15),transparent_60%)]"
      />
      <div className="relative mx-auto w-full max-w-md px-5 pt-8 sm:pt-12">
        <header className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Control Centre
            </div>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
              Welcome back, {firstName}
            </h1>
          </div>
          <Avatar name={name} avatarUrl={profile?.avatar_url} />
        </header>

        <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-4">
            <BusinessMark workspace={workspace} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-foreground">{workspace.name}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {workspace.business_type || "Contracting business"} · {workspace.country}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="gold">{roleLabel(role)}</Badge>
                {isPlatformAdmin && (
                  <Badge tone="outline">
                    <ShieldCheck size={12} className="mr-1" /> Platform Admin
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
            <Link to="/team" className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-gold">
              <Users size={14} /> Team
            </Link>
            <Link
              to="/workspace-settings"
              className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:underline"
            >
              <Settings size={14} /> Settings
            </Link>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Team</h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Active" value={counts.active} />
            <StatCard label="Pending" value={counts.pending} />
            <StatCard label="Suspended" value={counts.suspended} />
          </div>
        </section>

        {canManageTeam && (
          <Link
            to="/team"
            className="mt-4 flex items-center justify-between rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm text-foreground"
          >
            <span className="inline-flex items-center gap-2 font-medium">
              <UserPlus size={16} className="text-gold" /> Invite a team member
            </span>
            <span className="text-gold">→</span>
          </Link>
        )}

        <ProgressSummary
          projects={(projects ?? []).filter((project) => wideAccess || myProjectIds.has(project.id))}
          stats={progressStats}
          canCreate={role !== "viewer"}
          onStart={(projectId) =>
            navigate({
              to: "/projects/$projectId",
              params: { projectId },
              search: { tab: "progress", newProgress: true },
            })
          }
        />

        <ProjectsSummary
          projects={projects}
          wideAccess={wideAccess}
          canCreate={canCreate}
          myProjectIds={myProjectIds}
        />

        <TasksSummary stats={taskStats} />

        <PhotosSummary
          stats={photoStats}
          canUpload={canUploadPhotos(role)}
          prominent={role === "field_worker" || role === "contractor"}
          onCamera={() => camera.openCamera(null)}
        />


        {projectFeed.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Recent project activity
            </h2>
            <ul className="space-y-2">
              {projectFeed.map((a) => (
                <li key={a.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                  <div className="text-foreground">
                    <span className="font-semibold">{a.actor_name ?? "Someone"}</span>{" "}
                    <span className="text-muted-foreground">{humanActivity(a.action)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {canManageTeam && audit.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Recent activity
            </h2>
            <ul className="space-y-2">
              {audit.map((a) => (
                <li key={a.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                  <div className="text-foreground">
                    {humanAction(a.action)}
                    {a.target_email ? ` — ${a.target_email}` : ""}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-8">
          <Button variant="secondary" onClick={signOut} loading={signingOut}>
            <LogOut size={18} />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProgressSummary({
  projects,
  stats,
  canCreate,
  onStart,
}: {
  projects: ProjectListItem[];
  stats: { today: number; withoutRecent: number; recent: ProgressUpdate[] } | null;
  canCreate: boolean;
  onStart: (projectId: string) => void;
}) {
  const [projectId, setProjectId] = useState("");
  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id);
  }, [projects, projectId]);

  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Daily progress</h2>
      {canCreate && projects.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-gold p-4 text-gold-foreground">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-black/15 bg-white/15">
              <ClipboardPlus size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Add Progress Update</div>
              <div className="text-xs opacity-75">Record today’s work on site</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-black/15 bg-black/10 px-3 text-sm font-medium"
              aria-label="Project for progress update"
            >
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <button onClick={() => projectId && onStart(projectId)} className="h-11 rounded-xl bg-background px-4 text-sm font-semibold text-gold">
              Start
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Updates today" value={stats?.today ?? 0} />
        <StatCard label="No recent update" value={stats?.withoutRecent ?? 0} />
      </div>
      {stats && stats.recent.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">Recent progress updates</div>
          <ul className="space-y-3">
            {stats.recent.map((update) => (
              <li key={update.id}>
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: update.project_id }}
                  search={{ tab: "progress" }}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{update.project_name}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">{update.summary}</div>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(update.work_date).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PhotosSummary({
  stats,
  canUpload,
  prominent,
  onCamera,
}: {
  stats: PhotoStats | null;
  canUpload: boolean;
  prominent: boolean;
  onCamera: () => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Photos</h2>

      {canUpload && (
        <button
          onClick={onCamera}
          className={`mb-3 flex w-full items-center justify-between rounded-2xl border px-4 text-sm font-semibold transition active:scale-[0.99] ${
            prominent
              ? "h-16 border-gold bg-gold text-gold-foreground"
              : "h-12 border-gold/30 bg-gold/10 text-foreground"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Camera size={prominent ? 22 : 16} className={prominent ? "" : "text-gold"} />
            Take or upload a photo
          </span>
          <span className={prominent ? "" : "text-gold"}>→</span>
        </button>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Uploaded today</span>
          <span className="text-xl font-semibold text-foreground">{stats?.today ?? 0}</span>
        </div>

        {stats && stats.recent.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {stats.recent.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.project_id }}
                className="relative aspect-square overflow-hidden rounded-lg border border-border bg-background"
              >
                {p.signed_url && (
                  <img
                    src={p.signed_url}
                    alt={p.caption ?? "Project photo"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
                <span
                  className={`absolute bottom-0.5 left-0.5 rounded-full border px-1 text-[8px] ${categoryTone(p.category)}`}
                >
                  {categoryLabel(p.category)}
                </span>
              </Link>
            ))}
          </div>
        )}

        {stats && stats.recent.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">No photos uploaded yet.</p>
        )}

        {stats && stats.projectsMissingBefore.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-xs font-medium text-amber-300">Missing “Before” photos</div>
            <ul className="mt-1.5 space-y-1">
              {stats.projectsMissingBefore.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: p.id }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}


function Badge({ children, tone }: { children: React.ReactNode; tone: "gold" | "outline" | "muted" }) {
  const cls =
    tone === "gold"
      ? "bg-gold text-gold-foreground"
      : tone === "outline"
        ? "border border-gold/40 text-gold"
        : "bg-surface-elevated text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function TasksSummary({
  stats,
}: {
  stats: { dueToday: number; overdue: number; mine: number; recentCompleted: TaskWithAssignee[] } | null;
}) {
  return (
    <section className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Tasks</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Due today" value={stats?.dueToday ?? 0} />
        <StatCard label="Overdue" value={stats?.overdue ?? 0} />
        <StatCard label="Assigned to me" value={stats?.mine ?? 0} />
      </div>
      {stats && stats.recentCompleted.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <CheckCircle2 size={12} /> Recently completed
          </div>
          <ul className="space-y-2">
            {stats.recentCompleted.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-foreground">{t.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {t.completed_at
                    ? new Date(t.completed_at).toLocaleDateString()
                    : taskStatusLabel(t.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ProjectsSummary({
  projects,
  wideAccess,
  canCreate,
  myProjectIds,
}: {
  projects: ProjectListItem[] | null;
  wideAccess: boolean;
  canCreate: boolean;
  myProjectIds: Set<string>;
}) {
  const list = projects ?? [];
  const visible = wideAccess ? list : list.filter((p) => myProjectIds.has(p.id));
  const active = visible.filter(
    (p) => p.status !== "completed" && p.status !== "cancelled",
  ).length;
  const attention = visible.filter((p) => NEEDS_ATTENTION_STATUSES.includes(p.status)).length;
  const mine = list.filter((p) => myProjectIds.has(p.id)).length;
  const recent = [...visible].slice(0, 3);

  return (
    <section className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Projects</h2>
        <Link to="/projects" className="text-xs font-medium text-gold hover:underline">
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active" value={active} />
        <StatCard label="Needs attention" value={attention} />
        <StatCard label="Assigned to me" value={mine} />
      </div>
      {canCreate && (
        <Link
          to="/projects/new"
          className="flex items-center justify-between rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm text-foreground"
        >
          <span className="inline-flex items-center gap-2 font-medium">
            <FolderKanban size={16} className="text-gold" /> Create a project
          </span>
          <span className="text-gold">→</span>
        </Link>
      )}
      {projects === null && (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          Loading projects…
        </div>
      )}
      {projects !== null && recent.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-4 text-sm text-muted-foreground">
          No projects yet.
        </div>
      )}
      <ul className="space-y-2">
        {recent.map((p) => (
          <li key={p.id}>
            <Link
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3 hover:border-gold/40 hover:bg-surface-elevated"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{p.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {p.customer_name ?? "No customer"} · {statusLabel(p.status)}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(p.updated_at).toLocaleDateString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BusinessMark({ workspace }: { workspace: Workspace }) {
  if (workspace.logo_url) {
    return (
      <img
        src={workspace.logo_url}
        alt={workspace.name}
        className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gold text-lg font-semibold text-gold-foreground">
      {initials(workspace.name)}
    </div>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-12 w-12 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-base font-semibold text-gold-foreground">
      {initials(name)}
    </div>
  );
}



