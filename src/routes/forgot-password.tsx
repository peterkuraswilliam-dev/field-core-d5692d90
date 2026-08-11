import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Button, Field } from "@/components/auth-ui";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Contractor OS" },
      { name: "description", content: "Request a secure link to reset your password." },
      { property: "og:title", content: "Reset password — Contractor OS" },
      { property: "og:description", content: "Request a secure link to reset your password." },
    ],
  }),
  component: ForgotPage,
});

const schema = z.object({ email: z.string().trim().email("Enter a valid email") });

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(undefined);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Reset link sent");
  };

  return (
    <AuthShell>
      <div className="flex items-center justify-between">
        <BrandLogo />
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
          <span className="inline-flex items-center gap-1">
            <ArrowLeft size={16} /> Back
          </span>
        </Link>
      </div>

      <div className="mt-10">
        <h1 className="text-3xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the email you use for Contractor OS and we'll send a secure reset link.
        </p>
      </div>

      {sent ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
            ✓
          </div>
          <h2 className="text-lg font-semibold">Check your inbox</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If an account exists for <span className="text-foreground">{email}</span>, a reset link
            is on the way.
          </p>
          <Link
            to="/auth"
            className="mt-5 inline-block text-sm font-medium text-gold hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <Button loading={loading} type="submit">
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
