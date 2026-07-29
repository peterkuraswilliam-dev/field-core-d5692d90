import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Home,
  FolderKanban,
  Camera,
  Calendar,
  MoreHorizontal,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/auth-ui";
import { toast } from "sonner";

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

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function ControlCentre() {
  const { user, profile } = Route.useRouteContext();
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const name =
    profile?.full_name ||
    (user.user_metadata as { full_name?: string; name?: string })?.full_name ||
    (user.user_metadata as { name?: string })?.name ||
    user.email?.split("@")[0] ||
    "there";
  const firstName = name.split(" ")[0];

  const signOut = async () => {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("We couldn't sign you out. Please try again.");
      setSigningOut(false);
      return;
    }
    toast.success("Signed out securely");
    navigate({ to: "/auth", search: { reason: "signed-out" }, replace: true });
  };

  return (
    <div className="relative min-h-screen bg-background pb-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_82/0.15),transparent_60%)]"
      />
      <div className="relative mx-auto w-full max-w-md px-5 pt-8 sm:pt-12">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Control Centre
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Welcome back, {firstName}
            </h1>
          </div>
          <Avatar name={name} email={user.email} avatarUrl={profile?.avatar_url} />
        </header>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold capitalize text-gold">
          {profile.role === "admin" && <ShieldCheck size={13} />}
          {profile.role}
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_20px_2px_oklch(0.78_0.14_82/0.6)]" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Your contractor workspace will appear here
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Projects, calendar, photos and your team will land in Control Centre as we roll out
                the next stages.
              </p>
            </div>
          </div>
        </section>

        {profile.role === "admin" && (
          <section className="mt-4 rounded-2xl border border-gold/35 bg-gradient-to-br from-gold/10 to-surface p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-gold-foreground">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-foreground">Admin controls</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Admin controls will appear here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/admin" })}
                className="min-h-10 rounded-xl border border-gold/30 px-3 text-sm font-semibold text-gold transition hover:bg-gold/10"
              >
                Admin
              </button>
            </div>
          </section>
        )}

        <section className="mt-4 grid grid-cols-2 gap-3">
          {[
            { label: "Active projects", value: "—" },
            { label: "This week", value: "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {s.label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{s.value}</div>
            </div>
          ))}
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

function Avatar({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
}) {
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
      {initials(name, email)}
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
