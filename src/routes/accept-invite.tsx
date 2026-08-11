import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Button } from "@/components/auth-ui";
import { BrandLogo } from "@/components/brand-logo";
import { previewInvitation, acceptInvitation, type WorkspaceRole } from "@/lib/team";
import { roleLabel } from "@/lib/workspace";

const search = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/accept-invite")({
  ssr: false,
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Accept invitation — Contractor OS" },
      { name: "description", content: "Join a workspace on Contractor OS." },
    ],
  }),
  component: AcceptInvite,
});

type Preview = {
  invitation_id: string;
  workspace_id: string;
  workspace_name: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  expires_at: string;
};

function AcceptInvite() {
  const { token } = useSearch({ from: "/accept-invite" });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) {
        setError("Missing invitation token.");
        setLoading(false);
        return;
      }
      try {
        const p = await previewInvitation(token);
        if (!p) setError("This invitation link is invalid.");
        else setPreview(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load invitation.");
      }
      const { data } = await supabase.auth.getUser();
      setSignedInEmail(data.user?.email ?? null);
      setLoading(false);
    })();
  }, [token]);

  const goSignIn = () => {
    if (token) sessionStorage.setItem("pending_invite_token", token);
    navigate({ to: "/auth", search: token ? { invite: token } : {} });
  };

  const accept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      await acceptInvitation(token);
      sessionStorage.removeItem("pending_invite_token");
      toast.success("Welcome to the team!");
      navigate({ to: "/control-centre", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to accept invitation");
      setAccepting(false);
    }
  };

  return (
    <AuthShell>
      <div className="flex items-center justify-between">
        <BrandLogo />
      </div>

      <div className="mt-10">
        <h1 className="text-3xl font-semibold tracking-tight">Workspace invitation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review the details below to join the workspace.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
        {loading && <div className="text-sm text-muted-foreground">Loading invitation…</div>}
        {!loading && error && <div className="text-sm text-destructive">{error}</div>}
        {!loading && preview && (
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Business
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {preview.workspace_name}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Invited email</div>
                <div className="text-foreground">{preview.email}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Role</div>
                <div className="text-foreground">{roleLabel(preview.role)}</div>
              </div>
            </div>

            {preview.status !== "pending" && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                This invitation is {preview.status}.
              </div>
            )}

            {preview.status === "pending" && !signedInEmail && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-surface-elevated p-3 text-sm text-muted-foreground">
                  Sign in with <span className="text-foreground">{preview.email}</span> to accept.
                </div>
                <Button onClick={goSignIn}>Sign in to accept</Button>
              </div>
            )}

            {preview.status === "pending" && signedInEmail && (
              <div className="space-y-3">
                {signedInEmail.toLowerCase() !== preview.email.toLowerCase() ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    You're signed in as {signedInEmail}. This invitation was sent to {preview.email}
                    .
                  </div>
                ) : (
                  <Button onClick={accept} loading={accepting}>
                    Accept and join workspace
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/auth" search={token ? { invite: token } : {}} className="hover:text-foreground">
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
