import { CheckCircle2, CircleAlert, Clock3, LockKeyhole, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConfidenceLabel, ProductStatus, ProjectStatus } from "@/lib/types";

type Variant = ProjectStatus | ProductStatus | ConfidenceLabel | "client_visible" | "private";

const styles: Record<Variant, string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  in_review: "border-amber-200 bg-amber-50 text-amber-800",
  published: "border-emerald-200 bg-emerald-50 text-emerald-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  needs_review: "border-amber-200 bg-amber-50 text-amber-800",
  blocked: "border-rose-200 bg-rose-50 text-rose-800",
  high: "border-emerald-200 bg-emerald-50 text-emerald-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-orange-200 bg-orange-50 text-orange-800",
  client_visible: "border-cyan-200 bg-cyan-50 text-cyan-800",
  private: "border-slate-200 bg-slate-100 text-slate-700",
};

const labels: Record<Variant, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  approved: "Approved",
  needs_review: "Needs review",
  blocked: "Blocked",
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  client_visible: "Client visible",
  private: "Private",
};

function Icon({ variant }: { variant: Variant }) {
  if (variant === "approved" || variant === "published" || variant === "high") {
    return <CheckCircle2 className="size-3.5" />;
  }
  if (variant === "blocked") {
    return <LockKeyhole className="size-3.5" />;
  }
  if (variant === "needs_review" || variant === "in_review" || variant === "medium") {
    return <Clock3 className="size-3.5" />;
  }
  if (variant === "client_visible") {
    return <Sparkles className="size-3.5" />;
  }
  return <CircleAlert className="size-3.5" />;
}

export function StatusPill({ variant, className }: { variant: Variant; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium",
        styles[variant],
        className,
      )}
    >
      <Icon variant={variant} />
      {labels[variant]}
    </span>
  );
}
