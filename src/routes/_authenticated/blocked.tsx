import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldAlert, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { AuthShell, Button } from "@/components/auth-ui";

export const Route = createFileRoute("/_authenticated/blocked")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Access blocked — Contractor OS" }],
  }),
  component: Blocked,
});

function Blocked() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <AuthShell>
      <div className="mt-16 rounded-2xl border border-border bg-surface p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert size={28} />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Access blocked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your workspace membership is currently suspended or has been removed. Contact your
          workspace owner to restore access.
        </p>
        <div className="mt-6">
          <Button variant="secondary" onClick={signOut}>
            <LogOut size={18} />
            Sign out
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
