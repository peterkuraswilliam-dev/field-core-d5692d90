import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button, Field } from "@/components/auth-ui";
import { BackLink } from "@/components/project-ui";
import {
  canCreateProjects,
  createProject,
  PROJECT_STATUSES,
  statusLabel,
  type ProjectStatus,
} from "@/lib/projects";
import { fetchTeamMembers, type TeamMember } from "@/lib/team";
import type { Membership, Workspace, WorkspaceRole } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/projects/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New project — Contractor OS" },
      { name: "description", content: "Start a new job in your contractor workspace." },
    ],
  }),
  component: NewProjectPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Project name is required").max(120),
  customer_name: z.string().trim().max(120).optional(),
  customer_email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Invalid email")
    .optional(),
  customer_phone: z.string().trim().max(40).optional(),
  job_address: z.string().trim().max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(PROJECT_STATUSES as [ProjectStatus, ...ProjectStatus[]]),
  start_date: z.string().optional(),
  expected_completion_date: z.string().optional(),
});

function NewProjectPage() {
  const ctx = Route.useRouteContext() as {
    user: { id: string };
    workspace: Workspace;
    membership: Membership;
  };
  const { user, workspace, membership } = ctx;
  const role = membership.role as WorkspaceRole;
  const navigate = useNavigate();

  useEffect(() => {
    if (!canCreateProjects(role)) {
      toast.error("You do not have permission to create projects.");
      navigate({ to: "/projects" });
    }
  }, [role, navigate]);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [form, setForm] = useState({
    name: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    job_address: "",
    description: "",
    status: "enquiry" as ProjectStatus,
    start_date: "",
    expected_completion_date: "",
  });
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeamMembers(workspace.id)
      .then((rows) => setTeam(rows.filter((r) => r.status === "active")))
      .catch(() => undefined);
  }, [workspace.id]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleAssign = (userId: string) => {
    setAssigned((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path[0] as string] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const project = await createProject({
        workspace_id: workspace.id,
        created_by: user.id,
        ...parsed.data,
        assigned_user_ids: Array.from(assigned),
      });
      toast.success("Project created");
      navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background pb-24">
      <div className="mx-auto w-full max-w-2xl px-5 pt-6">
        <BackLink to="/projects" />
        <div className="mt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            New project
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Create project</h1>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-5">
          <Section title="Project">
            <Field
              label="Project name"
              name="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              error={errors.name}
              required
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/90">Status</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as ProjectStatus)}
                className="w-full rounded-xl border border-border bg-input px-4 py-3.5 text-base text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/90">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
              />
            </div>
          </Section>

          <Section title="Customer">
            <Field
              label="Customer name"
              name="customer_name"
              value={form.customer_name}
              onChange={(e) => set("customer_name", e.target.value)}
            />
            <Field
              label="Customer email"
              name="customer_email"
              type="email"
              value={form.customer_email}
              onChange={(e) => set("customer_email", e.target.value)}
              error={errors.customer_email}
            />
            <Field
              label="Customer phone"
              name="customer_phone"
              value={form.customer_phone}
              onChange={(e) => set("customer_phone", e.target.value)}
            />
          </Section>

          <Section title="Job">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/90">
                Job address
              </label>
              <textarea
                value={form.job_address}
                onChange={(e) => set("job_address", e.target.value)}
                rows={2}
                maxLength={300}
                className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Start date"
                name="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
              />
              <Field
                label="Expected completion"
                name="expected_completion_date"
                type="date"
                value={form.expected_completion_date}
                onChange={(e) => set("expected_completion_date", e.target.value)}
              />
            </div>
          </Section>

          <Section title="Assign team">
            {team.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface/60 p-4 text-sm text-muted-foreground">
                No active workspace members to assign yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {team.map((m) => (
                  <li key={m.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:bg-surface-elevated">
                      <input
                        type="checkbox"
                        checked={assigned.has(m.user_id)}
                        onChange={() => toggleAssign(m.user_id)}
                        className="h-4 w-4 accent-[oklch(0.78_0.14_82)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {m.full_name?.trim() || m.email?.split("@")[0] || "Member"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving}>
              Create project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
