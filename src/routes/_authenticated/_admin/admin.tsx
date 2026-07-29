import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, ShieldCheck, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/auth-ui";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Contractor OS" },
      { name: "description", content: "Administrator control panel." },
      { property: "og:title", content: "Admin Dashboard — Contractor OS" },
      { property: "og:description", content: "Administrator control panel." },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [roleCount, setRoleCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .then(({ count }) => setRoleCount(count ?? 0));
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="relative min-h-screen bg-background pb-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_82/0.18),transparent_60%)]"
      />
      <div className="relative mx-auto w-full max-w-md px-5 pt-8 sm:pt-12">
        <header className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-gold">
              <ShieldCheck size={14} /> Admin
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-gold/40 bg-surface p-6">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_20px_2px_oklch(0.78_0.14_82/0.6)]" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                You have full administrator access
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                This surface is protected by database-level Row Level Security and a server-checked
                role guard. Regular users cannot reach it.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Users size={14} /> Admins
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {roleCount ?? "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Role</div>
            <div className="mt-2 text-2xl font-semibold text-gold">admin</div>
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-3">
          <Button variant="secondary" onClick={() => navigate({ to: "/control-centre" })}>
            Go to Control Centre
          </Button>
          <Button variant="secondary" onClick={signOut} loading={signingOut}>
            <LogOut size={18} />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
