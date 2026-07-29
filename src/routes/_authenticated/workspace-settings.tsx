import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Button, Field } from "@/components/auth-ui";
import { roleLabel } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/workspace-settings")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Workspace settings — Contractor OS" }],
  }),
  component: WorkspaceSettings,
});

const schema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(120),
  business_email: z.string().trim().email("Enter a valid email").max(255).or(z.literal("")),
  phone: z.string().trim().max(40),
  business_type: z.string().trim().max(80),
  country: z.string().trim().min(2).max(80),
  timezone: z.string().trim().min(2).max(80),
  logo_url: z.string().trim().max(500),
});

function WorkspaceSettings() {
  const ctx = Route.useRouteContext() as {
    workspace: {
      id: string;
      name: string;
      business_email: string | null;
      phone: string | null;
      business_type: string | null;
      country: string;
      timezone: string;
      logo_url: string | null;
    };
    membership: { role: string };
  };
  const { workspace, membership } = ctx;
  const isOwner = membership.role === "owner";
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: workspace.name,
    business_email: workspace.business_email ?? "",
    phone: workspace.phone ?? "",
    business_type: workspace.business_type ?? "",
    country: workspace.country,
    timezone: workspace.timezone,
    logo_url: workspace.logo_url ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !isOwner) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase
      .from("workspaces")
      .update({
        name: parsed.data.name,
        business_email: parsed.data.business_email || null,
        phone: parsed.data.phone || null,
        business_type: parsed.data.business_type || null,
        country: parsed.data.country,
        timezone: parsed.data.timezone,
        logo_url: parsed.data.logo_url || null,
      })
      .eq("id", workspace.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Workspace updated");
    navigate({ to: "/control-centre" });
  };

  return (
    <AuthShell>
      <div className="flex items-center justify-between">
        <Link
          to="/control-centre"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          {roleLabel(membership.role as never)}
        </span>
      </div>

      <div className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Workspace settings
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isOwner
            ? "Update your business details. Only the owner can edit these."
            : "Only the workspace owner can edit these details."}
        </p>
      </div>

      <fieldset disabled={!isOwner || loading} className="mt-6 space-y-4">
        <Field label="Business name" name="name" value={form.name} onChange={set("name")} error={errors.name} maxLength={120} />
        <Field label="Business email" name="business_email" type="email" value={form.business_email} onChange={set("business_email")} error={errors.business_email} maxLength={255} />
        <Field label="Phone number" name="phone" type="tel" value={form.phone} onChange={set("phone")} error={errors.phone} maxLength={40} />
        <Field label="Business type" name="business_type" value={form.business_type} onChange={set("business_type")} error={errors.business_type} maxLength={80} />
        <Field label="Country" name="country" value={form.country} onChange={set("country")} error={errors.country} maxLength={80} />
        <Field label="Timezone" name="timezone" value={form.timezone} onChange={set("timezone")} error={errors.timezone} maxLength={80} />
        <Field label="Business logo URL" name="logo_url" value={form.logo_url} onChange={set("logo_url")} error={errors.logo_url} maxLength={500} />
        {isOwner && (
          <Button loading={loading} onClick={submit} type="button">
            {loading ? "Saving…" : "Save changes"}
          </Button>
        )}
      </fieldset>
    </AuthShell>
  );
}
