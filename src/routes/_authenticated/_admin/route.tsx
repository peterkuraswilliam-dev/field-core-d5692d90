import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { verifyAdminAccess } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async () => {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      throw redirect({ to: "/control-centre" });
    }
    return { isAdmin: true as const };
  },
  component: () => <Outlet />,
});
