import { createFileRoute, Link, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserAdmin } from "@/lib/roles";
import { lovable } from "@/integrations/lovable";
import { AuthShell, Button, Divider, Field, GoogleButton } from "@/components/auth-ui";
import { BrandLogo } from "@/components/brand-logo";

const authSearch = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: authSearch,
  head: () => ({
    meta: [
      { title: "Sign in — Contractor OS" },
      { name: "description", content: "Sign in to manage your projects and team." },
      { property: "og:title", content: "Sign in — Contractor OS" },
      { property: "og:description", content: "Sign in to manage your projects and team." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const admin = await isCurrentUserAdmin(data.session.user.id);
      throw redirect({ to: admin ? "/admin" : "/control-centre" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const { mode } = useSearch({ from: "/auth" });
  const [tab, setTab] = useState<"signin" | "signup">(mode ?? "signin");

  return (
    <AuthShell>
      <div className="flex items-center justify-between">
        <BrandLogo />
      </div>

      <div className="mt-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {tab === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tab === "signin"
            ? "Sign in to manage your projects and team."
            : "Set up your workspace in under a minute."}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1">
        {(["signin", "signup"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`h-10 rounded-lg text-sm font-medium transition ${
              tab === k
                ? "bg-gold text-gold-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {k === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <div className="mt-6">{tab === "signin" ? <SignInForm /> : <SignUpForm onSwitch={() => setTab("signin")} />}</div>
    </AuthShell>
  );
}

function useGoogle() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const go = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Google sign-in failed. Please try again.");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch {
      toast.error("Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };
  return { loading, go };
}

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const google = useGoogle();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const msg = /invalid/i.test(error.message)
        ? "Invalid email or password."
        : /network/i.test(error.message)
          ? "Network error. Check your connection."
          : error.message;
      toast.error(msg);
      return;
    }
    toast.success("Signed in");
    navigate({ to: "/" });
  };

  return (
    <div>
      <GoogleButton onClick={google.go} loading={google.loading} />
      <Divider>or</Divider>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Field
          label="Password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          trailing={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-gold hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button loading={loading} type="submit">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(80),
    email: z.string().trim().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Za-z]/, "Include a letter")
      .regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

function SignUpForm({ onSwitch }: { onSwitch: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const google = useGoogle();

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
          ✓
        </div>
        <h2 className="text-lg font-semibold text-foreground">Check your inbox</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a verification link to <span className="text-foreground">{email}</span>. Confirm
          your email to activate your account.
        </p>
        <button onClick={onSwitch} className="mt-5 text-sm font-medium text-gold hover:underline">
          Back to sign in
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({ fullName, email, password, confirm });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/control-centre`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      const msg = /already/i.test(error.message)
        ? "That email is already registered."
        : error.message;
      toast.error(msg);
      return;
    }
    if (data.user && !data.session) {
      setSent(true);
      toast.success("Verification email sent");
    } else {
      toast.success("Account created");
      window.location.href = "/control-centre";
    }
  };

  return (
    <div>
      <GoogleButton onClick={google.go} loading={google.loading} />
      <Divider>or</Divider>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Full name"
          name="fullName"
          autoComplete="name"
          placeholder="Alex Carter"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Field
          label="Password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          trailing={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
        <Field
          label="Confirm password"
          name="confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />
        <Button loading={loading} type="submit">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
