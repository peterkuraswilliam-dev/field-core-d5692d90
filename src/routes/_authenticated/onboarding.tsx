import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Button, Field } from "@/components/auth-ui";
import { BrandLogo } from "@/components/brand-logo";
import { createWorkspace, loadMembershipState } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set up your business — Contractor OS" },
      { name: "description", content: "Create your business workspace to get started." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const state = await loadMembershipState(data.user.id);
    if (state.kind === "active") throw redirect({ to: "/control-centre" });
    if (state.kind === "blocked") throw redirect({ to: "/blocked" });
    return { user: data.user };
  },
  component: Onboarding,
});

const schema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(120),
  ownerFullName: z.string().trim().min(2, "Enter your full name").max(120),
  businessEmail: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(5, "Enter a phone number").max(40),
  businessType: z.string().trim().min(2, "Select a trade").max(80),
  country: z.string().trim().min(2).max(80),
  timezone: z.string().trim().min(2).max(80),
  logoUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

const TRADES = [
  "General Contractor",
  "Electrician",
  "Plumbing",
  "Roofing",
  "Carpentry",
  "HVAC",
  "Landscaping",
  "Painting",
  "Other",
];

function Onboarding() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const [form, setForm] = useState({
    name: "",
    ownerFullName: meta.full_name || meta.name || "",
    businessEmail: user.email ?? "",
    phone: "",
    businessType: "General Contractor",
    country: "United Kingdom",
    timezone: "Europe/London",
    logoUrl: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await createWorkspace({
        name: parsed.data.name,
        ownerFullName: parsed.data.ownerFullName,
        businessEmail: parsed.data.businessEmail,
        phone: parsed.data.phone,
        businessType: parsed.data.businessType,
        country: parsed.data.country,
        timezone: parsed.data.timezone,
        logoUrl: parsed.data.logoUrl || undefined,
      });
      toast.success("Workspace created");
      navigate({ to: "/control-centre" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create workspace";
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <BrandLogo />
      <div className="mt-10">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Business setup
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Create your workspace
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us about your business. You'll be the workspace owner.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field
          label="Business name"
          name="name"
          placeholder="Acme Contracting Ltd"
          value={form.name}
          onChange={set("name")}
          error={errors.name}
          maxLength={120}
        />
        <Field
          label="Owner full name"
          name="ownerFullName"
          placeholder="Alex Carter"
          value={form.ownerFullName}
          onChange={set("ownerFullName")}
          error={errors.ownerFullName}
          maxLength={120}
        />
        <Field
          label="Business email"
          name="businessEmail"
          type="email"
          inputMode="email"
          placeholder="hello@acme.co.uk"
          value={form.businessEmail}
          onChange={set("businessEmail")}
          error={errors.businessEmail}
          maxLength={255}
        />
        <Field
          label="Phone number"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="+44 20 7946 0000"
          value={form.phone}
          onChange={set("phone")}
          error={errors.phone}
          maxLength={40}
        />
        <SelectField
          label="Primary trade"
          value={form.businessType}
          onChange={set("businessType")}
          options={TRADES}
          error={errors.businessType}
        />
        <Field
          label="Country"
          name="country"
          value={form.country}
          onChange={set("country")}
          error={errors.country}
          maxLength={80}
        />
        <Field
          label="Timezone"
          name="timezone"
          value={form.timezone}
          onChange={set("timezone")}
          error={errors.timezone}
          maxLength={80}
        />
        <Field
          label="Business logo URL (optional)"
          name="logoUrl"
          placeholder="https://…"
          value={form.logoUrl}
          onChange={set("logoUrl")}
          error={errors.logoUrl}
          maxLength={500}
        />
        <Button loading={loading} type="submit">
          {loading ? "Creating workspace…" : "Create workspace"}
        </Button>
      </form>
    </AuthShell>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  error?: string;
}) {
  return (
    <div className="w-full">
      <label className="mb-1.5 block text-sm font-medium text-foreground/90">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-border bg-input px-4 py-3.5 text-base text-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
