import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserAdmin } from "@/lib/roles";
import { loadMembershipState } from "@/lib/workspace";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    const userId = data.session.user.id;

    // Handle a pending workspace invite the user opened before signing in.
    if (typeof window !== "undefined") {
      const pending = sessionStorage.getItem("pending_invite_token");
      if (pending) {
        throw redirect({ to: "/accept-invite", search: { token: pending } });
      }
    }

    const admin = await isCurrentUserAdmin(userId);
    if (admin) throw redirect({ to: "/admin" });
    const state = await loadMembershipState(userId);
    if (state.kind === "none") throw redirect({ to: "/onboarding" });
    if (state.kind === "blocked") throw redirect({ to: "/blocked" });
    throw redirect({ to: "/control-centre" });
  },
  component: () => null,
});
