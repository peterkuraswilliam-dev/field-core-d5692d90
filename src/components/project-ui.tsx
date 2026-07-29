import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { statusLabel, statusTone, type ProjectStatus } from "@/lib/projects";

export function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function BackLink({ to, label = "Back" }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft size={16} /> {label}
    </Link>
  );
}

export function initials(source: string): string {
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
