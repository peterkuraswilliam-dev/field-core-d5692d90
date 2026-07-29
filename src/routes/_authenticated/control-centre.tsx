import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, FolderKanban, Camera, Calendar, MoreHorizontal, LogOut, Settings, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/auth-ui";
import { toast } from "sonner";
import { isCurrentUserAdmin } from "@/lib/roles";
import { roleLabel, type Workspace, type Membership } from "@/lib/workspace";

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

function ControlCentre() {
  const ctx = Route.useRouteContext() as {
    user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
    workspace: Workspace;
    membership: Membership;
  };
  const { user, workspace, membership } = ctx;
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
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
    supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("status", "active")
      .then(({ count }) => setMemberCount(count ?? null));
    isCurrentUserAdmin(user.id).then(setIsPlatformAdmin);
  }, [user.id, workspace.id]);

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
                <Badge tone="gold">{roleLabel(membership.role)}</Badge>
                {isPlatformAdmin && (
                  <Badge tone="outline">
                    <ShieldCheck size={12} className="mr-1" /> Platform Admin
                  </Badge>
                )}
                <Badge tone="muted">Setup complete</Badge>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
            <div className="text-muted-foreground">
              Team members: <span className="text-foreground">{memberCount ?? "—"}</span>
            </div>
            <Link
              to="/workspace-settings"
              className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:underline"
            >
              <Settings size={14} /> Settings
            </Link>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <PlaceholderCard label="Active projects" value="—" hint="Coming soon" />
          <PlaceholderCard label="Today's schedule" value="—" hint="Coming soon" />
        </section>

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
  const items = [
    { label: "Home", icon: Home, active: true },
    { label: "Projects", icon: FolderKanban },
    { label: "Calendar", icon: Calendar },
    { label: "More", icon: MoreHorizontal },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex w-full max-w-md items-end justify-between px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        <NavBtn item={items[0]} />
        <NavBtn item={items[1]} />
        <button
          aria-label="Camera"
          className="-mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-gold text-gold-foreground shadow-[0_12px_30px_-8px_oklch(0.78_0.14_82/0.6)] active:scale-95"
        >
          <Camera size={26} strokeWidth={2.2} />
        </button>
        <NavBtn item={items[2]} />
        <NavBtn item={items[3]} />
      </div>
    </nav>
  );
}

function NavBtn({
  item,
}: {
  item: { label: string; icon: React.ComponentType<{ size?: number }>; active?: boolean };
}) {
  const Icon = item.icon;
  return (
    <button
      className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] transition ${
        item.active ? "text-gold" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon size={22} />
      <span>{item.label}</span>
    </button>
  );
}
