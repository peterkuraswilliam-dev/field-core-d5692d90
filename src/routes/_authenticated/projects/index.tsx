import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, MapPin, Users, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  fetchProjects,
  canCreateProjects,
  PROJECT_STATUSES,
  statusLabel,
  type ProjectListItem,
  type ProjectStatus,
} from "@/lib/projects";
import { StatusPill } from "@/components/project-ui";
import type { Membership, Workspace, WorkspaceRole } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/projects/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Projects — Contractor OS" },
      { name: "description", content: "Browse and manage every job in your workspace." },
      { property: "og:title", content: "Projects — Contractor OS" },
      { property: "og:description", content: "Browse and manage every job in your workspace." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const ctx = Route.useRouteContext() as {
    user: { id: string };
    workspace: Workspace;
    membership: Membership;
  };
  const { user, workspace, membership } = ctx;
  const role = membership.role as WorkspaceRole;
  const canCreate = canCreateProjects(role);
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    fetchProjects(workspace.id)
      .then(setProjects)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load projects"));
  }, [workspace.id]);

  const filtered = useMemo(() => {
    if (!projects) return [];
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (mineOnly && !(p.assigned_names.length && p.assigned_names)) {
        // Fall through — filter below via user id
      }
      if (mineOnly) {
        // We need the user ids. Simpler: refetch project_members? Instead check assigned_names impossible.
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.customer_name ?? "").toLowerCase().includes(q) ||
        (p.job_address ?? "").toLowerCase().includes(q)
      );
    });
  }, [projects, query, status, mineOnly]);

  // Fetch assignments-by-user for mineOnly filter
  const [myProjectIds, setMyProjectIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!mineOnly) {
      setMyProjectIds(null);
      return;
    }
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id)
        .eq("workspace_id", workspace.id);
      setMyProjectIds(new Set((data ?? []).map((r) => r.project_id)));
    })();
  }, [mineOnly, user.id, workspace.id]);

  const finalList = useMemo(() => {
    if (!mineOnly || !myProjectIds) return filtered;
    return filtered.filter((p) => myProjectIds.has(p.id));
  }, [filtered, mineOnly, myProjectIds]);

  return (
    <div className="relative min-h-screen bg-background pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_82/0.12),transparent_60%)]"
      />
      <div className="relative mx-auto w-full max-w-3xl px-5 pt-6">
        <header className="flex items-center justify-between">
          <Link to="/control-centre" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} /> Back
          </Link>
          {canCreate && (
            <button
              onClick={() => navigate({ to: "/projects/new" })}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-2 text-sm font-semibold text-gold-foreground"
            >
              <Plus size={16} /> New project
            </button>
          )}
        </header>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Projects</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{workspace.name}</h1>
        </div>

        <div className="mt-5 space-y-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search project, customer or address"
              className="w-full rounded-xl border border-border bg-input py-3 pl-9 pr-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
            />
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1">
            <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
              All
            </FilterChip>
            {PROJECT_STATUSES.map((s) => (
              <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                {statusLabel(s)}
              </FilterChip>
            ))}
          </div>
          <label className="inline-flex select-none items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              className="h-4 w-4 accent-[oklch(0.78_0.14_82)]"
            />
            Assigned to me only
          </label>
        </div>

        <section className="mt-6">
          {projects === null && <div className="text-sm text-muted-foreground">Loading projects…</div>}
          {projects && finalList.length === 0 && (
            <EmptyState canCreate={canCreate} onCreate={() => navigate({ to: "/projects/new" })} />
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {finalList.map((p) => (
              <li key={p.id}>
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="block h-full rounded-2xl border border-border bg-surface p-4 transition hover:border-gold/50 hover:bg-surface-elevated"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-foreground">{p.name}</div>
                      {p.customer_name && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.customer_name}
                        </div>
                      )}
                    </div>
                    <StatusPill status={p.status} />
                  </div>
                  {p.job_address && (
                    <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin size={13} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{p.job_address}</span>
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} /> {p.assigned_count} assigned
                    </span>
                    <span>
                      {p.start_date ? `Starts ${new Date(p.start_date).toLocaleDateString()}` : "No start date"}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground/70">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-gold bg-gold text-gold-foreground"
          : "border-border bg-surface text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 text-gold">
        <Plus size={22} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">No projects yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {canCreate
          ? "Create your first project to start tracking jobs, customers and teams."
          : "You haven't been assigned to any projects yet."}
      </p>
      {canCreate && (
        <button
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground"
        >
          <Plus size={16} /> Create project
        </button>
      )}
    </div>
  );
}
