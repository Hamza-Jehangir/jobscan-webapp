import { cn } from "@/lib/utils";

interface TrustGaugeProps {
  score: number | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function TrustGauge({ score, className, size = "md" }: TrustGaugeProps) {
  if (score === null || score === undefined) return null;

  let colorClass = "text-muted-foreground";
  let strokeColor = "stroke-muted";
  
  if (score >= 75) {
    colorClass = "text-safe";
    strokeColor = "stroke-safe";
  } else if (score >= 50) {
    colorClass = "text-caution";
    strokeColor = "stroke-caution";
  } else if (score >= 25) {
    colorClass = "text-risky";
    strokeColor = "stroke-risky";
  } else {
    colorClass = "text-destructive";
    strokeColor = "stroke-destructive";
  }

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  // Semicircle uses half circumference
  const semiCircumference = circumference / 2;
  const strokeDashoffset = semiCircumference - (score / 100) * semiCircumference;

  const sizeClasses = {
    sm: "w-24 h-12",
    md: "w-48 h-24",
    lg: "w-64 h-32",
    xl: "w-80 h-40"
  };

  const textClasses = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl",
    xl: "text-7xl"
  };

  return (
    <div className={cn("relative flex flex-col items-center justify-end overflow-hidden", sizeClasses[size], className)}>
      <svg 
        viewBox="0 0 100 50" 
        className="absolute top-0 left-0 w-full h-full overflow-visible drop-shadow-sm"
      >
        <path
          d="M 10,50 a 40,40 0 1,1 80,0"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="stroke-muted/30"
        />
        <path
          d="M 10,50 a 40,40 0 1,1 80,0"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={semiCircumference}
          strokeDashoffset={strokeDashoffset}
          className={cn("transition-all duration-1000 ease-out", strokeColor)}
        />
      </svg>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/4 flex flex-col items-center">
        <span className={cn("font-mono font-bold tracking-tighter", colorClass, textClasses[size])}>
          {score}
        </span>
      </div>
    </div>
  );
}
