import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async ({ context }) => {
    const { profile } = context as { profile: { role: "admin" | "user"; is_active: boolean } };
    if (!profile.is_active || profile.role !== "admin") {
      throw redirect({ to: "/control-centre" });
    }
    return { isAdmin: true as const };
  },
  component: () => <Outlet />,
});
