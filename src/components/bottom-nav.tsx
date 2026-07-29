import { Link, useRouterState } from "@tanstack/react-router";
import { Home, FolderKanban, Camera, Calendar, Users } from "lucide-react";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) =>
    to === "/control-centre" ? pathname === to : pathname.startsWith(to);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex w-full max-w-md items-end justify-between px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        <NavBtn label="Home" Icon={Home} to="/control-centre" active={isActive("/control-centre")} />
        <NavBtn label="Projects" Icon={FolderKanban} to="/projects" active={isActive("/projects")} />
        <button
          aria-label="Camera"
          className="-mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-gold text-gold-foreground shadow-[0_12px_30px_-8px_oklch(0.78_0.14_82/0.6)] active:scale-95"
        >
          <Camera size={26} strokeWidth={2.2} />
        </button>
        <NavBtn label="Calendar" Icon={Calendar} />
        <NavBtn label="Team" Icon={Users} to="/team" active={isActive("/team")} />
      </div>
    </nav>
  );
}

function NavBtn({
  label,
  Icon,
  active,
  to,
}: {
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  active?: boolean;
  to?: string;
}) {
  const cls = `flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] transition ${
    active ? "text-gold" : "text-muted-foreground hover:text-foreground"
  }`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        <Icon size={22} />
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <button className={cls}>
      <Icon size={22} />
      <span>{label}</span>
    </button>
  );
}
