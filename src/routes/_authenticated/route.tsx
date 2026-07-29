import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getAuthAccess } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const access = await getAuthAccess();
    if (access.status === "anonymous") throw redirect({ to: "/auth" });
    if (access.status === "inactive") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { reason: "inactive" } });
    }
    if (access.status === "profile-error") {
      throw redirect({ to: "/auth", search: { reason: "profile" } });
    }
    return { user: access.user, profile: access.profile };
  },
  component: () => <Outlet />,
});
