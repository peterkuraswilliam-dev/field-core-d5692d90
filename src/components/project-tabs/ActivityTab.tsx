import { useEffect, useState } from "react";
import { toast } from "sonner";
import { initials } from "@/components/project-ui";
import {
  fetchProjectActivity,
  humanActivity,
  type ActivityEntry,
} from "@/lib/activity";

export function ActivityTab({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    fetchProjectActivity(projectId)
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load activity"));
  }, [projectId]);

  if (rows === null) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
        Loading activity…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground">
        No activity yet.
      </div>
    );
  }

  return (
    <ol className="relative space-y-3 border-l border-border/60 pl-5">
      {rows.map((r) => {
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        const detail = detailFor(r.action, meta, r.target_name);
        return (
          <li key={r.id} className="relative">
            <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border border-gold/50 bg-gold/40" />
            <div className="rounded-2xl border border-border bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[9px] font-semibold text-gold-foreground">
                  {initials(r.actor_name ?? "Sys")}
                </span>
                <div className="min-w-0 flex-1 text-sm text-foreground">
                  <span className="font-semibold">{r.actor_name ?? "System"}</span>{" "}
                  <span className="text-muted-foreground">{humanActivity(r.action)}</span>
                  {detail && <span className="text-foreground/90"> — {detail}</span>}
                </div>
              </div>
              <div className="mt-1.5 pl-8 text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function detailFor(
  action: string,
  meta: Record<string, unknown>,
  targetName: string | null,
): string | null {
  const title = typeof meta.title === "string" ? meta.title : null;
  const from = typeof meta.from === "string" ? meta.from.replace(/_/g, " ") : null;
  const to = typeof meta.to === "string" ? meta.to.replace(/_/g, " ") : null;
  switch (action) {
    case "project.status_changed":
      return from && to ? `${from} → ${to}` : null;
    case "task.status_changed":
      return title && from && to ? `“${title}” · ${from} → ${to}` : title;
    case "task.created":
    case "task.completed":
      return title;
    case "task.assigned":
      return targetName ? `${title ? `“${title}” to ` : ""}${targetName}` : title;
    case "member.assigned":
    case "member.removed":
      return targetName;
    case "photo.uploaded":
    case "photo.caption_updated":
    case "photo.deleted": {
      const cat = typeof meta.category === "string" ? meta.category : null;
      const count = typeof meta.count === "number" && meta.count > 1 ? `${meta.count} photos` : null;
      return [count, cat].filter(Boolean).join(" · ") || null;
    }

    default:
      return null;
  }
}
