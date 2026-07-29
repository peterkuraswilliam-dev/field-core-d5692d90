import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { loadMembershipState } from "@/lib/workspace";

const WORKSPACE_EXEMPT = ["/admin", "/onboarding", "/blocked"];

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const user = data.user;

    if (WORKSPACE_EXEMPT.some((p) => location.pathname.startsWith(p))) {
      return { user, membership: null, workspace: null };
    }

    const state = await loadMembershipState(user.id);
    if (state.kind === "none") throw redirect({ to: "/onboarding" });
    if (state.kind === "blocked") throw redirect({ to: "/blocked" });
    return { user, workspace: state.workspace, membership: state.membership };
  },
  component: () => <Outlet />,
});
