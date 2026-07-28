import { CheckCircle2, AlertTriangle, XOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvidenceItem } from "@workspace/api-client-react/src/generated/api.schemas";

interface EvidenceListProps {
  evidence: EvidenceItem[];
  className?: string;
}

export function EvidenceList({ evidence, className }: EvidenceListProps) {
  if (!evidence || evidence.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {evidence.map((item, i) => (
        <div 
          key={i} 
          className={cn(
            "p-4 rounded-lg border flex gap-4 animate-in fade-in slide-in-from-bottom-2",
            item.status === 'pass' && "bg-safe/5 border-safe/20",
            item.status === 'warn' && "bg-caution/5 border-caution/20",
            item.status === 'fail' && "bg-destructive/5 border-destructive/20"
          )}
          style={{ animationDelay: `${i * 150}ms` }}
        >
          <div className="mt-0.5 shrink-0">
            {item.status === 'pass' && <CheckCircle2 className="w-5 h-5 text-safe" />}
            {item.status === 'warn' && <AlertTriangle className="w-5 h-5 text-caution" />}
            {item.status === 'fail' && <XOctagon className="w-5 h-5 text-destructive" />}
          </div>
          <div className="space-y-1">
            <h4 className={cn(
              "text-sm font-bold tracking-tight",
              item.status === 'pass' && "text-safe",
              item.status === 'warn' && "text-caution",
              item.status === 'fail' && "text-destructive"
            )}>
              {item.label}
            </h4>
            <p className="text-sm text-foreground/80 leading-snug">
              {item.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
