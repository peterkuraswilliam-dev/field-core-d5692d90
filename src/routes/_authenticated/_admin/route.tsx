import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isCurrentUserAdmin } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async ({ context }) => {
    const { user } = context as { user: { id: string } };
    const admin = await isCurrentUserAdmin(user.id);
    if (!admin) throw redirect({ to: "/control-centre" });
    return { isAdmin: true as const };
  },
  component: () => <Outlet />,
});
