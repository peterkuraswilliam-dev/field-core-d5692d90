import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserAdmin } from "@/lib/roles";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    const admin = await isCurrentUserAdmin(data.session.user.id);
    throw redirect({ to: admin ? "/admin" : "/control-centre" });
  },
  component: () => null,
});
