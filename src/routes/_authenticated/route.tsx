import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { loadMembershipState } from "@/lib/workspace";
import { BottomNav } from "@/components/bottom-nav";

const WORKSPACE_EXEMPT = ["/admin", "/onboarding", "/blocked"];
const HIDE_BOTTOM_NAV = ["/onboarding", "/blocked"];

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
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showNav = !HIDE_BOTTOM_NAV.some((p) => pathname.startsWith(p));
  return (
    <>
      <div className={showNav ? "pb-28" : undefined}>
        <Outlet />
      </div>
      {showNav && <BottomNav />}
    </>
  );
}
