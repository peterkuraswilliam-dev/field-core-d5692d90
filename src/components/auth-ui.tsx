import { forwardRef, type InputHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; trailing?: ReactNode }>(
  ({ label, error, trailing, className, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="w-full">
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-foreground/90">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-xl border border-border bg-input px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground/70",
              "outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40",
              "disabled:cursor-not-allowed disabled:opacity-60",
              trailing && "pr-12",
              error && "border-destructive focus:border-destructive focus:ring-destructive/30",
              className,
            )}
            {...props}
          />
          {trailing && (
            <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
      </div>
    );
  },
);
Field.displayName = "Field";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
};

export function Button({ variant = "primary", loading, className, children, disabled, ...props }: BtnProps) {
  const base =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";
  const variants: Record<string, string> = {
    primary:
      "bg-gold text-gold-foreground shadow-[0_10px_30px_-12px_oklch(0.78_0.14_82/0.55)] hover:brightness-105",
    secondary:
      "border border-border bg-surface text-foreground hover:bg-surface-elevated",
    ghost: "text-foreground hover:bg-surface",
  };
  return (
    <button
      className={cn(base, variants[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_82/0.15),transparent_60%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8 sm:py-14">
        {children}
      </div>
    </div>
  );
}

export function GoogleButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <Button variant="secondary" onClick={onClick} loading={loading} type="button">
      {!loading && (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.4 29.3 4.5 24 4.5c-7.7 0-14.3 4.4-17.7 10.2z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.1C29.2 35 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.5 5C9.6 39.5 16.3 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.1C41 34.3 44 29.6 44 24c0-1.2-.1-2.3-.4-3.5z"/>
        </svg>
      )}
      Continue with Google
    </Button>
  );
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      <span>{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
