import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Home,
  FolderKanban,
  Camera,
  Calendar,
  MoreHorizontal,
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

  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [counts, setCounts] = useState<Counts>({ active: 0, pending: 0, suspended: 0 });
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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

    isCurrentUserAdmin(user.id).then(setIsPlatformAdmin);
  }, [user.id, workspace.id, canManageTeam]);

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
    <div className="relative min-h-screen bg-background pb-28">
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

        <section className="mt-4 grid grid-cols-3 gap-3">
          <StatCard label="Active" value={counts.active} />
          <StatCard label="Pending" value={counts.pending} />
          <StatCard label="Suspended" value={counts.suspended} />
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

        <section className="mt-4 grid grid-cols-2 gap-3">
          <PlaceholderCard label="Active projects" value="—" hint="Coming soon" />
          <PlaceholderCard label="Today's schedule" value="—" hint="Coming soon" />
        </section>

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

      <BottomNav />
    </div>
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

function PlaceholderCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
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

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex w-full max-w-md items-end justify-between px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        <NavBtn label="Home" Icon={Home} active />
        <NavBtn label="Projects" Icon={FolderKanban} />
        <button
          aria-label="Camera"
          className="-mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-gold text-gold-foreground shadow-[0_12px_30px_-8px_oklch(0.78_0.14_82/0.6)] active:scale-95"
        >
          <Camera size={26} strokeWidth={2.2} />
        </button>
        <NavBtn label="Calendar" Icon={Calendar} />
        <NavBtn label="Team" Icon={Users} to="/team" />
      </div>
    </nav>
  );
}

function NavBtn({
  label,
  Icon,
  active,
  to,
}: {
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  active?: boolean;
  to?: string;
}) {
  const cls = `flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] transition ${
    active ? "text-gold" : "text-muted-foreground hover:text-foreground"
  }`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        <Icon size={22} />
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <button className={cls}>
      <Icon size={22} />
      <span>{label}</span>
    </button>
  );
}

// Keep the More icon import warning at bay if unused elsewhere.
void MoreHorizontal;

