import { cn } from "@/lib/utils";
import { ShieldCheck, AlertTriangle, AlertCircle, XOctagon } from "lucide-react";
import { ScanVerdict } from "@workspace/api-client-react/src/generated/api.schemas";

interface VerdictBadgeProps {
  verdict: ScanVerdict | string | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function VerdictBadge({ verdict, className, size = "md" }: VerdictBadgeProps) {
  if (!verdict) return null;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-sm gap-1.5",
    lg: "px-4 py-2 text-base gap-2"
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5"
  };

  switch (verdict.toLowerCase()) {
    case "safe":
      return (
        <div className={cn("inline-flex items-center font-semibold rounded-full bg-safe/10 text-safe border border-safe/20 shadow-sm", sizeClasses[size], className)}>
          <ShieldCheck className={iconSizes[size]} />
          SAFE
        </div>
      );
    case "caution":
      return (
        <div className={cn("inline-flex items-center font-semibold rounded-full bg-caution/10 text-caution border border-caution/20 shadow-sm", sizeClasses[size], className)}>
          <AlertTriangle className={iconSizes[size]} />
          CAUTION
        </div>
      );
    case "risky":
      return (
        <div className={cn("inline-flex items-center font-semibold rounded-full bg-risky/10 text-risky border border-risky/20 shadow-sm", sizeClasses[size], className)}>
          <AlertCircle className={iconSizes[size]} />
          RISKY
        </div>
      );
    case "scam":
      return (
        <div className={cn("inline-flex items-center font-semibold rounded-full bg-destructive/10 text-destructive border border-destructive/20 shadow-sm", sizeClasses[size], className)}>
          <XOctagon className={iconSizes[size]} />
          SCAM
        </div>
      );
    default:
      return (
        <div className={cn("inline-flex items-center font-semibold rounded-full bg-muted text-muted-foreground border border-border shadow-sm", sizeClasses[size], className)}>
          {verdict.toUpperCase()}
        </div>
      );
  }
}
