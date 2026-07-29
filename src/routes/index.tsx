import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthAccess } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const access = await getAuthAccess();
    if (access.status !== "authenticated") throw redirect({ to: "/auth" });
    throw redirect({ to: "/control-centre" });
  },
  component: () => null,
});
