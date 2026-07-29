import { Hammer } from "lucide-react";

export function BrandLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-14 w-14";
  const icon = size === "lg" ? 32 : size === "sm" ? 20 : 26;
  return (
    <div className="flex items-center gap-3">
      <div
        className={`${dims} flex items-center justify-center rounded-2xl bg-gold text-gold-foreground shadow-[0_10px_30px_-10px_oklch(0.78_0.14_82/0.5)]`}
      >
        <Hammer size={icon} strokeWidth={2.4} />
      </div>
      <div className="leading-tight">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Contractor</div>
        <div className="text-lg font-semibold text-foreground">OS</div>
      </div>
    </div>
  );
}
